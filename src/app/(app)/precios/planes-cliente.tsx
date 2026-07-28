"use client";

/**
 * Tarjetas de precios (parte interactiva).
 *
 * Recibe los planes YA aplanados desde el Server Component: este archivo NO
 * importa src/lib/plans.ts en tiempo de ejecución a propósito. Ese módulo lee
 * `process.env[...]` de forma dinámica en `stripePriceId()`, y eso no sobrevive
 * al bundle del navegador (Next solo sustituye accesos estáticos a process.env).
 * Los tipos sí se importan, porque los tipos desaparecen al compilar.
 */

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  CreditCardIcon,
  Loader2Icon,
  MinusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Ciclo, PlanId } from "@/lib/plans";

export type PlanVista = {
  id: PlanId;
  nombre: string;
  paraQuien: string;
  /** Con IVA incluido, en pesos. 0 = gratis. */
  precioMensual: number;
  precioAnual: number;
  /** Equivalente mensual del anual (mercadotecnia). 0 en el plan gratis. */
  equivalenteMensual: number;
  ahorroPesos: number;
  ahorroPct: number;
  incluye: string[];
  noIncluye: string[];
  destacado: boolean;
};

export type AvisoSuscripcion = {
  nombrePlan: string;
  /** Ya formateada en el servidor ("15 de agosto de 2026"), o null. */
  hasta: string | null;
  cancelaAlFin: boolean;
  /** Estado tal como lo reporta Stripe ('active', 'past_due', …). */
  estado: string;
};

const PESOS = new Intl.NumberFormat("es-MX");

/** La leyenda que exige el Art. 7 Bis de la LFPC. Literal, sin adornos. */
const LEYENDA_IVA = "Precios en pesos mexicanos, IVA incluido.";

function precio(n: number): string {
  return `$${PESOS.format(n)}`;
}

export function PlanesCliente({
  planes,
  planActual,
  haySesion,
  aviso,
}: {
  planes: PlanVista[];
  /** Plan vigente del visitante, o null si no hay sesión (así nadie ve "Tu plan actual" sin haber entrado). */
  planActual: PlanId | null;
  haySesion: boolean;
  aviso: AvisoSuscripcion | null;
}) {
  const [ciclo, setCiclo] = useState<Ciclo>("mes");
  // Qué botón está trabajando: el id del plan, "portal", o nada.
  const [cargando, setCargando] = useState<PlanId | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function abrir(
    ruta: string,
    cuerpo: Record<string, string> | null,
    quien: PlanId | "portal"
  ) {
    setError(null);
    setCargando(quien);
    try {
      const res = await fetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo ?? {}),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        setError(
          data?.error ??
            "No pudimos abrir el pago en este momento. Inténtalo de nuevo."
        );
        setCargando(null);
        return;
      }
      // Stripe vive en otro dominio: navegación completa, no router.push. El
      // estado de carga se queda encendido a propósito hasta que el navegador
      // cambie de página.
      window.location.href = data.url;
    } catch {
      setError(
        "No pudimos conectar con el cobro. Revisa tu conexión e inténtalo de nuevo."
      );
      setCargando(null);
    }
  }

  const anual = ciclo === "anual";

  // Etiqueta del anual DERIVADA de los precios, no escrita a mano: si mañana
  // cambia el descuento en plans.ts, este texto cambia solo en vez de mentir.
  const pagados = planes.filter((p) => p.precioMensual > 0);
  const mesesGratis = pagados.length
    ? Math.floor(
        Math.min(...pagados.map((p) => p.ahorroPesos / p.precioMensual))
      )
    : 0;
  const etiquetaAnual =
    mesesGratis >= 1
      ? `${mesesGratis} ${mesesGratis === 1 ? "mes" : "meses"} gratis`
      : `Ahorra hasta ${Math.max(...pagados.map((p) => p.ahorroPct), 0)}%`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          El precio de terminarlo
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[var(--color-fg-muted)]">
          Empieza gratis y sin tarjeta. Cuando decidas que este libro va en
          serio, sube de plan; puedes cancelar cuando quieras.
        </p>
      </div>

      {aviso && (
        <Card className="mx-auto mt-8 max-w-3xl border-[var(--color-accent)]">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <CreditCardIcon className="h-4 w-4 text-[var(--color-accent)]" />
                {aviso.estado === "past_due"
                  ? `Tu plan ${aviso.nombrePlan} tiene un cobro pendiente`
                  : `Tu plan ${aviso.nombrePlan} está activo`}
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {aviso.estado === "past_due"
                  ? "Tu último cobro no pasó. Actualiza tu tarjeta para no perder el acceso cuando termine el periodo pagado."
                  : aviso.cancelaAlFin
                    ? aviso.hasta
                      ? `Cancelaste la renovación: tu acceso llega hasta el ${aviso.hasta}.`
                      : "Cancelaste la renovación: tu acceso llega hasta el final del periodo pagado."
                    : aviso.hasta
                      ? `Se renueva el ${aviso.hasta}.`
                      : "Se renueva automáticamente."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => abrir("/api/stripe/portal", null, "portal")}
              disabled={cargando !== null}
            >
              {cargando === "portal" ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Abriendo
                </>
              ) : (
                <>
                  Administrar mi suscripción
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Segmented control mensual / anual. Botones, nunca un select nativo. */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label="Periodo de facturación"
          className="inline-flex rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-1"
        >
          <button
            type="button"
            aria-pressed={!anual}
            onClick={() => setCiclo("mes")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-colors",
              !anual
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            )}
          >
            Mensual
          </button>
          <button
            type="button"
            aria-pressed={anual}
            onClick={() => setCiclo("anual")}
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors",
              anual
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            )}
          >
            Anual
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                anual
                  ? "bg-white/20 text-white"
                  : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              )}
            >
              {etiquetaAnual}
            </span>
          </button>
        </div>
        <p className="text-sm font-medium text-[var(--color-fg-muted)]">
          {LEYENDA_IVA}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-auto mt-8 flex max-w-3xl items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-10 grid gap-5 lg:grid-cols-4">
        {planes.map((plan) => {
          const esGratis = plan.precioMensual === 0 && plan.precioAnual === 0;
          const esActual = plan.id === planActual;
          const monto = anual ? plan.precioAnual : plan.precioMensual;

          return (
            <Card
              key={plan.id}
              className={cn(
                "flex h-full flex-col",
                plan.destacado &&
                  "border-[var(--color-accent)] shadow-[0_8px_30px_rgba(13,148,136,0.12)] ring-1 ring-[var(--color-accent)]"
              )}
            >
              <CardBody className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold leading-tight">
                    {plan.nombre}
                  </h2>
                  {plan.destacado && <Badge variant="accent">El más elegido</Badge>}
                </div>

                <p className="mt-2 min-h-[4.5rem] text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {plan.paraQuien}
                </p>

                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  {esGratis ? (
                    <>
                      <div className="text-3xl font-semibold">Gratis</div>
                      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                        Sin tarjeta y sin fecha de caducidad.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-semibold">
                          {precio(monto)}
                        </span>
                        <span className="text-sm text-[var(--color-fg-muted)]">
                          {anual ? "al año" : "al mes"}
                        </span>
                      </div>
                      {anual ? (
                        <p className="mt-1 text-sm text-[var(--color-accent)]">
                          Equivale a {precio(plan.equivalenteMensual)} al mes.
                          Ahorras {precio(plan.ahorroPesos)} ({plan.ahorroPct}%).
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                          O {precio(plan.precioAnual)} al año y ahorras{" "}
                          {precio(plan.ahorroPesos)}.
                        </p>
                      )}
                      {/* Art. 7 Bis LFPC: el monto total a pagar, con impuestos,
                          a la vista junto al precio. */}
                      <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
                        {LEYENDA_IVA}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 text-sm">
                  {plan.incluye.map((linea) => (
                    <li key={linea} className="flex gap-2">
                      <CheckIcon
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-accent)]"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{linea}</span>
                    </li>
                  ))}
                  {plan.noIncluye.map((linea) => (
                    <li
                      key={linea}
                      className="flex gap-2 text-[var(--color-fg-subtle)]"
                    >
                      <MinusIcon
                        className="mt-0.5 h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{linea}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex-1" />

                <BotonPlan
                  plan={plan}
                  esGratis={esGratis}
                  esActual={esActual}
                  haySesion={haySesion}
                  cargando={cargando}
                  onSuscribir={() =>
                    abrir("/api/stripe/checkout", { plan: plan.id, ciclo }, plan.id)
                  }
                />
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* ── ANCLA DE VALOR ────────────────────────────────────────────────────
          Las dos cifras son las del mercado mexicano y son las únicas que se
          citan aquí. No se inventan otras. */}
      <section className="mx-auto mt-14 max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-7">
        <h2 className="text-xl font-semibold">
          Con qué compararlo, honestamente
        </h2>
        <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">
          Contratar a un ghostwriter en México cuesta entre 15,000 y 45,000
          pesos, y publicar bien (edición, corrección, portada, formato) ronda
          los 20,000. Esa es la referencia real de este mercado, no una
          suscripción de software.
        </p>
        <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">
          EscribaHoy no reemplaza a un editor humano ni promete un bestseller:
          organiza tus ideas, te sugiere qué escribir en cada sección y te
          acompaña hasta que el libro exista. Lo escribes tú, con tu voz. Si eso
          te sirve, un año del plan Autor cuesta una fracción de cualquiera de
          las dos cifras de arriba.
        </p>
      </section>

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-[var(--color-fg-muted)]">
        Los límites de cada plan son mensuales y se reinician el día 1. Están
        ahí porque cada acción de la IA cuesta dinero real: preferimos límites
        claros a vender &quot;ilimitado&quot; y luego apagarlo.{" "}
        <Link
          href="/terminos"
          className="font-medium text-[var(--color-accent)] hover:underline"
        >
          Términos y condiciones
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Botón de cada tarjeta. El orden de las reglas importa:
 *   1. Es el plan que ya tiene  → deshabilitado, "Tu plan actual".
 *   2. Es el plan gratis        → enlace (a /onboarding con sesión, a /register
 *                                 sin ella, porque /onboarding exige sesión).
 *   3. Cualquier otro           → sesión de pago de Stripe. Sin sesión, primero
 *                                 hay que crear la cuenta.
 */
function BotonPlan({
  plan,
  esGratis,
  esActual,
  haySesion,
  cargando,
  onSuscribir,
}: {
  plan: PlanVista;
  esGratis: boolean;
  esActual: boolean;
  haySesion: boolean;
  cargando: PlanId | "portal" | null;
  onSuscribir: () => void;
}) {
  if (esActual) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        Tu plan actual
      </Button>
    );
  }

  if (esGratis) {
    return (
      <Link href={haySesion ? "/onboarding" : "/register"} className="block">
        <Button variant="outline" className="w-full">
          Empezar gratis
        </Button>
      </Link>
    );
  }

  if (!haySesion) {
    return (
      <Link href="/register" className="block">
        <Button
          variant={plan.destacado ? "primary" : "outline"}
          className="w-full"
        >
          Crear cuenta y suscribirme
        </Button>
      </Link>
    );
  }

  const ocupado = cargando === plan.id;
  return (
    <Button
      variant={plan.destacado ? "primary" : "outline"}
      className="w-full"
      onClick={onSuscribir}
      disabled={cargando !== null}
    >
      {ocupado ? (
        <>
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Abriendo el pago
        </>
      ) : (
        <>
          Elegir {plan.nombre}
          <ArrowRightIcon className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
