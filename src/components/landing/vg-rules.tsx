"use client";

import { VgCheck, VgTopbar, VignetteFrame } from "./vignette-frame";

/**
 * Viñeta del módulo 6: tus reglas y tu bitácora.
 *
 * Guion (bucle de 13s): el proyecto arranca bloqueado —falta configuración—,
 * se escriben el glosario y los términos prohibidos, se eligen persona y trato
 * al lector, el aviso ámbar cede su lugar a "Listo para escribir", las reglas
 * se marcan como aplicadas y, a la derecha, la bitácora se llena distinguiendo
 * lo que hizo la IA de lo que hiciste tú.
 *
 * Las dos escenas del spec (Configurar / Historial) se resuelven como dos
 * columnas del mismo marco en vez de un crossfade a pantalla completa: un
 * crossfade de escena entera dejaría ambas superpuestas para quien pide
 * movimiento reducido. Los cambios de estado sí usan el par swap, con la capa
 * final encima y opaca, así el estado en reposo es el estado final.
 *
 * Los cortes responsivos son container queries (`@md`, `@2xl`) porque el marco
 * vive dentro de una fila zigzag: mide ~520px aunque la ventana sea de 1440.
 */
export function VgRules() {
  return (
    <VignetteFrame
      loopMs={13000}
      label="Configuración de reglas de escritura de EscribaHoy —glosario, términos a evitar, persona narrativa— junto al historial de cambios que distingue lo que hizo la IA de lo que hiciste tú."
      className="mx-auto w-full max-w-[1120px]"
    >
      <VgTopbar
        title="Manual de ventas directas"
        meta="Libro · Negocios 15.2×22.9cm · 320 pp"
        right={
          <>
            <span className="hidden items-center gap-1.5 text-[10px] text-[var(--color-fg-subtle)] @md:flex">
              <span
                className="vg-odo font-medium text-[var(--color-fg-muted)]"
                style={{ ["--dur" as string]: "0.5s", ["--d" as string]: "3.7s", ["--stops" as string]: 1 }}
              >
                <span>4/6</span>
                <span>6/6</span>
              </span>
              campos base
            </span>
            <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] @md:block">
              <span
                className="vg-fill block h-full w-full rounded-full bg-[var(--color-accent)]"
                style={{
                  ["--from" as string]: "66%",
                  ["--to" as string]: "100%",
                  ["--dur" as string]: "0.6s",
                  ["--d" as string]: "3.7s",
                }}
              />
            </span>
          </>
        }
      />

      <div className="flex h-[300px] text-[11px] @md:h-[340px]">
        {/* Configurar: las reglas que viajan en todos los prompts */}
        <div className="min-w-0 flex-1 overflow-hidden px-3.5 py-3 @2xl:px-5">
          <div className="vg-in flex items-center gap-2" style={{ ["--d" as string]: "0.1s" }}>
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]">
              <IconSliders />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold leading-tight">Configurar proyecto</span>
              <span className="block truncate text-[9px] leading-tight text-[var(--color-fg-subtle)]">
                Estilo avanzado · entra en todos los prompts
              </span>
            </span>
          </div>

          {/* El candado: aviso ámbar → listo para escribir */}
          <div className="relative mt-2 h-[44px]">
            <div
              className="vg-swap-out absolute inset-0 flex items-start gap-1.5 overflow-hidden rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-1.5 text-[var(--color-warning)]"
              style={{ ["--d" as string]: "3.6s" }}
            >
              <span className="mt-px flex-shrink-0">
                <IconAlert />
              </span>
              <span className="min-w-0 text-[10px] leading-snug">
                <strong className="font-semibold">Configura tu proyecto antes de que la IA escriba.</strong>{" "}
                Faltan: Audiencia, Persona narrativa.
              </span>
            </div>
            <div
              className="vg-swap-in relative z-10 flex h-full items-center gap-2 overflow-hidden rounded-md border border-[var(--color-success)]/30 bg-[var(--color-bg-elevated)] px-2 py-1.5"
              style={{ ["--d" as string]: "3.9s" }}
            >
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[9px] font-semibold text-[var(--color-success)]">
                <VgCheck className="h-2.5 w-2.5" />
                Listo para escribir
              </span>
              <span className="min-w-0 text-[10px] leading-snug text-[var(--color-fg-muted)]">
                Tus reglas viajan en cada llamada.
              </span>
            </div>
          </div>

          {/* Glosario obligatorio y términos a evitar */}
          <div className="mt-2 grid gap-1.5 @2xl:grid-cols-2">
            <RuleField
              label="Glosario obligatorio"
              text="Lighthouse (no faro), CAC en mayúsculas"
              delay="0.8s"
              steps={39}
            />
            <RuleField
              label="Términos a evitar"
              text="sinergia, disruptivo, lead magnet"
              delay="1.7s"
              steps={33}
              caret
            />
          </div>

          {/* Persona narrativa y trato al lector: de "— elegir —" a activo */}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <ChoiceCard label="Persona narrativa" value="2ª persona (tú al lector)" outDelay="2.2s" inDelay="2.35s" />
            <ChoiceCard label="Trato al lector" value="Tú (informal)" outDelay="2.6s" inDelay="2.75s" />
          </div>

          {/* La regla ya está viajando en cada ruta de IA */}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] text-[var(--color-fg-subtle)]">
            <span>Aplicado a</span>
            {["temario", "sugerencias", "accesorios"].map((chip, i) => (
              <span
                key={chip}
                className="vg-pop rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-accent)]"
                style={{ ["--d" as string]: `${4.4 + i * 0.15}s` }}
              >
                {chip}
              </span>
            ))}
          </div>

          <div
            className="vg-in mt-2 hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-2 py-1 @md:block"
            style={{ ["--d" as string]: "5s" }}
          >
            <div className="text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Lo que se envía en cada llamada
            </div>
            <div className="mt-px overflow-hidden whitespace-nowrap font-mono text-[9px] leading-snug text-[var(--color-fg-muted)]">
              <span className="vg-type" style={{ ["--d" as string]: "5.15s", ["--steps" as string]: 42 }}>
                TÉRMINOS A EVITAR (NO los uses): sinergia…
              </span>
            </div>
          </div>
        </div>

        {/* Bitácora: quién tocó qué, con fecha y autor */}
        <div className="hidden w-[236px] flex-shrink-0 flex-col border-l border-[var(--color-border)] @md:flex @2xl:w-[258px]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]">
              <IconHistory />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold leading-tight">Historial de cambios</span>
              <span className="block truncate text-[9px] leading-tight text-[var(--color-fg-subtle)]">
                Tú y la IA, en orden cronológico
              </span>
            </span>
          </div>

          <div className="border-b border-[var(--color-border)] px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Hoy
          </div>

          <div className="flex-1 divide-y divide-[var(--color-border)] overflow-hidden">
            <LogRow
              actor="ai"
              text="Añadió 312 palabras a Errores de precio"
              kind="Agregar contenido"
              time="hace 2 min"
              delay="5.8s"
            />
            <LogRow actor="user" text="Marcó como completo" kind="Estado" time="hace 8 min" delay="6.12s" />
            <LogRow
              actor="ai"
              text="Renombró «Introducción» → «Por qué fracasan las ofertas»"
              kind="Renombrar"
              time="hace 14 min"
              delay="6.44s"
            />
            <LogRow actor="ai" text="Insertó frase destacada" kind="Accesorio" time="hace 20 min" delay="6.76s" />
            <LogRow
              actor="user"
              text="Actualizó la configuración"
              kind="Configuración"
              time="hace 26 min"
              delay="7.08s"
            />
            <LogRow actor="ai" text="Dejó idea en Capítulo 5" kind="Sugerencia" time="hace 31 min" delay="7.4s" />
          </div>
        </div>
      </div>

      <div
        className="vg-toast pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-fg)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-bg)] shadow-md"
        style={{ ["--d" as string]: "8.2s" }}
      >
        Todo queda registrado
      </div>
    </VignetteFrame>
  );
}

/** Campo de texto de "Estilo avanzado" escribiéndose solo. */
function RuleField({
  label,
  text,
  delay,
  steps,
  caret,
}: {
  label: string;
  text: string;
  delay: string;
  steps: number;
  caret?: boolean;
}) {
  return (
    <div className="vg-in min-w-0" style={{ ["--d" as string]: "0.4s" }}>
      <div className="text-[9px] font-medium leading-tight text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-0.5 flex items-center overflow-hidden whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1 text-[10px] leading-snug">
        <span className="min-w-0 max-w-full">
          <span className="vg-type" style={{ ["--d" as string]: delay, ["--steps" as string]: steps }}>
            {text}
          </span>
        </span>
        {caret ? <span className="vg-caret ml-px h-[0.9em] flex-shrink-0" /> : null}
      </div>
    </div>
  );
}

/**
 * Tarjeta seleccionable: la capa inactiva va detrás y se va; la activa —que es
 * el estado final y opaco— queda encima. Sin animación se ve ya seleccionada.
 */
function ChoiceCard({
  label,
  value,
  outDelay,
  inDelay,
}: {
  label: string;
  value: string;
  outDelay: string;
  inDelay: string;
}) {
  return (
    <div className="relative min-w-0">
      <div
        className="vg-swap-out absolute inset-0 overflow-hidden rounded-md border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5"
        style={{ ["--d" as string]: outDelay }}
      >
        <div className="truncate text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
          {label}
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-[var(--color-fg-subtle)]">— elegir —</div>
      </div>
      <div
        className="vg-swap-in relative z-10 rounded-md border-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-1.5"
        style={{ ["--d" as string]: inDelay }}
      >
        <div className="flex items-center justify-between gap-1 text-[8px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          <span className="truncate">{label}</span>
          <VgCheck className="h-2.5 w-2.5 flex-shrink-0" />
        </div>
        <div className="mt-0.5 text-[10px] font-medium leading-snug text-[var(--color-fg)]">{value}</div>
      </div>
    </div>
  );
}

/** Fila del historial, con la misma anatomía que ChangeRow del producto. */
function LogRow({
  actor,
  text,
  kind,
  time,
  delay,
}: {
  actor: "ai" | "user";
  text: string;
  kind: string;
  time: string;
  delay: string;
}) {
  const isAI = actor === "ai";
  return (
    <div className="vg-in flex items-start gap-2 px-3 py-1.5" style={{ ["--d" as string]: delay }}>
      <span
        className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-md ${
          isAI
            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]"
        }`}
      >
        {isAI ? <IconSparkles /> : <IconUser />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] leading-snug">{text}</span>
        <span className="mt-px block text-[9px] leading-tight text-[var(--color-fg-subtle)]">
          {kind} · {time}
        </span>
      </span>
    </div>
  );
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 6h9M18.5 6H20M4 12h3.5M13 12h7M4 18h9M18.5 18H20" strokeLinecap="round" />
      <circle cx="15.5" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="15.5" cy="18" r="2" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M10.3 4 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9.5v4M12 17.2h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M3.2 12a8.8 8.8 0 1 0 2.6-6.2L3 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4.2v4.3h4.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.6V12l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3" aria-hidden="true">
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3" aria-hidden="true">
      <path d="M20 21v-1.8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V21" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7.5" r="3.8" />
    </svg>
  );
}
