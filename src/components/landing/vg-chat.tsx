"use client";

import {
  VgCheck,
  VgOutlineRow,
  VgSpinner,
  VignetteFrame,
} from "./vignette-frame";

/**
 * Viñeta del módulo 4 (chat editorial): "La idea aterriza en el capítulo 5".
 *
 * Guion (bucle de 13s): el autor le cuenta al chat una anécdota que pertenece
 * a otro capítulo, el modelo contesta "listo" antes de tiempo, el guardarraíl
 * lo caza y lo obliga a ejecutar de verdad las herramientas; la idea termina
 * archivada en el capítulo 5, con su globo numerado en el temario.
 *
 * Todo corresponde a UI real: las etiquetas de herramienta son las de
 * TOOL_LABELS (`leave_suggestion` → "Dejando idea en el capítulo"), el globo
 * del temario es el badge de sugerencias pendientes y el pie replica la
 * píldora de alcance + el textarea + los botones de micrófono y enviar.
 */
export function VgChat() {
  return (
    <VignetteFrame
      loopMs={13000}
      label="El chat de EscribaHoy recibe una idea suelta, corrige su propia respuesta, ejecuta las herramientas y deja la idea guardada en el capítulo 5 del temario."
      className="mx-auto w-full max-w-[620px]"
    >
      <div className="flex h-[320px] text-[11px] sm:h-[344px]">
        {/* Temario */}
        <div className="hidden w-[180px] flex-shrink-0 overflow-hidden border-r border-[var(--color-border)] py-1.5 sm:block">
          <VgOutlineRow header="Preliminares" className="vg-in" style={{ ["--d" as string]: "0.06s" }} />
          <VgOutlineRow title="Prefacio" status="complete" className="vg-in" style={{ ["--d" as string]: "0.12s" }} />
          <VgOutlineRow header="Capítulos" className="vg-in" style={{ ["--d" as string]: "0.18s" }} />
          <VgOutlineRow num="1" title="Por qué fracasan las ofertas" status="complete" className="vg-in" style={{ ["--d" as string]: "0.24s" }} />
          <VgOutlineRow num="2" title="El precio no es el problema" status="complete" className="vg-in" style={{ ["--d" as string]: "0.3s" }} />
          <VgOutlineRow num="3" title="Errores que cuestan caro" status="complete" className="vg-in" style={{ ["--d" as string]: "0.36s" }} />
          <VgOutlineRow num="4" title="Objeciones que sí importan" status="in_progress" active className="vg-in" style={{ ["--d" as string]: "0.42s" }} />

          {/* Capítulo 5: recibe la idea. El punto pasa a borrador y le crece el globo. */}
          <div className="vg-in flex items-center gap-1.5 rounded-md px-2 py-1" style={{ ["--d" as string]: "0.48s" }}>
            <span className="relative h-1.5 w-1.5 flex-shrink-0">
              <span className="vg-swap-out absolute inset-0 rounded-full bg-[var(--color-border-strong)]" style={{ ["--d" as string]: "6.55s" }} />
              <span className="vg-swap-in absolute inset-0 rounded-full bg-amber-400" style={{ ["--d" as string]: "6.65s" }} />
            </span>
            <span className="flex-shrink-0 font-mono text-[10px] text-[var(--color-fg-subtle)]">5</span>
            <span className="min-w-0 flex-1 truncate text-[11px]">Cuando el cliente desaparece</span>
            <span
              className="vg-pop grid h-4 min-w-4 flex-shrink-0 place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[9px] font-bold text-[var(--color-accent-fg)]"
              style={{ ["--d" as string]: "6.7s" }}
            >
              1
            </span>
          </div>

          <VgOutlineRow num="6" title="Recuperar una venta fría" className="vg-in" style={{ ["--d" as string]: "0.54s" }} />
          <VgOutlineRow num="7" title="Cerrar sin presionar" className="vg-in" style={{ ["--d" as string]: "0.6s" }} />
          <VgOutlineRow header="Cierre" className="vg-in" style={{ ["--d" as string]: "0.66s" }} />
          <VgOutlineRow title="Sobre el autor" className="vg-in" style={{ ["--d" as string]: "0.72s" }} />
        </div>

        {/* Panel de IA */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[11px] font-semibold">EscribaHoy</span>
            <span className="ml-auto text-[9px] text-[var(--color-fg-subtle)]">9 herramientas</span>
          </div>

          {/* Conversación */}
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-3 py-2.5">
            <div className="vg-in" style={{ ["--d" as string]: "0.2s" }}>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">Tú</div>
              <div className="ml-6 space-y-0.5 rounded-lg bg-[var(--color-bg-muted)] px-2.5 py-2 text-[10px] leading-snug">
                <p>
                  <span className="vg-type" style={{ ["--d" as string]: "0.35s", ["--steps" as string]: 30 }}>
                    En el cap. 5 va lo del cliente
                  </span>
                </p>
                <p>
                  <span className="vg-type" style={{ ["--d" as string]: "1s", ["--steps" as string]: 32 }}>
                    que canceló a las 3 de la mañana
                  </span>
                </p>
              </div>
            </div>

            <div className="vg-in" style={{ ["--d" as string]: "1.8s" }}>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">EscribaHoy</div>
              <div className="mr-6 rounded-lg bg-[var(--color-accent-soft)] px-2.5 py-2 text-[10px] leading-snug">
                {/* Pensando: se colapsa cuando llega la respuesta. */}
                <div className="vg-shrink" style={{ ["--d" as string]: "2.9s" }}>
                  <div>
                    <span className="flex items-center gap-1.5 pb-1 text-[var(--color-fg-muted)]">
                      Pensando
                      <span className="thinking-dots">
                        <span>·</span>
                        <span>·</span>
                        <span>·</span>
                      </span>
                      <span
                        className="vg-odo ml-auto font-mono text-[9px] text-[var(--color-fg-subtle)]"
                        style={{ ["--dur" as string]: "1.2s", ["--d" as string]: "1.9s", ["--stops" as string]: 2 }}
                      >
                        <span>1s</span>
                        <span>2s</span>
                        <span>3s</span>
                      </span>
                    </span>
                  </div>
                </div>

                <span className="vg-in block" style={{ ["--d" as string]: "3.25s" }}>
                  Listo, ya lo dejé en el capítulo 5.
                </span>

                {/* Guardarraíl: el turno se caza a sí mismo y ejecuta de verdad. */}
                <span
                  className="vg-in mt-1.5 block border-t border-[var(--color-border)] pt-1.5 text-[9px] italic leading-snug text-[var(--color-fg-subtle)]"
                  style={{ ["--d" as string]: "4s" }}
                >
                  [Detecté que dije haber hecho algo sin ejecutarlo. Corrigiendo…]
                </span>
              </div>
            </div>

            <div className="ml-1 space-y-1">
              <div className="vg-in flex items-center gap-1.5 text-[9px] text-[var(--color-fg-muted)]" style={{ ["--d" as string]: "4.8s" }}>
                <span className="relative h-3 w-3 flex-shrink-0">
                  <span className="vg-swap-out absolute inset-0 text-[var(--color-accent)]" style={{ ["--d" as string]: "5.5s" }}>
                    <VgSpinner />
                  </span>
                  <span className="vg-swap-in absolute inset-0 text-[var(--color-success)]" style={{ ["--d" as string]: "5.6s" }}>
                    <VgCheck />
                  </span>
                </span>
                Ubicando el capítulo
              </div>

              <div className="vg-in flex items-center gap-1.5 text-[9px] text-[var(--color-fg-muted)]" style={{ ["--d" as string]: "5.9s" }}>
                <span className="relative h-3 w-3 flex-shrink-0">
                  <span className="vg-swap-out absolute inset-0 text-[var(--color-accent)]" style={{ ["--d" as string]: "6.5s" }}>
                    <VgSpinner />
                  </span>
                  <span className="vg-swap-in absolute inset-0 text-[var(--color-success)]" style={{ ["--d" as string]: "6.6s" }}>
                    <VgCheck />
                  </span>
                </span>
                Dejando idea en el capítulo
              </div>
            </div>
          </div>

          {/* Pie: estático, sin animación. */}
          <div className="flex items-center gap-2 border-t border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 px-3 py-2">
            <div className="flex flex-shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-0.5 text-[10px]">
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--color-fg-muted)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-2.5 w-2.5">
                  <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Esta sección
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 font-medium text-[var(--color-accent-fg)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-2.5 w-2.5">
                  <path d="M12 7v14" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Todo el proyecto
              </span>
            </div>
          </div>

          <div className="flex items-end gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-[10px] leading-snug text-[var(--color-fg-subtle)]">
              Pregunta o cuéntame una idea…
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 19v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2 15 22l-4-9-9-4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="vg-toast pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-fg)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-bg)] shadow-md"
        style={{ ["--d" as string]: "7.2s" }}
      >
        Idea guardada en Capítulo 5
      </div>
    </VignetteFrame>
  );
}
