"use client";

import {
  VgCursor,
  VgOutlineRow,
  VgSpinner,
  VgTopbar,
  VignetteFrame,
} from "./vignette-frame";

/**
 * Viñeta del Módulo 1: "Del slider al temario".
 *
 * Guion (bucle de 12s). Escena A — el paso "Formato y extensión" del
 * asistente: el puntero elige Trade 6×9, el slider lleva las páginas a 320,
 * aparecen las dos tarjetas de estimación (palabras totales y meses de
 * escritura) y se pulsa "Generar outline". Escena B — crossfade al temario
 * ya generado: preliminares, capítulos numerados con sus secciones y cierre.
 *
 * Los números son los reales del producto: Trade 6×9 son 350 palabras por
 * página (BOOK_FORMATS), así que 320 páginas son 112,000 palabras, y
 * estimateMonths() las convierte en 10.2 meses a 500 palabras/día sobre 22
 * días hábiles.
 *
 * Contrato de animación: el estado base de todo es el estado final. La
 * Escena B va encima, absoluta y opaca, así que en reposo (o con movimiento
 * reducido) se ve directamente el temario terminado, nunca una caja vacía.
 */

/** Alto en px de una pulgada, calibrado para que el 6×9 mida 34px de alto. */
const IN_TO_PX = 34 / 9;

/** Rectángulo a proporción exacta del formato de impresión. */
function BookRect({ wIn, hIn }: { wIn: number; hIn: number }) {
  const w = Math.round(wIn * IN_TO_PX);
  const h = Math.round(hIn * IN_TO_PX);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect
        x="0.6"
        y="0.6"
        width={w - 1.2}
        height={h - 1.2}
        rx="1.5"
        className="fill-[var(--color-bg-muted)] stroke-[var(--color-border-strong)]"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function VgOutline() {
  return (
    <VignetteFrame
      loopMs={12000}
      label="El asistente de EscribaHoy: se elige el formato Trade 6×9 y 320 páginas, y al generar aparece el temario completo con preliminares, capítulos numerados y cierre."
      className="mx-auto w-full max-w-[560px]"
    >
      {/* Fade global al cerrar el ciclo, para que el reinicio no corte seco. */}
      <div className="vg-out" style={{ ["--d" as string]: "11.5s" }}>
        <VgTopbar
          title="Manual de ventas directas"
          meta="Libro · Negocios"
          right={
            <span
              className="vg-in hidden whitespace-nowrap text-[10px] text-[var(--color-fg-subtle)] sm:inline-block"
              style={{ ["--d" as string]: "4.9s" }}
            >
              0/24 completas · 0 palabras
            </span>
          }
        />

        <div className="relative h-[330px] sm:h-[356px]">
          {/* ============ Escena A — Formato y extensión ============ */}
          <div
            className="vg-out absolute inset-0 px-4 py-3"
            style={{ ["--d" as string]: "4.3s" }}
          >
            <div
              className="vg-in text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]"
              style={{ ["--d" as string]: "0.1s" }}
            >
              Formato del libro
            </div>

            <div className="mt-2 flex items-stretch gap-2">
              {/* Bolsillo */}
              <div
                className="vg-in flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-2"
                style={{ ["--d" as string]: "0.18s" }}
              >
                <div className="flex h-[34px] items-end justify-center">
                  <BookRect wIn={4.25} hIn={6.87} />
                </div>
                <div className="mt-1.5 truncate text-center text-[10px] font-medium">
                  Bolsillo
                </div>
              </div>

              {/* Trade 5×8 */}
              <div
                className="vg-in flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-2"
                style={{ ["--d" as string]: "0.26s" }}
              >
                <div className="flex h-[34px] items-end justify-center">
                  <BookRect wIn={5} hIn={8} />
                </div>
                <div className="mt-1.5 truncate text-center text-[10px] font-medium">
                  Trade 5×8
                </div>
              </div>

              {/* Trade 6×9 — el que el puntero selecciona a 1.2s */}
              <div
                className="vg-in relative flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-2"
                style={{ ["--d" as string]: "0.34s" }}
              >
                <span
                  className="vg-in absolute inset-0 rounded-[var(--radius-md)] border-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  style={{ ["--d" as string]: "1.2s" }}
                />
                <div className="relative flex h-[34px] items-end justify-center">
                  <BookRect wIn={6} hIn={9} />
                </div>
                <div className="relative mt-1.5 truncate text-center text-[10px] font-semibold text-[var(--color-accent)]">
                  Trade 6×9
                </div>

                {/* Puntero 1: entra desde abajo-derecha y elige la tarjeta. */}
                <span
                  className="vg-out pointer-events-none absolute inset-0"
                  style={{ ["--d" as string]: "2.85s" }}
                >
                  <VgCursor
                    style={{
                      ["--x0" as string]: "90px",
                      ["--y0" as string]: "182px",
                      ["--x1" as string]: "36px",
                      ["--y1" as string]: "30px",
                      ["--dur" as string]: "0.8s",
                      ["--d" as string]: "0.4s",
                    }}
                  />
                </span>
              </div>
            </div>

            <div
              className="vg-in mt-1.5 truncate text-[10px] text-[var(--color-fg-muted)]"
              style={{ ["--d" as string]: "1.35s" }}
            >
              <span className="font-medium text-[var(--color-fg)]">
                6×9″ · 15.2×22.9cm
              </span>{" "}
              · ideal 250–450 páginas
            </div>

            <div
              className="vg-in mt-3 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]"
              style={{ ["--d" as string]: "1.45s" }}
            >
              Páginas objetivo
            </div>

            <div
              className="vg-in mt-2 flex items-center gap-2.5"
              style={{ ["--d" as string]: "1.5s" }}
            >
              <span className="relative block h-1.5 flex-1 rounded-full bg-[var(--color-bg-subtle)]">
                <span
                  className="vg-fill relative block h-full rounded-full bg-[var(--color-accent)]"
                  style={{
                    width: "33.3%",
                    ["--from" as string]: "4.8%",
                    ["--to" as string]: "33.3%",
                    ["--dur" as string]: "1.4s",
                    ["--d" as string]: "1.6s",
                  }}
                >
                  <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-bg-elevated)] shadow-sm" />
                </span>
              </span>
              <span className="flex h-7 items-center rounded-md border border-[var(--color-border)] px-2">
                <span
                  className="vg-odo font-mono text-[12px] font-semibold"
                  style={{
                    ["--dur" as string]: "1.4s",
                    ["--d" as string]: "1.6s",
                    ["--stops" as string]: 4,
                  }}
                >
                  <span>200</span>
                  <span>230</span>
                  <span>260</span>
                  <span>290</span>
                  <span>320</span>
                </span>
              </span>
              <span className="text-[10px] text-[var(--color-fg-muted)]">
                páginas
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div
                className="vg-in rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-2 py-1.5"
                style={{ ["--d" as string]: "3s" }}
              >
                <div className="text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Total estimado
                </div>
                <div className="truncate text-[12px] font-semibold">
                  ~112,000 palabras
                </div>
                <div className="truncate text-[9px] text-[var(--color-fg-subtle)]">
                  350 palabras/página
                </div>
              </div>
              <div
                className="vg-in rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-2 py-1.5"
                style={{ ["--d" as string]: "3.1s" }}
              >
                <div className="text-[8px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Tiempo de escritura
                </div>
                <div className="truncate text-[12px] font-semibold">
                  10.2 meses
                </div>
                <div className="truncate text-[9px] text-[var(--color-fg-subtle)]">
                  a 500 palabras/día
                </div>
              </div>
            </div>

            <div
              className="vg-in mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-fg-subtle)]"
              style={{ ["--d" as string]: "2.55s" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-3 w-3 flex-shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">3 archivos tuyos entran al temario</span>
            </div>

            {/* Botón primario: se pulsa a 3.35s y cambia a estado de carga. */}
            <div className="mt-2.5">
              <span
                className="vg-press relative inline-flex h-8 items-center rounded-md bg-[var(--color-accent)] px-3 text-[11px] font-semibold text-[var(--color-accent-fg)]"
                style={{ ["--d" as string]: "3.35s" }}
              >
                <span className="relative block">
                  <span
                    className="vg-swap-out absolute inset-0 flex items-center justify-center overflow-hidden whitespace-nowrap"
                    style={{ ["--d" as string]: "3.55s" }}
                  >
                    Generar outline
                  </span>
                  <span
                    className="vg-swap-in flex items-center justify-center gap-1.5 whitespace-nowrap bg-[var(--color-accent)]"
                    style={{ ["--d" as string]: "3.75s" }}
                  >
                    <VgSpinner className="h-3 w-3" />
                    Generando outline…
                  </span>
                </span>

                {/* Puntero 2: aparece ya cerca del botón y lo pulsa. */}
                <span
                  className="vg-in pointer-events-none absolute inset-0"
                  style={{ ["--d" as string]: "3s" }}
                >
                  <VgCursor
                    style={{
                      ["--x0" as string]: "96px",
                      ["--y0" as string]: "30px",
                      ["--x1" as string]: "52px",
                      ["--y1" as string]: "18px",
                      ["--dur" as string]: "0.4s",
                      ["--d" as string]: "3s",
                    }}
                  />
                </span>
              </span>
            </div>
          </div>

          {/* ============ Escena B — el temario generado ============ */}
          <div
            className="vg-in absolute inset-0 overflow-hidden bg-[var(--color-bg-elevated)] py-1.5 leading-[1.15]"
            style={{ ["--d" as string]: "4.6s" }}
          >
            <div className="mx-auto w-full max-w-[420px] px-2">
              <VgOutlineRow
                header="Preliminares"
                className="vg-in"
                style={{ ["--d" as string]: "4.78s" }}
              />
              <VgOutlineRow
                title="Dedicatoria"
                className="vg-in"
                style={{ ["--d" as string]: "4.89s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                title="Prefacio"
                className="vg-in"
                style={{ ["--d" as string]: "5s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                title="Introducción"
                className="vg-in"
                style={{ ["--d" as string]: "5.11s" }}
              >
                <Words />
              </VgOutlineRow>

              <VgOutlineRow
                header="Capítulos"
                className="vg-in"
                style={{ ["--d" as string]: "5.22s" }}
              />
              <VgOutlineRow
                num="1"
                title="Por qué fracasan las ofertas"
                className="vg-in"
                style={{ ["--d" as string]: "5.33s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="1.1"
                title="El costo de una promesa vaga"
                className="vg-in ml-3"
                style={{ ["--d" as string]: "5.44s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="1.2"
                title="Qué compra de verdad tu cliente"
                className="vg-in ml-3"
                style={{ ["--d" as string]: "5.55s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="1.3"
                title="La oferta que sí se entiende"
                className="vg-in ml-3"
                style={{ ["--d" as string]: "5.66s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="2"
                title="El precio no es el problema"
                className="vg-in"
                style={{ ["--d" as string]: "5.77s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="2.1"
                title="Anclaje: dale con qué comparar"
                className="vg-in ml-3"
                style={{ ["--d" as string]: "5.88s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                num="2.2"
                title="Cuándo sí conviene bajar"
                className="vg-in ml-3"
                style={{ ["--d" as string]: "5.99s" }}
              >
                <Words />
              </VgOutlineRow>

              <VgOutlineRow
                header="Cierre"
                className="vg-in"
                style={{ ["--d" as string]: "6.1s" }}
              />
              <VgOutlineRow
                title="Epílogo"
                className="vg-in"
                style={{ ["--d" as string]: "6.21s" }}
              >
                <Words />
              </VgOutlineRow>
              <VgOutlineRow
                title="Sobre el autor"
                className="vg-in"
                style={{ ["--d" as string]: "6.32s" }}
              >
                <Words />
              </VgOutlineRow>
            </div>
          </div>
        </div>
      </div>
    </VignetteFrame>
  );
}

/** Contador de la derecha de cada fila del temario recién generado. */
function Words() {
  return (
    <span className="flex-shrink-0 font-mono text-[9px] text-[var(--color-fg-subtle)]">
      0 pal.
    </span>
  );
}
