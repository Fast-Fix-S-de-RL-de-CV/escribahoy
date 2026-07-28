"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/schema";
import {
  clearRememberedEmail,
  createSession,
  destroySession,
  hashPassword,
  invalidateAllSessions,
  setRememberedEmail,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailer";
import {
  passwordChangedEmail,
  passwordResetEmail,
  welcomeEmail,
  type EmailContent,
} from "@/lib/emails";

/**
 * IMPORTANTE — redirect() y try/catch:
 * `redirect()` funciona lanzando una excepción especial (NEXT_REDIRECT) que
 * Next intercepta. Si cae dentro de un try/catch, el catch se la come y la
 * navegación nunca ocurre (además el usuario ve un error falso). Por eso en
 * este archivo TODOS los `redirect()` están en el nivel más externo de la
 * acción, después de que cualquier try/catch ya cerró, y ningún helper con
 * try/catch envuelve la llamada. Los try/catch que hay aquí (envío de correo,
 * choque de UNIQUE en el registro) terminan siempre ANTES del redirect.
 */

const RESET_TOKEN_TTL_MINUTES = 60;

// Login: 10 intentos por correo cada 15 minutos (frena fuerza bruta sin
// castigar a quien de verdad no recuerda su contraseña).
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Recuperación: 3 enlaces por correo cada hora (evita usar la app como
// máquina de spam contra la bandeja de alguien más).
const FORGOT_MAX_REQUESTS = 3;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

const GENERIC_LOGIN_ERROR = "Email o contraseña incorrectos";
const LINK_DEAD_ERROR =
  "El enlace ya venció o fue usado. Solicita uno nuevo.";

const EmailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un email válido");

const PasswordField = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres");

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Tu nombre debe tener al menos 2 caracteres"),
  email: EmailField,
  password: PasswordField,
});

const LoginSchema = z.object({
  email: EmailField,
  password: z.string().min(1, "Escribe tu contraseña"),
});

const ForgotSchema = z.object({ email: EmailField });

const ResetSchema = z
  .object({
    // El token real son 64 hex (32 bytes); si no calza, el enlace llegó
    // cortado o manipulado y no vale la pena tocar la DB.
    token: z
      .string()
      .trim()
      .regex(
        /^[0-9a-f]{64}$/i,
        "El enlace no es válido o está incompleto. Solicita uno nuevo."
      ),
    password: PasswordField,
    passwordConfirm: z.string().min(1, "Repite tu nueva contraseña"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Las dos contraseñas no coinciden",
    path: ["passwordConfirm"],
  });

function firstIssue(
  error: z.ZodError<unknown>,
  fallback = "Revisa los datos e inténtalo de nuevo"
): string {
  return error.issues[0]?.message ?? fallback;
}

/**
 * Normaliza un campo de FormData a string. Si el campo no viene (null) o llega
 * como File, zod respondería con su mensaje por defecto en inglés
 * ("expected string, received null"); con "" caen nuestros mensajes en español.
 */
function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Un checkbox llega como "on" cuando está marcado y no llega si no lo está. */
function isChecked(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v !== "" && v !== "false" && v !== "off" && v !== "0";
}

function appUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  // Sin APP_URL: en producción apuntamos al dominio real; en local a localhost,
  // para no mandar enlaces de reseteo de dev hacia el sitio de producción.
  return process.env.NODE_ENV === "production"
    ? "https://escribahoy.com"
    : "http://localhost:3000";
}

function waitMessage(retryAfterSec: number, prefix: string): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  const unit = minutes === 1 ? "minuto" : "minutos";
  return `${prefix} Espera ${minutes} ${unit} e inténtalo de nuevo.`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Envía un correo transaccional sin poder romper el flujo que lo dispara:
 * sendMail ya devuelve {ok:false} en vez de lanzar, y aun así envolvemos por si
 * algo revienta antes (DNS, config rara). Nunca se loguea el contenido del
 * correo, así que un enlace con token no puede acabar en los logs.
 */
async function deliver(
  to: string,
  content: EmailContent,
  context: string
): Promise<void> {
  try {
    const res = await sendMail({ to, ...content });
    if (!res.ok) {
      console.error(
        `[auth] ${context}: correo no enviado (${res.error ?? "sin detalle"})`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[auth] ${context}: fallo inesperado al enviar correo: ${msg}`);
  }
}

/**
 * `values` devuelve lo que la persona ya había escrito.
 *
 * POR QUÉ: React 19 llama `form.reset()` en cuanto termina la acción de un
 * `<form action={fn}>`. Con inputs no controlados eso deja los campos en
 * blanco justo cuando aparece el error, así que un "Ya existe una cuenta con
 * ese email" obligaba a teclear todo otra vez (y en login se comía intentos
 * del rate limit). Los formularios releen estos valores como defaultValue.
 * Nunca regresamos la contraseña: esa sí conviene que se borre.
 */
export type AuthState =
  | {
      error?: string;
      values?: {
        name?: string;
        email?: string;
        terms?: boolean;
        remember?: boolean;
      };
    }
  | undefined;

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const termsChecked = isChecked(formData.get("terms"));
  // Se capturan crudos (antes de validar) para poder devolverlos si zod falla.
  const keep = {
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    terms: termsChecked,
  };

  const parsed = RegisterSchema.safeParse({
    name: keep.name,
    email: keep.email,
    password: str(formData.get("password")),
  });
  if (!parsed.success) {
    return {
      error: firstIssue(parsed.error, "Datos inválidos"),
      values: keep,
    };
  }
  const { name, email, password } = parsed.data;

  if (!termsChecked) {
    return {
      error: "Debes aceptar los Términos y el Aviso de Privacidad",
      values: keep,
    };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) {
    return { error: "Ya existe una cuenta con ese email", values: keep };
  }

  const id = nanoid();
  const passwordHash = await hashPassword(password);
  try {
    await db.insert(users).values({
      id,
      name,
      email,
      passwordHash,
      acceptedTermsAt: new Date(),
    });
  } catch (e) {
    // Carrera: alguien registró el mismo correo entre el SELECT y el INSERT.
    // El índice UNIQUE es la verdad, así que lo traducimos a mensaje humano.
    const msg = String(e instanceof Error ? e.message : e);
    if (/UNIQUE constraint failed: users\.email/i.test(msg)) {
      return { error: "Ya existe una cuenta con ese email", values: keep };
    }
    throw e;
  }

  // Acaba de crear la cuenta: dejamos la sesión persistente para que no la
  // pierda a medio onboarding por cerrar el navegador.
  await createSession(id, true);
  await setRememberedEmail(email);

  // El correo de bienvenida es un extra: si el SMTP está caído el registro ya
  // quedó hecho y la sesión abierta, así que solo se registra el fallo.
  await deliver(email, welcomeEmail({ name, appUrl: appUrl() }), "bienvenida");

  // FUERA de cualquier try/catch: redirect() lanza NEXT_REDIRECT.
  redirect("/onboarding");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const remember = isChecked(formData.get("remember"));
  const keep = { email: str(formData.get("email")), remember };

  const parsed = LoginSchema.safeParse({
    email: keep.email,
    password: str(formData.get("password")),
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error, "Datos inválidos"), values: keep };
  }
  const { email, password } = parsed.data;

  const limit = checkRateLimit(`login:${email}`, {
    max: LOGIN_MAX_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });
  if (!limit.ok) {
    return {
      error: waitMessage(limit.retryAfterSec, "Demasiados intentos."),
      values: keep,
    };
  }

  const found = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!found.length) {
    // Quemamos un bcrypt del mismo costo que el camino "el correo sí existe":
    // sin esto, el tiempo de respuesta delata qué correos están registrados.
    await hashPassword(password);
    return { error: GENERIC_LOGIN_ERROR, values: keep };
  }

  const ok = await verifyPassword(password, found[0].passwordHash);
  if (!ok) {
    // Mismo mensaje que arriba a propósito: no confirmamos si el correo existe.
    return { error: GENERIC_LOGIN_ERROR, values: keep };
  }

  await createSession(found[0].id, remember);
  if (remember) {
    await setRememberedEmail(email);
  } else {
    await clearRememberedEmail();
  }

  // FUERA de cualquier try/catch: redirect() lanza NEXT_REDIRECT.
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  // FUERA de cualquier try/catch: redirect() lanza NEXT_REDIRECT.
  redirect("/");
}

export type ForgotState = { ok?: boolean; error?: string } | undefined;

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const parsed = ForgotSchema.safeParse({ email: str(formData.get("email")) });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error, "Escribe un email válido") };
  }
  const { email } = parsed.data;

  const limit = checkRateLimit(`forgot:${email}`, {
    max: FORGOT_MAX_REQUESTS,
    windowMs: FORGOT_WINDOW_MS,
  });
  if (!limit.ok) {
    // No filtra nada: el contador se lleva por el correo ESCRITO, exista la
    // cuenta o no, así que la respuesta es idéntica en ambos casos.
    return {
      error: waitMessage(
        limit.retryAfterSec,
        "Ya pediste varios enlaces para ese correo."
      ),
    };
  }

  const found = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (found.length) {
    const user = found[0];
    // 32 bytes de entropía: el token viaja solo en el correo; en la DB queda
    // únicamente su SHA-256, así que ni con la DB en mano se puede reusar.
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    // Un solo enlace vivo por usuario: pedir uno nuevo invalida los anteriores
    // (y de paso limpia los ya usados de ese usuario).
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
    await db.insert(passwordResets).values({
      id: sha256Hex(token),
      userId: user.id,
      expiresAt,
    });

    await deliver(
      user.email,
      passwordResetEmail({
        name: user.name,
        resetUrl: `${appUrl()}/reset-password?token=${token}`,
        expiresMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
      "enlace de reseteo"
    );
  }

  // Respuesta genérica SIEMPRE (cuenta inexistente o SMTP caído incluidos):
  // cualquier diferencia aquí convertiría este formulario en un detector de
  // correos registrados.
  return { ok: true };
}

export type ResetState = { ok?: boolean; error?: string } | undefined;

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = ResetSchema.safeParse({
    token: str(formData.get("token")),
    password: str(formData.get("password")),
    passwordConfirm: str(formData.get("passwordConfirm")),
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error, "Datos inválidos") };
  }
  const { token, password } = parsed.data;

  const tokenHash = sha256Hex(token.toLowerCase());
  const rows = await db
    .select({
      resetId: passwordResets.id,
      userId: passwordResets.userId,
      expiresAt: passwordResets.expiresAt,
      usedAt: passwordResets.usedAt,
      name: users.name,
      email: users.email,
    })
    .from(passwordResets)
    .innerJoin(users, eq(passwordResets.userId, users.id))
    .where(eq(passwordResets.id, tokenHash))
    .limit(1);

  if (!rows.length) return { error: LINK_DEAD_ERROR };
  const row = rows[0];
  if (row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return { error: LINK_DEAD_ERROR };
  }

  // Marcamos usado ANTES de cambiar la contraseña y solo si seguía sin usar:
  // este UPDATE condicional es la garantía real de un solo uso (si otra
  // petición ganó la carrera, changes === 0 y aquí no se cambia nada).
  const claimed = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(eq(passwordResets.id, tokenHash), isNull(passwordResets.usedAt))
    )
    .run();
  if (claimed.changes !== 1) return { error: LINK_DEAD_ERROR };

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, row.userId));

  // Cerrar sesión en todos lados: si alguien tenía la cuenta tomada, el
  // reseteo lo saca en el acto.
  await invalidateAllSessions(row.userId);

  await deliver(
    row.email,
    passwordChangedEmail({ name: row.name, appUrl: appUrl() }),
    "aviso de contraseña cambiada"
  );

  // A propósito NO iniciamos sesión: el usuario entra a /login con su
  // contraseña nueva y así confirma que la recuerda.
  return { ok: true };
}
