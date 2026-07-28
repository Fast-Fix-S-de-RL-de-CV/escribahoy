/**
 * Cliente de Stripe (lado servidor) y utilidades del cobro.
 *
 * ── POR QUÉ PEREZOSO Y CACHEADO ──────────────────────────────────────────────
 * Mismo patrón que src/lib/db.ts: el cliente se crea la primera vez que alguien
 * lo pide y se guarda en `globalThis`. Dos razones concretas:
 *
 *   1. NO se crea al importar el módulo. Si `new Stripe(...)` corriera en el
 *      import, cualquier archivo que importe algo de aquí (la página de precios,
 *      por ejemplo) reventaría el build cuando STRIPE_SECRET_KEY no está en el
 *      entorno — y el build de Next SÍ evalúa los módulos. Con la función
 *      perezosa, la app arranca sin Stripe y solo falla quien intenta cobrar.
 *   2. El hot-reload de `next dev` recompila y vuelve a evaluar los módulos en
 *      cada cambio; sin la caché en globalThis se acumularían clientes (cada uno
 *      con su pool de conexiones HTTP) hasta agotar sockets.
 *
 * ── LA LLAVE NUNCA SE LOGUEA ────────────────────────────────────────────────
 * Ni completa ni en fragmentos ni en un mensaje de error. El repo es público y
 * los logs se comparten al depurar. Si falta, el error dice QUÉ variable falta,
 * nunca qué valor traía.
 *
 * ── SIN apiVersion EXPLÍCITA ────────────────────────────────────────────────
 * A propósito: se usa la versión que trae fijada `stripe@22`, que es la que
 * corresponde a los tipos de TypeScript instalados. Escribir a mano una versión
 * distinta de la de los tipos es la receta clásica para que el código compile y
 * en tiempo de ejecución falten campos (en esta versión, por ejemplo,
 * `current_period_end` ya NO vive en la suscripción sino en sus items).
 */

import Stripe from "stripe";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db";
import { subscriptions, type Subscription } from "./schema";

const globalForStripe = globalThis as unknown as {
  escribahoyStripe?: Stripe;
};

/** Dominio de producción, para cuando APP_URL no está configurada. */
const DEFAULT_APP_URL = "https://escribahoy.com";

/**
 * Cliente de Stripe listo para usar. Lanza si falta la llave secreta: quien lo
 * llame debe atrapar el error y devolver un 500 con mensaje claro, porque sin
 * llave no hay nada que hacer más que arreglar el entorno.
 */
export function getStripe(): Stripe {
  const cached = globalForStripe.escribahoyStripe;
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta STRIPE_SECRET_KEY en el entorno del servidor: el cobro está sin configurar."
    );
  }

  const stripe = new Stripe(key, {
    appInfo: { name: "EscribaHoy", url: "https://escribahoy.com" },
    // Reintentos ante fallas de red/5xx. El SDK manda una llave de idempotencia
    // propia en cada reintento, así que un timeout no puede crear dos sesiones
    // de pago ni dos clientes.
    maxNetworkRetries: 2,
    timeout: 20_000,
  });

  globalForStripe.escribahoyStripe = stripe;
  return stripe;
}

/**
 * ¿Está configurado el cobro? Sirve para que la UI decida sin provocar una
 * excepción (p. ej. la página de precios en un entorno local sin Stripe).
 * No revela nada de la llave, solo si existe.
 */
export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Base absoluta del sitio para las URLs de retorno de Stripe (success_url,
 * cancel_url, return_url). Stripe EXIGE absolutas.
 *
 * Misma lógica que `appUrl()` de src/lib/actions/auth.ts: si APP_URL no viene,
 * en producción se apunta al dominio real y en desarrollo a localhost, para no
 * mandar a un usuario de dev al sitio de producción después de pagar.
 */
export function appUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production"
    ? DEFAULT_APP_URL
    : "http://localhost:3000";
}

/**
 * Fin del periodo pagado de una suscripción, en Date.
 *
 * ⚠️ En la versión de la API que fija `stripe@22`, `current_period_end` YA NO
 * está en el objeto Subscription: vive en cada SubscriptionItem. Leer
 * `sub.current_period_end` compilaría como `any` en JS y daría `undefined` en
 * producción, dejando `periodo_fin` en NULL — y con NULL, `suscripcionDe()`
 * falla cerrado y le quita el acceso a alguien que sí pagó.
 *
 * Se toma el MÁXIMO de los items: si un día hubiera varios (un extra facturado
 * aparte), el acceso debe durar hasta el último periodo pagado.
 */
export function finDePeriodo(sub: Stripe.Subscription): Date | null {
  const fines = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (fines.length === 0) return null;
  return new Date(Math.max(...fines) * 1000);
}

/**
 * Price ID del primer item de la suscripción: es de donde se deriva el plan con
 * `planDesdePriceId()`. Nunca confiamos en la metadata para decidir el plan (el
 * usuario podría haber cambiado de precio desde el portal de facturación, y ahí
 * la metadata de la sesión de pago original ya miente). El precio es lo que
 * Stripe está cobrando de verdad.
 */
export function priceIdDe(sub: Stripe.Subscription): string | null {
  for (const item of sub.items?.data ?? []) {
    const id = item.price?.id;
    if (id) return id;
  }
  return null;
}

/** Extrae el id de un campo que Stripe manda como string o como objeto expandido. */
export function idDe(
  valor: string | { id?: string } | null | undefined
): string | null {
  if (!valor) return null;
  if (typeof valor === "string") return valor.trim() || null;
  return valor.id?.trim() || null;
}

/**
 * Fila local de suscripción del usuario. Si por un evento duplicado hubiera más
 * de una, manda la última que se escribió — el mismo criterio que usa
 * `suscripcionDe()` en src/lib/subscription.ts, para que la UI y el cobro nunca
 * miren filas distintas.
 */
export async function filaDeSuscripcion(
  userId: string
): Promise<Subscription | null> {
  if (!userId) return null;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Guarda el `stripe_customer_id` del usuario, creando la fila si no existía.
 * La fila nace en plan gratis / estado 'ninguna': tener cliente en Stripe no es
 * tener suscripción. Quien otorga el plano es el webhook, nunca esta función.
 */
async function guardarCustomerId(
  userId: string,
  customerId: string
): Promise<void> {
  const ahora = new Date();
  const fila = await filaDeSuscripcion(userId);
  if (fila) {
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

/**
 * Customer de Stripe del usuario: reutiliza el guardado o crea uno nuevo.
 *
 * REUTILIZAR IMPORTA: si cada intento de pago creara un cliente nuevo, el mismo
 * autor acabaría con varios clientes, cada uno con su método de pago y su
 * historial, y el portal de facturación solo le mostraría uno. Antes de
 * reutilizar se VERIFICA contra Stripe, porque un id guardado puede haber sido
 * borrado en el dashboard, o venir de las llaves de prueba mientras el servidor
 * ya corre con las de producción (ahí Stripe responde "No such customer" y la
 * sesión de pago fallaría en la cara del usuario).
 *
 * Devuelve null si Stripe no está configurado o si la creación falla: quien
 * llama debe poder seguir con `customer_email` en lugar de perder la venta.
 * Nunca lanza.
 */
export async function asegurarStripeCustomer(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string | null> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return null;
  }

  const fila = await filaDeSuscripcion(user.id);
  const guardado = fila?.stripeCustomerId?.trim();

  if (guardado) {
    try {
      const cliente = await stripe.customers.retrieve(guardado);
      const borrado = "deleted" in cliente && cliente.deleted === true;
      if (!borrado) return guardado;
    } catch {
      // Id inservible (borrado, o de otro modo de llaves): se crea uno nuevo.
    }
  }

  try {
    const cliente = await stripe.customers.create({
      email: user.email,
      name: user.name,
      // Para poder rastrear del lado de Stripe a quién pertenece cada cliente,
      // y para que el webhook pueda resolver el usuario incluso si la fila local
      // se perdiera.
      metadata: { userId: user.id },
      preferred_locales: ["es-419", "es"],
    });
    await guardarCustomerId(user.id, cliente.id);
    return cliente.id;
  } catch (e) {
    console.error(
      "[stripe] no se pudo crear el customer:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
