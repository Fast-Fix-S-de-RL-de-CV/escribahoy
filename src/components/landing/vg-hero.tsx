"use client";

import {
  VgCheck,
  VgOutlineRow,
  VgSpinner,
  VgTopbar,
  VignetteFrame,
} from "./vignette-frame";

/**
 * Viñeta del hero: el workspace de tres columnas trabajando.
 *
 * Guion (bucle de 12s): se puebla el temario, se escribe la sección, el
 * usuario le pide al chat renombrar el capítulo 3, la herramienta se ejecuta
 * y el cambio aterriza en el temario y en los contadores de la barra.
 *
 * Todo lo que se ve corresponde a UI real del producto: la topbar con el
 * formato físico, el outline con numeración jerárquica, el panel de IA con
 * sus etiquetas TÚ / ESCRIBAHOY y la lista de herramientas ejecutándose.
 */
export function VgHero() {
  return (
    <VignetteFrame
      loopMs={12000}
      label="El espacio de trabajo de EscribaHoy: temario a la izquierda, editor al centro y chat de IA a la derecha, renombrando un capítulo."
      className="mx-auto w-full max-w-[1120px]"
    >
      <VgTopbar
        title="Manual de ventas directas"
        meta="Libro · Negocios 15.2×22.9cm · 320 pp"
        right={
          <>
            <span className="hidden items-center gap-1.5 text-[10px] text-[var(--color-fg-subtle)] sm:flex">
              <span className="vg-odo font-medium text-[var(--color-fg-muted)]" style={{ ["--dur" as string]: "0.5s", ["--d" as string]: "6.8s", ["--stops" as string]: 1 }}>
                <span>7/24</span>
                <span>8/24</span>
              </span>
              completas · 18,432 palabras
            </span>
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] sm:block">
              <span
                className="vg-fill block h-full rounded-full bg-[var(--color-accent)]"
                style={{ ["--from" as string]: "29%", ["--to" as string]: "33%", ["--dur" as string]: "0.6s", ["--d" as string]: "6.8s" }}
              />
            </span>
          </>
        }
      />

      <div className="flex h-[300px] text-[11px] sm:h-[340px]">
        {/* Temario */}
        <div className="hidden w-[190px] flex-shrink-0 overflow-hidden border-r border-[var(--color-border)] py-1.5 md:block">
          <VgOutlineRow header="Preliminares" className="vg-in" style={{ ["--d" as string]: "0.1s" }} />
          <VgOutlineRow title="Dedicatoria" status="complete" className="vg-in" style={{ ["--d" as string]: "0.18s" }} />
          <VgOutlineRow title="Prefacio" status="complete" className="vg-in" style={{ ["--d" as string]: "0.26s" }} />
          <VgOutlineRow header="Capítulos" className="vg-in" style={{ ["--d" as string]: "0.34s" }} />
          <VgOutlineRow num="1" title="Por qué fracasan las ofertas" status="complete" className="vg-in" style={{ ["--d" as string]: "0.42s" }} />
          <VgOutlineRow num="2" title="El precio no es el problema" status="complete" className="vg-in" style={{ ["--d" as string]: "0.5s" }} />

          {/* La fila que el chat renombra: dos títulos superpuestos que se relevan. */}
          <div className="vg-in relative flex items-center gap-1.5 rounded-md px-2 py-1" style={{ ["--d" as string]: "0.58s" }}>
            <span className="relative h-1.5 w-1.5 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-amber-400 vg-swap-out" style={{ ["--d" as string]: "6.2s" }} />
              <span className="absolute inset-0 rounded-full bg-[var(--color-accent)] vg-swap-in" style={{ ["--d" as string]: "6.3s" }} />
            </span>
            <span className="flex-shrink-0 font-mono text-[10px] text-[var(--color-fg-subtle)]">3</span>
            <span className="relative min-w-0 flex-1">
              <span className="vg-swap-out absolute inset-0 truncate" style={{ ["--d" as string]: "6.2s" }}>
                Precio y percepción
              </span>
              <span className="vg-swap-in block truncate font-medium text-[var(--color-accent)]" style={{ ["--d" as string]: "6.3s" }}>
                Errores que cuestan caro
              </span>
            </span>
          </div>

          <VgOutlineRow num="3.1" title="El anclaje" status="in_progress" className="vg-in ml-3" style={{ ["--d" as string]: "0.66s" }} />
          <VgOutlineRow num="3.2" title="Errores de precio" status="draft" active className="vg-in ml-3" style={{ ["--d" as string]: "0.74s" }} />
          <VgOutlineRow num="4" title="Cuando el cliente desaparece" className="vg-in" style={{ ["--d" as string]: "0.82s" }} />
          <VgOutlineRow header="Cierre" className="vg-in" style={{ ["--d" as string]: "0.9s" }} />
          <VgOutlineRow title="Sobre el autor" className="vg-in" style={{ ["--d" as string]: "0.98s" }} />
        </div>

        {/* Editor */}
        <div className="min-w-0 flex-1 overflow-hidden px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">3.2</span>
            <span className="text-[10px] text-[var(--color-fg-subtle)]">Sección</span>
          </div>
          <h3 className="mt-1.5 font-serif text-base font-semibold tracking-tight sm:text-lg">
            <span className="vg-type" style={{ ["--d" as string]: "1.3s", ["--steps" as string]: 26 }}>
              Errores de precio que cuestan caro
            </span>
          </h3>

          <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
            <span className="vg-odo" style={{ ["--dur" as string]: "3s", ["--d" as string]: "1.4s", ["--stops" as string]: 4 }}>
              <span>0</span>
              <span>420</span>
              <span>980</span>
              <span>1,510</span>
              <span>1,842</span>
            </span>
            <span>/ 1,800 palabras</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="vg-swap-out flex items-center gap-1" style={{ ["--d" as string]: "7.6s" }}>
                <VgSpinner className="h-2.5 w-2.5" />
                Guardando…
              </span>
              <span className="vg-swap-in flex items-center gap-1 text-[var(--color-success)]" style={{ ["--d" as string]: "7.9s" }}>
                <VgCheck className="h-2.5 w-2.5" />
                Guardado ahora
              </span>
            </span>
          </div>
          <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
            <span
              className="vg-fill block h-full rounded-full bg-[var(--color-accent)]"
              style={{ ["--from" as string]: "0%", ["--to" as string]: "96%", ["--dur" as string]: "3s", ["--d" as string]: "1.4s" }}
            />
          </span>

          <div className="prose-editor mt-3 space-y-1.5 text-[12px] leading-relaxed sm:text-[13px]">
            {[
              { t: "Bajar el precio casi nunca resuelve una objeción de precio.", d: "1.5s", s: 58 },
              { t: "Lo que falla antes es el anclaje: el cliente no tiene con qué", d: "2.4s", s: 60 },
              { t: "comparar tu número, así que lo compara con cero.", d: "3.3s", s: 48 },
              { t: "Antes de mover la cifra, mueve la referencia.", d: "4.2s", s: 44 },
            ].map((line) => (
              <p key={line.t}>
                <span className="vg-type" style={{ ["--d" as string]: line.d, ["--steps" as string]: line.s }}>
                  {line.t}
                </span>
              </p>
            ))}
            <span className="vg-caret vg-in" style={{ ["--d" as string]: "5s" }} />
          </div>
        </div>

        {/* Panel de IA */}
        <div className="hidden w-[240px] flex-shrink-0 flex-col border-l border-[var(--color-border)] lg:flex">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[11px] font-semibold">EscribaHoy</span>
          </div>

          <div className="flex-1 space-y-2.5 px-3 py-3">
            <div className="vg-in" style={{ ["--d" as string]: "3.4s" }}>
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">Tú</div>
              <div className="ml-4 rounded-lg bg-[var(--color-bg-muted)] px-2.5 py-2 text-[10px] leading-snug">
                <span className="vg-type" style={{ ["--d" as string]: "3.5s", ["--steps" as string]: 52 }}>
                  el capítulo 3 debería llamarse Errores que cuestan caro
                </span>
              </div>
            </div>

            <div className="vg-in" style={{ ["--d" as string]: "4.4s" }}>
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">EscribaHoy</div>
              <div className="mr-4 rounded-lg bg-[var(--color-accent-soft)] px-2.5 py-2 text-[10px] leading-snug">
                <span className="vg-swap-out flex items-center gap-1 text-[var(--color-fg-muted)]" style={{ ["--d" as string]: "5.2s" }}>
                  Pensando
                  <span className="thinking-dots">
                    <span>·</span>
                    <span>·</span>
                    <span>·</span>
                  </span>
                </span>
                <span className="vg-swap-in block" style={{ ["--d" as string]: "5.5s" }}>
                  Listo, renombré el capítulo 3.
                </span>
              </div>
            </div>

            <div className="vg-in ml-1 flex items-center gap-1.5 text-[9px] text-[var(--color-fg-muted)]" style={{ ["--d" as string]: "5.3s" }}>
              <span className="relative h-3 w-3">
                <span className="vg-swap-out absolute inset-0 text-[var(--color-accent)]" style={{ ["--d" as string]: "6.1s" }}>
                  <VgSpinner />
                </span>
                <span className="vg-swap-in absolute inset-0 text-[var(--color-success)]" style={{ ["--d" as string]: "6.2s" }}>
                  <VgCheck />
                </span>
              </span>
              Renombrando capítulo
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] px-3 py-2.5">
            <div className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-[9px] text-[var(--color-fg-subtle)]">
              Pregunta o cuéntame una idea…
            </div>
          </div>
        </div>
      </div>

      <div
        className="vg-toast pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-fg)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-bg)] shadow-md"
        style={{ ["--d" as string]: "7.2s" }}
      >
        Capítulo actualizado
      </div>
    </VignetteFrame>
  );
}
