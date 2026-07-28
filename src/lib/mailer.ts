import nodemailer, { type Transporter } from "nodemailer";

/**
 * Capa SMTP de EscribaHoy.
 *
 * El transport se crea de forma perezosa y se cachea en `globalThis` (mismo
 * patrón que src/lib/db.ts) para que el hot-reload de dev y los distintos
 * módulos del server no abran una conexión nueva por request.
 *
 * Nunca se loguea SMTP_PASS ni ningún fragmento de él.
 */

const DEFAULT_PORT = 465;
const DEFAULT_SECURE = true;

// Un SMTP colgado no debe colgar la request del usuario: 10s para conectar y
// para el saludo, 15s de inactividad de socket.
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 15_000;

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

const globalForMail = globalThis as unknown as {
  escribahoyMailer?: Transporter;
};

function readConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  const rawPort = process.env.SMTP_PORT?.trim();
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : DEFAULT_PORT;

  const rawSecure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = rawSecure === undefined || rawSecure === "" ? DEFAULT_SECURE : rawSecure !== "false";

  // Si no hay SMTP_FROM usable, caemos al usuario autenticado (siempre válido
  // para el servidor) en vez de mandar un From vacío que rebote.
  const from = process.env.SMTP_FROM?.trim() || `EscribaHoy <${user}>`;

  return { host, port, secure, user, pass, from };
}

/**
 * true solo si están HOST, USER y PASS. El resto tiene defaults sanos.
 */
export function isMailConfigured(): boolean {
  return readConfig() !== null;
}

function getTransporter(config: SmtpConfig): Transporter {
  const cached = globalForMail.escribahoyMailer;
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    // TLS estricto: el certificado es Let's Encrypt válido, así que NO
    // desactivamos la verificación (rejectUnauthorized:false abriría la puerta
    // a MITM en el envío de enlaces de reseteo de contraseña).
    requireTLS: !config.secure,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  globalForMail.escribahoyMailer = transporter;
  return transporter;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  const s = String(e ?? "");
  return s || "Error desconocido de SMTP";
}

/**
 * Comprueba credenciales/conectividad contra el servidor SMTP.
 * No lanza: siempre devuelve {ok} o {ok:false, error}.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const config = readConfig();
  if (!config) {
    return { ok: false, error: "SMTP no configurado" };
  }
  try {
    await getTransporter(config).verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Envía un correo transaccional. Nunca lanza: el llamador decide qué hacer con
 * {ok:false}. Falta de configuración se avisa por console.warn y NO se trata
 * como crash (registro/reseteo deben seguir funcionando en local sin SMTP).
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = readConfig();
  if (!config) {
    console.warn(
      `[mailer] SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS); correo "${opts.subject}" no enviado.`
    );
    return { ok: false, error: "SMTP no configurado" };
  }

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true };
  } catch (e) {
    const error = errorMessage(e);
    // Solo el mensaje del error: nunca el objeto completo (podría traer la
    // config con la contraseña) ni SMTP_PASS.
    console.error(`[mailer] fallo al enviar "${opts.subject}": ${error}`);
    return { ok: false, error };
  }
}
