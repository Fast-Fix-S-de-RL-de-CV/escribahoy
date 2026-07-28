/**
 * Plantillas de correo transaccional de EscribaHoy.
 *
 * Reglas de esta capa (son por los clientes de correo, no por la UI de React):
 * - Estilos SIEMPRE inline: Gmail/Outlook tiran <style> y las clases.
 * - Layout con <table>: los clientes viejos no soportan flex/grid.
 * - El wordmark va en TEXTO, no <img>/<svg>: las imágenes se bloquean por
 *   defecto y un logo invisible se ve como correo roto.
 * - El HTML declara charset utf-8, así que los acentos van literales; solo se
 *   usan entidades donde hacen falta (&hearts;, &middot;).
 * - Cada plantilla devuelve también `text`; sin la parte de texto plano los
 *   filtros antispam castigan el mensaje.
 */

export type EmailContent = { subject: string; html: string; text: string };

const INK = "#1e3a4a";
const ACCENT = "#0d9488";
const BODY_BG = "#f5f5f4";
const CARD_BG = "#ffffff";
const TEXT = "#292524";
const MUTED = "#78716c";
const BORDER = "#e7e5e4";
const HEART = "#dc2626";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const SUPPORT_EMAIL = "info@escribahoy.com";
const DEV_URL = "https://fast-fix.com.mx";
const DEFAULT_APP_URL = "https://escribahoy.com";

/**
 * Escapa lo que venga del usuario (el nombre, sobre todo) antes de meterlo en
 * el HTML del correo: sin esto un nombre con `<img onerror=...>` viajaría tal
 * cual dentro del mensaje.
 */
function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normaliza el nombre para el saludo y recorta largos absurdos. */
function cleanName(name: string): string {
  const trimmed = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return "";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

function normalizeAppUrl(appUrl: string): string {
  const base = String(appUrl ?? "").trim() || DEFAULT_APP_URL;
  return base.replace(/\/+$/, "");
}

/** Deriva el origen (https://host) de un enlace absoluto; si no lo es, usa APP_URL. */
function appUrlFromLink(link: string): string {
  try {
    return new URL(link).origin;
  } catch {
    return normalizeAppUrl(process.env.APP_URL ?? "");
  }
}

/** `href` ya escapado; `label` puede traer HTML propio nuestro. */
function button(o: { href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${ACCENT};">
                    <a href="${o.href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${ACCENT};">${o.label}</a>
                  </td>
                </tr>
              </table>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:26px;color:${TEXT};">${html}</p>`;
}

function heading(html: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;font-weight:700;line-height:30px;color:${INK};">${html}</h1>`;
}

function small(html: string, extra = ""): string {
  return `<p style="margin:0 0 8px 0;${extra}font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED};">${html}</p>`;
}

/**
 * Arma el HTML completo del correo: fondo gris, tarjeta blanca centrada de
 * 560px, header con el wordmark en texto y pie de marca.
 */
function layout(o: { title: string; bodyHtml: string; appUrl: string }): string {
  const appUrl = escapeHtml(normalizeAppUrl(o.appUrl));
  const title = escapeHtml(o.title);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BODY_BG};">
  <div style="display:none;font-size:1px;color:${BODY_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${title}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BODY_BG};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 20px 0;font-family:${FONT};font-size:24px;font-weight:700;line-height:30px;letter-spacing:-0.4px;">
              <a href="${appUrl}" style="text-decoration:none;"><span style="color:${INK};">Escriba</span><span style="color:${ACCENT};">Hoy</span></a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:32px 28px;">
              ${o.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:20px;color:${MUTED};">
              Hecho con <span style="color:${HEART};">&hearts;</span> en México &middot; Desarrollado por <a href="${DEV_URL}" style="color:${MUTED};text-decoration:underline;">Fast Fix IT</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:20px;color:${MUTED};">
              <a href="${appUrl}" style="color:${MUTED};text-decoration:underline;">escribahoy.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textFooter(appUrl: string): string {
  return `--
EscribaHoy · ${normalizeAppUrl(appUrl)}
Hecho con amor en México · Desarrollado por Fast Fix IT (${DEV_URL})`;
}

export function welcomeEmail(o: { name: string; appUrl: string }): EmailContent {
  const appUrl = normalizeAppUrl(o.appUrl);
  const name = cleanName(o.name);
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  const ctaUrl = `${appUrl}/onboarding`;

  const bodyHtml = [
    heading(`${greeting}: bienvenido a EscribaHoy`),
    paragraph(
      "Qué gusto tenerte aquí. EscribaHoy existe para que ese libro o curso que traes en la cabeza por fin salga, sin que tengas que sentarte a escribirlo de corrido."
    ),
    paragraph(
      "Subes tu material (PDFs, notas, apuntes sueltos), la IA lo lee y te propone un temario ordenado. De ahí en adelante escribes por partes: un capítulo, una sección, lo que te dé tiempo de avanzar hoy."
    ),
    paragraph(
      "Tu voz manda siempre: la IA organiza y sugiere, pero el libro sigue siendo tuyo."
    ),
    button({ href: escapeHtml(ctaUrl), label: "Empezar mi primer libro" }),
    small(
      `¿Dudas? Respóndenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};text-decoration:underline;">${SUPPORT_EMAIL}</a>.`,
      "margin-top:16px;"
    ),
  ].join("\n              ");

  const text = `${name ? `Hola, ${name}` : "Hola"}: bienvenido a EscribaHoy.

Qué gusto tenerte aquí. EscribaHoy existe para que ese libro o curso que traes en la cabeza por fin salga, sin que tengas que sentarte a escribirlo de corrido.

Subes tu material (PDFs, notas, apuntes sueltos), la IA lo lee y te propone un temario ordenado. De ahí en adelante escribes por partes: un capítulo, una sección, lo que te dé tiempo de avanzar hoy.

Tu voz manda siempre: la IA organiza y sugiere, pero el libro sigue siendo tuyo.

Empezar mi primer libro:
${ctaUrl}

¿Dudas? Respóndenos a ${SUPPORT_EMAIL}.

${textFooter(appUrl)}`;

  return {
    subject: "Bienvenido a EscribaHoy: empecemos tu libro",
    html: layout({ title: "Bienvenido a EscribaHoy", bodyHtml, appUrl }),
    text,
  };
}

export function passwordResetEmail(o: {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): EmailContent {
  const name = cleanName(o.name);
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  const resetUrl = String(o.resetUrl ?? "").trim();
  const safeUrl = escapeHtml(resetUrl);
  const minutes = Number.isFinite(o.expiresMinutes)
    ? Math.max(1, Math.round(o.expiresMinutes))
    : 60;
  const minutesLabel = minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  // El enlace de reseteo ya apunta a la app: de ahí sacamos el appUrl del
  // layout sin pedirle un parámetro extra al llamador.
  const appUrl = appUrlFromLink(resetUrl);

  const bodyHtml = [
    heading("Restablece tu contraseña"),
    paragraph(
      `${greeting}: recibimos una solicitud para restablecer la contraseña de tu cuenta de EscribaHoy.`
    ),
    paragraph("Da clic en el botón para crear una nueva:"),
    button({ href: safeUrl, label: "Crear nueva contraseña" }),
    small(
      `Este enlace vence en <strong style="color:${TEXT};">${minutesLabel}</strong> y solo se puede usar una vez.`,
      "margin-top:16px;"
    ),
    small("Si el botón no funciona, copia y pega esta dirección en tu navegador:"),
    `<p style="margin:0 0 20px 0;font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;"><a href="${safeUrl}" style="color:${ACCENT};text-decoration:underline;word-break:break-all;">${safeUrl}</a></p>`,
    `<p style="margin:0;padding-top:16px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED};">Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando y nadie más puede entrar con este enlace.</p>`,
  ].join("\n              ");

  const text = `${name ? `Hola, ${name}` : "Hola"}: recibimos una solicitud para restablecer la contraseña de tu cuenta de EscribaHoy.

Crea una nueva contraseña aquí:
${resetUrl}

Este enlace vence en ${minutesLabel} y solo se puede usar una vez.

Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando y nadie más puede entrar con este enlace.

${textFooter(appUrl)}`;

  return {
    subject: "Restablece tu contraseña de EscribaHoy",
    html: layout({ title: "Restablece tu contraseña", bodyHtml, appUrl }),
    text,
  };
}

export function passwordChangedEmail(o: {
  name: string;
  appUrl: string;
}): EmailContent {
  const appUrl = normalizeAppUrl(o.appUrl);
  const name = cleanName(o.name);
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  const loginUrl = `${appUrl}/login`;

  const bodyHtml = [
    heading("Tu contraseña cambió"),
    paragraph(
      `${greeting}: la contraseña de tu cuenta de EscribaHoy se actualizó correctamente.`
    ),
    paragraph(
      "Por seguridad cerramos todas las sesiones abiertas, así que tendrás que entrar de nuevo con la contraseña nueva en cada dispositivo."
    ),
    button({ href: escapeHtml(loginUrl), label: "Iniciar sesión" }),
    `<p style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED};">Si no fuiste tú quien hizo este cambio, escríbenos de inmediato a <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};text-decoration:underline;">${SUPPORT_EMAIL}</a> para recuperar tu cuenta.</p>`,
  ].join("\n              ");

  const text = `${name ? `Hola, ${name}` : "Hola"}: la contraseña de tu cuenta de EscribaHoy se actualizó correctamente.

Por seguridad cerramos todas las sesiones abiertas, así que tendrás que entrar de nuevo con la contraseña nueva en cada dispositivo.

Iniciar sesión:
${loginUrl}

Si no fuiste tú quien hizo este cambio, escríbenos de inmediato a ${SUPPORT_EMAIL} para recuperar tu cuenta.

${textFooter(appUrl)}`;

  return {
    subject: "Tu contraseña de EscribaHoy cambió",
    html: layout({ title: "Tu contraseña cambió", bodyHtml, appUrl }),
    text,
  };
}
