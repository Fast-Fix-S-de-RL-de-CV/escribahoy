/**
 * /precios — página pública de planes.
 *
 * Server Component: lee la sesión (si hay) y la suscripción vigente para poder
 * marcar "Tu plan actual" y ofrecer el portal de facturación. Se puede ver sin
 * iniciar sesión a propósito: es una página de venta, y obligar a registrarse
 * antes de ver el precio es la forma más rápida de perder al visitante.
 *
 * Los planes se aplanan aquí (precio, ahorro, equivalente mensual) para que el
 * componente cliente no tenga que importar src/lib/plans.ts en el navegador.
 * Ver el comentario de planes-cliente.tsx.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { suscripcionDe } from "@/lib/subscription";
import {
  ORDEN_PLANES,
  PLANES,
  ahorroAnual,
  mensualEquivalente,
  planPorId,
} from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import {
  PlanesCliente,
  type AvisoSuscripcion,
  type PlanVista,
} from "./planes-cliente";

export const metadata: Metadata = {
  title: "Precios — EscribaHoy",
  description:
    "Empieza gratis y sin tarjeta. Planes desde 249 pesos al mes, en pesos mexicanos con IVA incluido, para terminar tu libro o tu curso.",
};

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

export default async function PreciosPage() {
  const user = await getCurrentUser();
  const suscripcion = user ? await suscripcionDe(user.id) : null;

  const planes: PlanVista[] = ORDEN_PLANES.map((id) => {
    const plan = PLANES[id];
    const ahorro = ahorroAnual(plan);
    return {
      id: plan.id,
      nombre: plan.nombre,
      paraQuien: plan.paraQuien,
      precioMensual: plan.precioMensual,
      precioAnual: plan.precioAnual,
      equivalenteMensual:
        plan.precioAnual > 0 ? mensualEquivalente(plan) : 0,
      ahorroPesos: ahorro.pesos,
      ahorroPct: ahorro.pct,
      incluye: plan.incluye,
      noIncluye: plan.noIncluye,
      destacado: Boolean(plan.destacado),
    };
  });

  // El aviso de "administrar mi suscripción" solo aplica a quien tiene plan de
  // paga vigente. `suscripcionDe` ya devuelve 'gratis' cuando el estado dejó de
  // dar acceso, así que esta condición es exactamente "hoy está pagando".
  const aviso: AvisoSuscripcion | null =
    suscripcion && suscripcion.plan !== "gratis"
      ? {
          nombrePlan: planPorId(suscripcion.plan).nombre,
          hasta: suscripcion.periodoFin
            ? FECHA_LARGA.format(suscripcion.periodoFin)
            : null,
          cancelaAlFin: suscripcion.cancelaAlFin,
          estado: suscripcion.estado,
        }
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <Link href="/" className="flex items-center">
          <Logo size={34} wordmarkClassName="text-xl" />
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard">
              <Button variant="ghost">Ir al dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Iniciar sesión</Button>
              </Link>
              <Link href="/register">
                <Button>Empezar gratis</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        <PlanesCliente
          planes={planes}
          planActual={suscripcion?.plan ?? null}
          haySesion={Boolean(user)}
          aviso={aviso}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
