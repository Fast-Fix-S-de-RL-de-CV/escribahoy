import { cookies } from "next/headers";
import { db } from "./db";
import { sessions, users, type User } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const SESSION_COOKIE = "escribahoy_session";

/**
 * Cookie donde guardamos el correo del último inicio de sesión con
 * "Recordarme", para poder prellenar el campo en /login.
 *
 * DECISIÓN: httpOnly = TRUE. La única cosa que necesita leerla es el Server
 * Component de la página de login (vía getRememberedEmail), así que el JS del
 * navegador no la necesita; dejarla legible por scripts solo expondría el
 * correo del usuario a cualquier XSS o extensión.
 */
export const REMEMBER_EMAIL_COOKIE = "escribahoy_remember_email";

/** "Recordarme" activo: sesión larga y cookie persistente en disco. */
const REMEMBER_SESSION_DAYS = 30;
/** Sin "Recordarme": sesión corta en DB + cookie de sesión (muere al cerrar). */
const SHORT_SESSION_DAYS = 1;

const REMEMBER_EMAIL_MAX_AGE_SEC = 60 * 60 * 24 * 365; // ~1 año
const MAX_EMAIL_LENGTH = 254; // límite práctico de RFC 5321

// Solo para sanear lo que entra/sale de la cookie del correo recordado: no es
// validación de registro (eso lo hace zod en las acciones), es una malla para
// que nunca escribamos ni devolvamos basura o caracteres de control.
const SAFE_EMAIL_RE = /^[^\s<>"'`;,@]+@[^\s<>"'`;,@]+\.[^\s<>"'`;,@]{2,}$/;

const isProd = () => process.env.NODE_ENV === "production";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Crea la sesión en DB y planta la cookie.
 *
 * @param remember true  -> sesión de 30 días y cookie PERSISTENTE (con
 *                          `expires`), sobrevive a cerrar el navegador.
 *                 false -> sesión de 1 día en DB y cookie DE SESIÓN (sin
 *                          `expires` ni `maxAge`), el navegador la tira al
 *                          cerrarse. El vencimiento en DB es el respaldo para
 *                          navegadores que "restauran pestañas" y reviven
 *                          cookies de sesión.
 */
export async function createSession(
  userId: string,
  remember?: boolean
): Promise<string> {
  const id = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + (remember ? REMEMBER_SESSION_DAYS : SHORT_SESSION_DAYS)
  );
  await db.insert(sessions).values({ id, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    // Solo cuando el usuario pidió ser recordado la cookie va a disco.
    ...(remember ? { expires: expiresAt } : {}),
  });
  return id;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    await db.delete(sessions).where(eq(sessions.id, sid));
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Borra TODAS las sesiones del usuario (cerrar sesión en todos los
 * dispositivos). Se usa al cambiar la contraseña: si alguien tenía la cuenta
 * secuestrada, el reseteo lo saca de inmediato.
 *
 * Ojo: no toca la cookie del navegador actual; el llamador decide si además
 * quiere destroySession() o dejar que la cookie muera sola (ya no resuelve a
 * ninguna fila, así que getCurrentUser devuelve null).
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Guarda el correo para prellenar /login la próxima vez. */
export async function setRememberedEmail(email: string): Promise<void> {
  const value = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!value || value.length > MAX_EMAIL_LENGTH || !SAFE_EMAIL_RE.test(value)) {
    return;
  }
  const jar = await cookies();
  jar.set(REMEMBER_EMAIL_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: REMEMBER_EMAIL_MAX_AGE_SEC,
  });
}

/** Olvida el correo recordado (login sin "Recordarme"). */
export async function clearRememberedEmail(): Promise<void> {
  const jar = await cookies();
  jar.delete(REMEMBER_EMAIL_COOKIE);
}

/**
 * Correo recordado, para que la página de login (Server Component) prellene el
 * campo. Devuelve null si no hay cookie o si su contenido no parece un correo.
 */
export async function getRememberedEmail(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(REMEMBER_EMAIL_COOKIE)?.value;
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value || value.length > MAX_EMAIL_LENGTH || !SAFE_EMAIL_RE.test(value)) {
    return null;
  }
  return value;
}

/**
 * Usuario sin material sensible. `users` incluye `passwordHash`, y cualquier
 * objeto que un Server Component pase como prop a un Client Component se
 * serializa COMPLETO dentro del payload RSC que va en el HTML (React no
 * descarta las propiedades que el cliente no usa). Devolver la fila entera
 * mandaba el hash bcrypt al navegador en cada carga de /project/[id].
 * Por eso getCurrentUser selecciona columnas explícitas: el hash no puede
 * filtrarse aunque una ruta nueva pase este objeto al cliente.
 * Quien de verdad necesita el hash (login, reseteo) lo consulta aparte.
 */
export type SafeUser = Omit<User, "passwordHash">;

export async function getCurrentUser(): Promise<SafeUser | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        acceptedTermsAt: users.acceptedTermsAt,
        createdAt: users.createdAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sid))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sid));
    return null;
  }
  return row.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
