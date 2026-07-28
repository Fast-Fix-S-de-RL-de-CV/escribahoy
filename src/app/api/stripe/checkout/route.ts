/**
 * POST /api/stripe/checkout — abre una sesión de pago de Stripe Checkout.
 *
 * Recibe { plan, ciclo } y devuelve { url }. El cliente solo redirige a esa URL;
 * nunca se maneja una tarjeta en nuestro servidor (y por eso el alcance de PCI
 * se queda en Stripe).
 *
 * La verdad del plan la escribe EL WEBHOOK, no esta ruta: aquí no se toca
 * `plan` ni `estado` de la tabla `subscriptions`. Si esta ruta otorgara el plan
 * al crear la sesión, cualquiera que la llamara y abandonara el pago se quedaría
 * con el plan gratis... pero de paga.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PLANES,
  PLANES_PAGADOS,
  stripePriceId,
  type Ciclo,
  type PlanId,
} from "@/lib/plans";
import { suscripcionDe } from "@/lib/subscription";
import { appUrl, asegurarStripeCustomer, getStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CICLOS: Ciclo[] = ["mes", "anual"];

function esPlanPagado(valor: unknown): valor is PlanId {
  return (
    typeof valor === "string" &&
    (PLANES_PAGADOS as string[]).includes(valor)
  );
}

function esCiclo(valor: unknown): valor is Ciclo {
  return typeof valor === "string" && (CICLOS as string[]).includes(valor);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para suscribirte." },
      { status: 401 }
    );
  }

  // Crear sesiones de pago cuesta llamadas a la API de Stripe. 10 por cada 5
  // minutos alcanza de sobra para un humano que cambia de plan o de ciclo, y
  // corta a quien quiera usarnos de ariete contra Stripe.
  const limite = checkRateLimit(`stripe-checkout:${user.id}`, {
    max: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!limite.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "No entendimos la solicitud." },
      { status: 400 }
    );
  }

  const { plan, ciclo } = (body ?? {}) as { plan?: unknown; ciclo?: unknown };

  if (!esPlanPagado(plan)) {
    return NextResponse.json(
      { error: "Ese plan no existe o no se puede contratar." },
      { status: 400 }
    );
  }
  if (!esCiclo(ciclo)) {
    return NextResponse.json(
      { error: "El periodo debe ser mensual o anual." },
      { status: 400 }
    );
  }

  // Ya tiene un plan de paga vigente según NUESTRO espejo: no se crea una
  // segunda suscripción (dos cobros al mismo autor por el mismo servicio). Los
  // cambios de plan se hacen en el portal de facturación, que además prorratea
  // el cobro. Más abajo se le pregunta lo mismo a Stripe, que es la verdad del
  // cobro y se entera antes que nosotros.
  const actual = await suscripcionDe(user.id);
  if (actual.plan !== "gratis") {
    return NextResponse.json(
      {
        error: `Ya tienes el plan ${PLANES[actual.plan].nombre} activo. Cambia o cancela tu plan desde "Administrar mi suscripción".`,
        portal: true,
      },
      { status: 409 }
    );
  }

  const priceId = stripePriceId(plan, ciclo);
  if (!priceId) {
    // El nombre de la variable va al log del servidor (le sirve a quien opera),
    // no a la respuesta: al usuario no le dice nada y expone la configuración.
    console.error(
      `[stripe] falta la variable STRIPE_PRICE_${plan.toUpperCase()}_${
        ciclo === "mes" ? "MES" : "ANUAL"
      }: no se puede cobrar el plan ${plan} (${ciclo}).`
    );
    return NextResponse.json(
      {
        error:
          "Este plan todavía no está disponible para contratar en línea. Escríbenos y lo activamos contigo.",
      },
      { status: 500 }
    );
  }

  const base = appUrl();

  try {
    const stripe = getStripe();

    // Cliente de Stripe reutilizado (o creado). Si no se pudo, seguimos con
    // customer_email: Stripe creará el cliente al completarse el pago y el
    // webhook lo amarra al usuario por client_reference_id / metadata. Perder la
    // venta por no poder pre-crear un cliente sería peor.
    const customerId = await asegurarStripeCustomer({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // ── SEGUNDA PUERTA: preguntarle a STRIPE ────────────────────────────────
    // El espejo local solo se entera cuando llega el webhook. Entre que el
    // usuario termina de pagar y que `checkout.session.completed` /
    // `customer.subscription.created` aterrizan hay segundos (y minutos si
    // Stripe reintenta), y en esa ventana `suscripcionDe()` sigue diciendo
    // "gratis": un doble clic en el botón, un regreso con el botón atrás del
    // navegador o un segundo tab crean una SEGUNDA suscripción y el autor
    // amanece con dos cargos. Stripe sí lo sabe de inmediato, así que se le
    // pregunta a él antes de abrir la caja.
    //
    // Solo se consulta si ya hay customer: sin cliente en Stripe no puede
    // haber una suscripción previa que duplicar. Si la consulta falla, el
    // catch de abajo devuelve el 502 genérico — preferimos no abrir el pago
    // que abrirlo a ciegas.
    if (customerId) {
      const activas = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (activas.data.length > 0) {
        return NextResponse.json(
          {
            error:
              'Ya tienes una suscripción activa. Cambia o cancela tu plan desde "Administrar mi suscripción".',
            portal: true,
          },
          { status: 409 }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // La moneda (MXN) y el IVA incluido viven en el precio de Stripe. No se
      // manda `currency` ni `automatic_tax`: los precios de lista YA traen IVA
      // (Art. 7 Bis LFPC), así que calcular impuesto encima cobraría de más.
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId
        ? { customer: customerId }
        : { customer_email: user.email }),
      // Las DOS formas de saber de quién es este pago, porque el webhook las
      // necesita: client_reference_id sobrevive incluso si alguien limpia la
      // metadata, y la metadata viaja también a la suscripción (los eventos
      // customer.subscription.* NO traen la sesión de pago).
      client_reference_id: user.id,
      metadata: { userId: user.id, plan, ciclo },
      subscription_data: { metadata: { userId: user.id, plan, ciclo } },
      success_url: `${base}/dashboard?suscripcion=ok`,
      cancel_url: `${base}/precios`,
      allow_promotion_codes: true,
      locale: "es",
    });

    if (!session.url) {
      console.error("[stripe] la sesión de pago vino sin url:", session.id);
      return NextResponse.json(
        { error: "No pudimos abrir el pago. Inténtalo de nuevo." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Nunca se loguea el objeto completo del error de Stripe: puede traer la
    // petición con encabezados (y ahí va la llave secreta).
    console.error(
      "[stripe] error creando la sesión de pago:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      {
        error:
          "No pudimos abrir el pago en este momento. Inténtalo de nuevo en un minuto.",
      },
      { status: 502 }
    );
  }
}
