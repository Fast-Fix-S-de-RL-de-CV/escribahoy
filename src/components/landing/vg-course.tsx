"use client";

import { VgCursor, VgSpinner, VgTopbar, VignetteFrame } from "./vignette-frame";

/**
 * Viñeta del modo curso: "Lección → guión → cámara".
 *
 * Guion (bucle de 13s): una lección ya escrita, el autor pulsa "Generar
 * guión", la IA reformula su texto en frases cortas, y el mismo guión se abre
 * en el teleprompter a pantalla completa y sube solo mientras se graba.
 *
 * Las dos escenas viven apiladas: la escena negra es un overlay opaco que
 * cubre TODO el marco y cuyo estado base (sin animación) es visible. Por eso
 * quien pide movimiento reducido —o quien ve la viñeta fuera de pantalla— ve
 * el teleprompter terminado con el guión puesto, nunca una caja vacía.
 *
 * Todo es UI real del producto: el badge "2.3 · Lección", el botón
 * Teleprompter del encabezado, el panel "Guión para teleprompter" con su botón
 * Generar/Regenerar, y la barra de controles del teleprompter con velocidad
 * (10-200) y tamaño de letra (24-96).
 */

/** Guión corto que la IA devuelve para la lección (líneas de máx. 12 palabras). */
const SCRIPT_LINES = [
  "Hay un momento en toda venta.",
  "El cliente deja de hablar.",
  "Ahí se decide todo.",
  "No lo llenes con un descuento.",
  "Cuenta tres segundos en silencio.",
  "Deja que la duda salga sola.",
  "En la siguiente lección: qué responder.",
];

/** El mismo guión, ya en la columna que sube en el teleprompter. */
const TELEPROMPTER_LINES = [
  "Hay un momento en toda venta.",
  "El cliente deja de hablar.",
  "Ahí se decide todo.",
  "No lo llenes con un descuento.",
  "Cuenta tres segundos en silencio.",
  "Deja que la duda salga sola.",
  "Casi siempre la objeción sale sola.",
  "Escúchala completa, sin interrumpir.",
  "Repítela con tus propias palabras.",
  "Pregunta si entendiste bien.",
  "Hasta entonces, responde.",
  "En la siguiente lección: qué responder.",
];

function IconRotate({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6 4.5 19 12 6 19.5V4.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowLeft({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M19 12H5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12 19-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMinus({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

const STEPPER = "hidden items-center rounded border border-white/15 px-1.5 py-1 text-white/60 sm:inline-flex";

export function VgCourse() {
  return (
    <VignetteFrame
      loopMs={13000}
      label="Una lección escrita de un curso se convierte en guión hablado y el guión se abre en el teleprompter a pantalla completa."
      className="mx-auto w-full max-w-[560px]"
    >
      {/* ---------- Escena A: el editor de la lección ---------- */}
      <VgTopbar
        title="Cierra sin presionar"
        meta="Curso · 6 módulos · 24 lecciones"
        right={
          <span
            className="vg-pop rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-accent)]"
            style={{ ["--d" as string]: "0.25s" }}
          >
            Modo curso
          </span>
        }
      />

      <div className="relative flex h-[340px] flex-col overflow-hidden text-[11px]">
        {/* Editor de la lección */}
        <div className="min-h-0 flex-1 px-3.5 py-3">
          <div className="vg-in flex items-center gap-2" style={{ ["--d" as string]: "0.1s" }}>
            <span className="flex items-center gap-1 rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">
              <span className="font-mono">2.3</span>
              <span className="text-[var(--color-fg-subtle)]">·</span>
              Lección
            </span>
            <span
              className="vg-press ml-auto flex flex-shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-fg-muted)]"
              style={{ ["--d" as string]: "5.25s" }}
            >
              <IconPlay className="h-2.5 w-2.5" />
              Teleprompter
            </span>
          </div>

          <h3
            className="vg-in mt-1.5 truncate font-serif text-[15px] font-semibold tracking-tight"
            style={{ ["--d" as string]: "0.18s" }}
          >
            El silencio del cliente
          </h3>

          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
            <span className="vg-in" style={{ ["--d" as string]: "0.26s" }}>
              412 / 600 palabras
            </span>
            <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] sm:block">
              <span className="block h-full w-[69%] rounded-full bg-[var(--color-accent)]" />
            </span>
          </div>

          <div className="mt-1.5 space-y-1 font-serif text-[12px] leading-snug text-[var(--color-fg)]">
            {[
              { t: "En toda venta llega un momento incómodo: el cliente", d: "0.34s" },
              { t: "se queda callado y tú sientes que perdiste el trato.", d: "0.42s" },
              { t: "Ese silencio no es un no; es la objeción tomando forma.", d: "0.5s" },
            ].map((line) => (
              <p key={line.t} className="truncate">
                <span className="vg-in inline-block" style={{ ["--d" as string]: line.d }}>
                  {line.t}
                </span>
              </p>
            ))}
          </div>
        </div>

        {/* Panel "Guión para teleprompter" */}
        <div className="h-[174px] flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="vg-in min-w-0 truncate text-[11px] font-semibold" style={{ ["--d" as string]: "0.58s" }}>
              Guión para teleprompter
            </span>

            {/* Botón con tres estados encadenados en el mismo hueco: el ancho lo
                fija "Regenerar guión", que es el estado final y el que queda de
                base, así que nada salta al cambiar. */}
            <span
              className="vg-press relative ml-auto inline-flex flex-shrink-0 items-center rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-fg-muted)]"
              style={{ ["--d" as string]: "1s" }}
            >
              <span className="vg-swap-in inline-flex items-center gap-1" style={{ ["--d" as string]: "2.6s" }}>
                <IconRotate className="h-2.5 w-2.5" />
                Regenerar guión
              </span>
              <span
                className="vg-swap-out absolute inset-0 flex items-center justify-center gap-1"
                style={{ ["--d" as string]: "1.05s" }}
              >
                <IconRotate className="h-2.5 w-2.5" />
                Generar guión
              </span>
              <span className="vg-swap-out absolute inset-0" style={{ ["--d" as string]: "2.5s" }}>
                <span
                  className="vg-swap-in flex h-full items-center justify-center gap-1 text-[var(--color-accent)]"
                  style={{ ["--d" as string]: "1.15s" }}
                >
                  <VgSpinner className="h-2.5 w-2.5" />
                  Generando…
                </span>
              </span>
            </span>
          </div>

          <div className="mt-1.5 h-[122px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2">
            <div className="font-serif text-[10px] leading-[1.4] text-[var(--color-fg)]">
              {SCRIPT_LINES.map((line, i) => (
                <p
                  key={line}
                  className="vg-in truncate"
                  style={{ ["--d" as string]: `${(2.6 + i * 0.3).toFixed(2)}s` }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Puntero: primero viaja al botón "Generar guión" (abajo a la derecha)
            y después al botón "Teleprompter" (arriba a la derecha). El segundo
            viaje va anidado y es un delta relativo al primero. */}
        <span className="vg-cursor pointer-events-none absolute right-0 top-0 z-20 h-0 w-0"
          style={{
            ["--x0" as string]: "-150px",
            ["--y0" as string]: "268px",
            ["--x1" as string]: "-68px",
            ["--y1" as string]: "193px",
            ["--dur" as string]: "0.85s",
            ["--d" as string]: "0.15s",
          }}
        >
          <VgCursor
            style={{
              ["--x0" as string]: "0px",
              ["--y0" as string]: "0px",
              ["--x1" as string]: "7px",
              ["--y1" as string]: "-170px",
              ["--dur" as string]: "0.7s",
              ["--d" as string]: "4.55s",
            }}
          />
        </span>
      </div>

      {/* ---------- Escena B: el teleprompter a pantalla completa ---------- */}
      <div
        className="vg-swap-in absolute inset-0 z-10 flex flex-col bg-black text-white"
        style={{ ["--d" as string]: "5.4s" }}
      >
        <div
          className="vg-in flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
          style={{ ["--d" as string]: "5.6s" }}
        >
          <span className="flex items-center gap-1.5 text-[10px] text-white/50">
            <IconArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Volver al editor</span>
          </span>
          <span className="mx-auto min-w-0 truncate text-[10px] font-medium text-white/90">
            2.3 · El silencio del cliente
          </span>
          <span className="hidden text-[10px] text-white/40 sm:block">Modo teleprompter</span>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-hidden px-5"
          style={{
            maskImage: "linear-gradient(transparent, #000 18%, #000 82%, transparent)",
            WebkitMaskImage: "linear-gradient(transparent, #000 18%, #000 82%, transparent)",
          }}
        >
          <div
            className="vg-scroll mx-auto max-w-[420px] pt-[96px] font-serif text-[17px] leading-[1.45] tracking-tight sm:text-[23px]"
            style={{
              ["--from-y" as string]: "0px",
              ["--to-y" as string]: "-46%",
              ["--dur" as string]: "6.4s",
              ["--d" as string]: "5.9s",
            }}
          >
            {TELEPROMPTER_LINES.map((line) => (
              <p key={line} className="mb-1.5">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-white/10 bg-white/5 px-3 py-2 text-[9px] text-white/50">
          <span className={STEPPER}>
            <IconMinus />
          </span>
          <span>
            Texto <span className="text-white/80">48</span>
          </span>
          <span className={STEPPER}>
            <IconPlus />
          </span>

          <span className="mx-1 h-4 w-px flex-shrink-0 bg-white/10" />

          <span className={STEPPER}>
            <IconMinus />
          </span>
          <span>
            Velocidad <span className="text-white/80">40</span>
          </span>
          <span className={STEPPER}>
            <IconPlus />
          </span>

          <span className="mx-1 h-4 w-px flex-shrink-0 bg-white/10" />

          <span
            className="vg-press inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[9px] font-semibold text-[var(--color-accent-fg)]"
            style={{ ["--d" as string]: "5.85s" }}
          >
            <IconPlay className="h-2.5 w-2.5" />
            Reproducir
          </span>
        </div>
      </div>
    </VignetteFrame>
  );
}
