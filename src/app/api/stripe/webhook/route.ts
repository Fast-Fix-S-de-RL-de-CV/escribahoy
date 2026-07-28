/**
 * POST /api/stripe/webhook — la pieza de dinero.
 *
 * Stripe cobra; ESTA ruta es lo único que convierte ese cobro en acceso. Si
 * falla, hay gente pagando sin plan o gente con plan sin pagar. De ahí las tres
 * reglas que gobiernan el archivo:
 *
 * ── 1. CUERPO CRUDO PARA VERIFICAR LA FIRMA ─────────────────────────────────
 * La firma `stripe-signature` es un HMAC-SHA256 sobre los BYTES EXACTOS que
 * Stripe envió. `await req.json()` parsea y descarta el texto original; volver a
 * serializar con JSON.stringify produce otro string (orden de llaves, espacios,
 * escapes de unicode) y el HMAC ya no coincide: la verificación falla SIEMPRE.
 * Por eso aquí se usa `await req.text()`, que es justo lo que documenta Next para
 * webhooks en Route Handlers (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/route.md, sección "Webhooks"). En App Router no hace falta
 * desactivar ningún bodyParser: no existe.
 *
 * Sin firma válida NO se toca la base. Cualquiera puede hacerle POST a esta URL
 * pública; la firma es lo único que distingue a Stripe de alguien regalándose el
 * plan Autoridad con un curl.
 *
 * ── 2. IDEMPOTENCIA Y ORDEN (marca de agua) ─────────────────────────────────
 * Stripe reintenta las entregas hasta 3 días y NO garantiza el orden: un
 * `customer.subscription.updated` viejo puede llegar DESPUÉS de uno nuevo.
 * Aplicarlo tal cual degradaría a un usuario que acaba de subir de plan.
 *
 * La solución es una marca de agua por fila: `subscriptions.ultimo_evento_at`
 * guarda el `event.created` del último evento aplicado, y todo evento con
 * `created` ESTRICTAMENTE anterior se descarta sin escribir. Se usa `<` y no
 * `<=` a propósito: varios eventos legítimos comparten el mismo segundo (la
 * suscripción se crea y se actualiza en el mismo instante), y con `<=` se
 * perdería el segundo de ellos.
 *
 * Eso da idempotencia además de orden: una reentrega del MISMO evento trae el
 * mismo `created`, así que se vuelve a aplicar el mismo estado — y como cada
 * manejador escribe el estado COMPLETO derivado del objeto de Stripe (no un
 * delta, no un incremento), reaplicarlo es inofensivo. Ese mismo diseño hace que
 * el sistema se auto-repare: si un evento se pierde, el siguiente vuelve a
 * escribir la verdad entera.
 *
 * Protección extra: un evento de una suscripción DISTINTA a la que sigue la fila
 * no puede degradarla (caso real: se cancela la suscripción vieja justo después
 * de crear la nueva, y el `deleted` de la vieja llega al final).
 *
 * ── 3. NUNCA SE BORRA CONTENIDO ─────────────────────────────────────────────
 * Bajar de plan cambia `plan` a 'gratis' y nada más. Ni un proyecto, ni un
 * capítulo, ni un archivo de la base de conocimiento se toca aquí. El autor que
 * dejó de pagar tiene que poder volver y encontrar su libro completo.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { subscriptions, users } from "@/lib/schema";
import {
  filaDeSuscripcion,
  finDePeriodo,
  getStripe,
  idDe,
  priceIdDe,
} from "@/lib/stripe";
import {
  planDesdePriceId,
  planPorId,
  type Ciclo,
  type PlanId,
} from "@/lib/plans";
import type { Subscription as FilaSuscripcion } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estados de Stripe que NUNCA dan acceso, sin importar la fecha. Cuando la
 * suscripción cae en uno de estos, la fila queda en plan 'gratis'.
 *
 * `past_due` NO está aquí a propósito: en México los cobros recurrentes fallan
 * seguido y Stripe reintenta durante días; la decisión de negocio (documentada en
 * src/lib/subscription.ts) es respetar el periodo ya pagado. La parte que depende
 * del RELOJ se decide en `suscripcionDe()`, que es el único árbitro del acceso;
 * aquí solo se registra lo que Stripe reporta.
 */
const ESTADOS_SIN_ACCESO = new Set([
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

/** Respuesta corta: a Stripe le basta un 2xx y le urge. */
function ok(mensaje = "ok") {
  return NextResponse.json({ received: true, mensaje }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Sin secreto no se puede verificar NADA, y procesar sin verificar sería
    // regalar planes. 500 para que Stripe reintente cuando esté configurado.
    console.error(
      "[stripe:webhook] falta STRIPE_WEBHOOK_SECRET: no se puede verificar la firma, evento descartado."
    );
    return NextResponse.json(
      { error: "webhook sin configurar" },
      { status: 500 }
    );
  }

  const firma = req.headers.get("stripe-signature");
  if (!firma) {
    return NextResponse.json({ error: "falta la firma" }, { status: 400 });
  }

  // ⚠️ CUERPO CRUDO. Ver el bloque 1 del encabezado: con req.json() la firma
  // nunca coincide.
  const raw = await req.text();

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error(
      "[stripe:webhook] Stripe sin configurar:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { error: "stripe sin configurar" },
      { status: 500 }
    );
  }

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(raw, firma, secret);
  } catch (e) {
    // Firma mala, secreto equivocado o payload alterado: 400 y ni una escritura.
    // Stripe no reintenta los 400, que es lo correcto — reintentar una firma
    // inválida no la va a arreglar.
    console.error(
      "[stripe:webhook] firma inválida:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  try {
    await manejar(stripe, evento);
  } catch (e) {
    // Ya verificamos la firma: el evento es legítimo y no queremos que Stripe
    // entre en la ruleta de reintentos por un error nuestro. Se devuelve 200 y
    // se loguea con id y tipo para poder reenviarlo a mano desde el dashboard.
    // Que esto sea aceptable no es casualidad: cada manejador escribe el estado
    // COMPLETO derivado del objeto de Stripe, así que el siguiente evento del
    // ciclo de vida repara solo lo que este dejó a medias.
    console.error(
      `[stripe:webhook] falló el procesamiento de ${evento.type} (${evento.id}):`,
      e instanceof Error ? e.message : e
    );
    return ok("registrado con error");
  }

  return ok();
}

// ───────────────────────────── ENRUTADO DE EVENTOS ──────────────────────────

async function manejar(stripe: Stripe, evento: Stripe.Event): Promise<void> {
  switch (evento.type) {
    /**
     * El usuario terminó de pagar en Checkout. Es el ÚNICO evento que trae de
     * forma confiable a quién pertenece el pago (client_reference_id), así que
     * aquí se amarra el customer de Stripe con el usuario local.
     */
    case "checkout.session.completed": {
      const session = evento.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return; // pagos únicos: no aplican

      const customerId = idDe(session.customer);
      const userId = await resolverUserId(stripe, {
        metadataUserId: session.metadata?.userId,
        clientReferenceId: session.client_reference_id,
        customerId,
        email: session.customer_details?.email ?? session.customer_email,
      });

      if (userId && customerId) {
        await amarrarCustomer(userId, customerId);
      }

      const subId = idDe(session.subscription);
      if (!subId) return;

      // La sesión no trae el estado ni el periodo de la suscripción: hay que
      // pedirla. Si esto falla, el evento customer.subscription.created que
      // Stripe manda enseguida deja la fila igual de correcta.
      const sub = await stripe.subscriptions.retrieve(subId);
      await aplicarSuscripcion(stripe, sub, evento.created, {
        userIdSugerido: userId,
        esBorrado: false,
      });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = evento.data.object as Stripe.Subscription;
      await aplicarSuscripcion(stripe, sub, evento.created, {
        userIdSugerido: null,
        esBorrado: evento.type === "customer.subscription.deleted",
      });
      return;
    }

    /**
     * invoice.paid: se cobró la renovación → hay que EXTENDER el periodo.
     * invoice.payment_failed: falló el cargo → Stripe ya movió la suscripción a
     * past_due, y el periodo pagado sigue mandando (ver src/lib/subscription.ts).
     *
     * En los dos casos se relee la suscripción en vez de adivinar fechas desde
     * la factura: la suscripción es la verdad del periodo.
     */
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = evento.data.object as Stripe.Invoice;
      // ⚠️ En esta versión de la API la factura YA NO tiene `subscription`: la
      // suscripción que la generó vive en parent.subscription_details.
      const subId = idDe(
        invoice.parent?.subscription_details?.subscription ?? null
      );
      if (!subId) return; // factura suelta, sin suscripción
      const sub = await stripe.subscriptions.retrieve(subId);
      await aplicarSuscripcion(stripe, sub, evento.created, {
        userIdSugerido: null,
        esBorrado: false,
      });
      return;
    }

    default:
      // Cualquier otro evento se ignora en silencio: el endpoint puede estar
      // suscrito a más tipos de los que nos interesan y eso no es un error.
      return;
  }
}

// ───────────────────────── ESCRITURA DEL ESTADO LOCAL ───────────────────────

/**
 * Escribe en la fila del usuario el estado COMPLETO que Stripe reporta de una
 * suscripción. Es la única función que toca `plan` y `estado`.
 */
async function aplicarSuscripcion(
  stripe: Stripe,
  subEntrante: Stripe.Subscription,
  eventoCreated: number,
  opciones: { userIdSugerido: string | null; esBorrado: boolean }
): Promise<void> {
  let sub = subEntrante;
  const customerId = idDe(sub.customer);

  // Localizar la fila: primero por suscripción (lo más específico), luego por
  // cliente, y al final por usuario. Ese orden evita duplicar filas.
  let fila = await filaPorSuscripcion(sub.id);
  if (!fila && customerId) fila = await filaPorCustomer(customerId);

  let userId = fila?.userId ?? null;
  if (!userId) {
    userId = await resolverUserId(stripe, {
      metadataUserId: sub.metadata?.userId,
      clientReferenceId: opciones.userIdSugerido,
      customerId,
    });
    if (userId) fila = (await filaDeSuscripcion(userId)) ?? null;
  }

  if (!userId) {
    // Un cliente de Stripe que no corresponde a ningún usuario nuestro (una
    // prueba hecha a mano en el dashboard, o una cuenta ya borrada). No hay nada
    // que actualizar y NO se inventa una fila.
    console.error(
      `[stripe:webhook] suscripción ${sub.id} sin usuario identificable (customer ${customerId ?? "?"}).`
    );
    return;
  }

  // ── MARCA DE AGUA: descartar lo viejo ─────────────────────────────────────
  const marca = fila?.ultimoEventoAt
    ? Math.floor(fila.ultimoEventoAt.getTime() / 1000)
    : null;
  if (marca !== null && eventoCreated < marca) {
    console.warn(
      `[stripe:webhook] evento viejo descartado para ${sub.id} (created ${eventoCreated} < marca ${marca}).`
    );
    return;
  }

  // ── No dejar que una suscripción vieja degrade a una nueva ────────────────
  const seguidaEnFila = fila?.stripeSubscriptionId?.trim() || null;
  if (seguidaEnFila && seguidaEnFila !== sub.id) {
    const entranteViva =
      !opciones.esBorrado && !ESTADOS_SIN_ACCESO.has(String(sub.status));
    if (!entranteViva) {
      console.warn(
        `[stripe:webhook] ignorado ${sub.id} (${sub.status}): la fila sigue a ${seguidaEnFila}.`
      );
      return;
    }
    // La entrante SÍ está viva: es un cambio de suscripción y se adopta.
  }

  // ── Periodo pagado ────────────────────────────────────────────────────────
  let periodoFin = finDePeriodo(sub);
  if (!periodoFin && !opciones.esBorrado) {
    // Sin fecha, `suscripcionDe()` falla cerrado y le quitaría el acceso a
    // alguien que pagó. Antes de aceptar el NULL, se relee la suscripción (el
    // payload del evento pudo venir con los items paginados).
    try {
      sub = await stripe.subscriptions.retrieve(sub.id);
      periodoFin = finDePeriodo(sub);
    } catch (e) {
      console.error(
        `[stripe:webhook] no se pudo releer ${sub.id} para el periodo:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  // Si de plano no hay fecha nueva, se conserva la que ya estaba en lugar de
  // borrarla: una fecha vieja es mejor que ninguna.
  if (!periodoFin) periodoFin = fila?.periodoFin ?? null;

  // ── Plan y ciclo, derivados del PRECIO que Stripe está cobrando ───────────
  const estado = opciones.esBorrado ? "canceled" : String(sub.status);
  const sinAcceso = opciones.esBorrado || ESTADOS_SIN_ACCESO.has(estado);

  // planPorId normaliza: si la columna trae basura, se parte de 'gratis' en vez
  // de arrastrar un plan que no existe.
  let plan: PlanId = planPorId(fila?.plan).id;
  let ciclo: Ciclo | null =
    fila?.ciclo === "mes" || fila?.ciclo === "anual" ? fila.ciclo : null;

  const priceId = priceIdDe(sub);
  const derivado = priceId ? planDesdePriceId(priceId) : null;
  if (derivado) {
    plan = derivado.plan;
    ciclo = derivado.ciclo;
  } else if (priceId && !sinAcceso) {
    // Cobrando un precio que no está en el entorno: alguien creó el precio en
    // Stripe y olvidó la variable STRIPE_PRICE_*. Se grita en el log y se
    // conserva el plan anterior; jamás se degrada a alguien que está pagando.
    console.error(
      `[stripe:webhook] price ${priceId} sin plan configurado (revisa las variables STRIPE_PRICE_*). Suscripción ${sub.id}.`
    );
  }

  // Estado que nunca da acceso → plan gratis. Se conserva el ciclo para que la
  // UI pueda decir "tu plan anual venció" en lugar de fingir amnesia.
  if (sinAcceso) plan = "gratis";

  const ahora = new Date();
  const valores = {
    stripeCustomerId: customerId ?? fila?.stripeCustomerId ?? null,
    stripeSubscriptionId: sub.id,
    plan,
    ciclo,
    estado,
    periodoFin,
    cancelaAlFin: opciones.esBorrado
      ? false
      : Boolean(sub.cancel_at_period_end),
    // La marca de agua se mueve SIEMPRE que se escribe, y solo aquí.
    ultimoEventoAt: new Date(eventoCreated * 1000),
    updatedAt: ahora,
  };

  if (fila) {
    await db
      .update(subscriptions)
      .set(valores)
      .where(eq(subscriptions.id, fila.id));
  } else {
    await db.insert(subscriptions).values({
      id: nanoid(21),
      userId,
      createdAt: ahora,
      ...valores,
    });
  }

  // Rastro mínimo en el log para poder auditar el cobro sin abrir la base. No se
  // loguea correo ni nombre: es un log de dinero, no de datos personales.
  console.log(
    `[stripe:webhook] usuario ${userId} → plan ${plan} (${ciclo ?? "sin ciclo"}), estado ${estado}, hasta ${periodoFin?.toISOString() ?? "sin fecha"}.`
  );
}

/**
 * Guarda el `stripe_customer_id` en la fila del usuario (creándola si hace
 * falta) SIN tocar plan ni estado: tener cliente en Stripe no es tener plan.
 * Es lo que permite que /api/stripe/portal funcione después.
 */
async function amarrarCustomer(
  userId: string,
  customerId: string
): Promise<void> {
  const ahora = new Date();
  const fila = await filaDeSuscripcion(userId);
  if (fila) {
    if (fila.stripeCustomerId === customerId) return;
    await db
      .update(subscriptions)
      .set({ stripeCustomerId: customerId, updatedAt: ahora })
      .where(eq(subscriptions.id, fila.id));
    return;
  }
  await db.insert(subscriptions).values({
    id: nanoid(21),
    userId,
    stripeCustomerId: customerId,
    plan: "gratis",
    estado: "ninguna",
    createdAt: ahora,
    updatedAt: ahora,
  });
}

// ─────────────────────────────── LOCALIZADORES ──────────────────────────────

async function filaPorSuscripcion(
  subscriptionId: string
): Promise<FilaSuscripcion | null> {
  if (!subscriptionId) return null;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

async function filaPorCustomer(
  customerId: string
): Promise<FilaSuscripcion | null> {
  if (!customerId) return null;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return rows[0] ?? null;
}

async function usuarioExiste(userId: string): Promise<boolean> {
  if (!userId) return false;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows.length > 0;
}

async function userIdPorCorreo(email: string): Promise<string | null> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return null;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    // lower() en el WHERE: el correo se guarda en minúsculas al registrarse,
    // pero Stripe puede devolverlo como lo escribió el usuario.
    .where(sql`lower(${users.email}) = ${limpio}`)
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * ¿De quién es este evento? En orden de confiabilidad:
 *
 *   1. metadata.userId — lo pusimos nosotros al crear la sesión/suscripción.
 *   2. client_reference_id — igual de nuestro, sobrevive si la metadata se pierde.
 *   3. el customer: primero en nuestra base (ya amarrado), luego preguntándole a
 *      Stripe por su metadata.userId y, si no, por su correo.
 *   4. el correo de la sesión, como último recurso.
 *
 * Todo candidato se VERIFICA contra la tabla `users` antes de devolverlo: meter
 * un userId inexistente rompería la llave foránea de `subscriptions` y el evento
 * se perdería con un error de base de datos.
 */
async function resolverUserId(
  stripe: Stripe,
  pistas: {
    metadataUserId?: string | null;
    clientReferenceId?: string | null;
    customerId?: string | null;
    email?: string | null;
  }
): Promise<string | null> {
  const directos = [pistas.metadataUserId, pistas.clientReferenceId];
  for (const candidato of directos) {
    const id = candidato?.trim();
    if (id && (await usuarioExiste(id))) return id;
  }

  const customerId = pistas.customerId?.trim();
  if (customerId) {
    const fila = await filaPorCustomer(customerId);
    if (fila?.userId && (await usuarioExiste(fila.userId))) return fila.userId;

    try {
      const cliente = await stripe.customers.retrieve(customerId);
      if (!("deleted" in cliente && cliente.deleted)) {
        const metaId = (cliente as Stripe.Customer).metadata?.userId?.trim();
        if (metaId && (await usuarioExiste(metaId))) return metaId;
        const correo = (cliente as Stripe.Customer).email;
        if (correo) {
          const porCorreo = await userIdPorCorreo(correo);
          if (porCorreo) return porCorreo;
        }
      }
    } catch (e) {
      console.error(
        `[stripe:webhook] no se pudo leer el customer ${customerId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (pistas.email) {
    const porCorreo = await userIdPorCorreo(pistas.email);
    if (porCorreo) return porCorreo;
  }

  return null;
}
