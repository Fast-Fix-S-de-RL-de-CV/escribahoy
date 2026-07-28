/**
 * POST /api/stripe/portal — abre el portal de facturación de Stripe.
 *
 * Ahí el autor cambia de plan, actualiza su tarjeta, descarga sus facturas y
 * cancela. Todo eso vive en Stripe a propósito: replicarlo en nuestra UI sería
 * mantener un segundo sistema de cobros con la mitad de las garantías.
 *
 * Esta ruta NO cambia nada en la base local. Lo que el usuario haga en el portal
 * regresa por el webhook (`customer.subscription.updated` / `deleted`), que es
 * el único que escribe plan y estado.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appUrl, filaDeSuscripcion, getStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para ver tu suscripción." },
      { status: 401 }
    );
  }

  const limite = checkRateLimit(`stripe-portal:${user.id}`, {
    max: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!limite.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSec) } }
    );
  }

  const fila = await filaDeSuscripcion(user.id);
  const customerId = fila?.stripeCustomerId?.trim();

  // Sin cliente en Stripe nunca hubo un cobro: no hay portal que abrir. El
  // mensaje es para el usuario, no para el desarrollador.
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "Todavía no tienes una suscripción de paga. Elige un plan y aquí mismo podrás administrarla.",
      },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/dashboard`,
      locale: "es-419",
    });

    if (!session.url) {
      console.error("[stripe] la sesión del portal vino sin url:", session.id);
      return NextResponse.json(
        { error: "No pudimos abrir tu suscripción. Inténtalo de nuevo." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error(
      "[stripe] error creando la sesión del portal:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      {
        error:
          "No pudimos abrir tu suscripción en este momento. Inténtalo de nuevo en un minuto.",
      },
      { status: 502 }
    );
  }
}
