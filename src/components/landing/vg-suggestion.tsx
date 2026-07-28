"use client";

import { VgCheck, VgCursor, VgSpinner, VgTopbar, VignetteFrame } from "./vignette-frame";

/**
 * Viñeta del módulo 3: "Del plan al borrador".
 *
 * Guion (bucle de 12s): la sección abre vacía, la caja de sugerencias entra
 * preparando el plan, aterrizan las viñetas del plan con su cita [KB: …] y su
 * nota de tono, el puntero pulsa "Ejecutar sugerencia con IA", el borrador se
 * escribe contra el objetivo de palabras y al final la caja se colapsa dejando
 * la marca verde "Idea aplicada".
 *
 * Todo lo dibujado es UI real: SuggestionsBox (chip con foco, contador de
 * ideas pendientes, tarjeta blanca, botón accent + "Descartar", marca "Idea
 * aplicada"), el contador "0 / 1,800 palabras" de la sección con su barra de
 * avance y el autoguardado de la barra superior.
 *
 * Contrato de animación: el estado base de cada elemento es su estado final
 * visible; el movimiento sólo existe bajo prefers-reduced-motion: no-preference
 * y con data-play="true".
 */
export function VgSuggestion() {
  return (
    <VignetteFrame
      loopMs={12000}
      label="Una sección de EscribaHoy con el plan sugerido por la IA: cuatro viñetas de qué cubrir, el botón Ejecutar sugerencia con IA y el borrador desarrollándose hasta 1,728 palabras."
      className="mx-auto w-full max-w-[560px]"
    >
      <VgTopbar
        title="Manual de ventas directas"
        meta="Capítulo 3 · Errores que cuestan caro"
        right={
          <span className="relative hidden items-center sm:flex">
            {/* el autoguardado sólo tiene algo que decir cuando el borrador aterriza */}
            <span className="vg-in" style={{ ["--d" as string]: "8.9s" }}>
              <span
                className="vg-swap-out flex items-center gap-1 whitespace-nowrap text-[10px] text-[var(--color-fg-subtle)]"
                style={{ ["--d" as string]: "9.6s" }}
              >
                <VgSpinner className="h-2.5 w-2.5" />
                Guardando…
              </span>
            </span>
            <span
              className="vg-swap-in absolute right-0 top-0 flex items-center gap-1 whitespace-nowrap bg-[var(--color-bg-elevated)] pl-1 text-[10px] text-[var(--color-success)]"
              style={{ ["--d" as string]: "9.9s" }}
            >
              <VgCheck className="h-2.5 w-2.5" />
              Guardado ahora
            </span>
          </span>
        }
      />

      <div className="flex h-[320px] flex-col px-4 py-3 sm:h-[360px]">
        {/* Cabecera de la sección: número, contador y avance contra el objetivo */}
        <div className="vg-in flex items-center gap-2" style={{ ["--d" as string]: "0.1s" }}>
          <span className="rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
            3.2
          </span>
          <span className="text-[10px] text-[var(--color-fg-subtle)]">Sección</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--color-fg-subtle)]">
            <span
              className="vg-odo text-right font-medium text-[var(--color-fg-muted)]"
              style={{ ["--dur" as string]: "3s", ["--d" as string]: "5.7s", ["--stops" as string]: 4 }}
            >
              {/* El transform en línea deja la columna en su última parada: sin
                  animación el contador marca el total, no el 0 de arranque.
                  Durante el bucle la animación gana sobre el estilo en línea. */}
              {["0", "460", "940", "1,380", "1,728"].map((n) => (
                <span key={n} style={{ transform: "translateY(-4.6em)" }}>
                  {n}
                </span>
              ))}
            </span>
            <span className="whitespace-nowrap">/ 1,800 palabras</span>
            <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] sm:block">
              <span
                className="vg-fill block h-full rounded-full bg-[var(--color-accent)]"
                style={{
                  ["--from" as string]: "0%",
                  ["--to" as string]: "96%",
                  ["--dur" as string]: "3s",
                  ["--d" as string]: "5.7s",
                }}
              />
            </span>
          </span>
        </div>

        <h3
          className="vg-in mt-1.5 font-serif text-[15px] font-semibold leading-snug tracking-tight sm:text-base"
          style={{ ["--d" as string]: "0.25s" }}
        >
          Errores de precio que cuestan caro
        </h3>

        {/* Caja de sugerencias: entra a 0.8s y se colapsa a 9.2s. El hijo
            directo del vg-grow va sin borde ni relleno propios, si no el
            colapso a 0fr dejaría el alto mínimo de esa caja. */}
        <div className="vg-grow vg-shrink mt-2.5" style={{ ["--d" as string]: "9.2s" }}>
          <div>
            <div
              className="vg-in rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent-soft)] to-transparent"
              style={{ ["--d" as string]: "0.8s" }}
            >
              <div className="flex items-center gap-2 px-2.5 py-1">
                <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                    <path d="M9 18h6M10 21h4" strokeLinecap="round" />
                    <path
                      d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="truncate text-[11px] font-semibold text-[var(--color-accent)]">
                  Sugerencias de Escribahoy
                </span>
                <span
                  className="vg-pop grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[9px] font-semibold text-[var(--color-accent-fg)]"
                  style={{ ["--d" as string]: "2.4s" }}
                >
                  1
                </span>
                <span className="ml-auto text-[var(--color-fg-subtle)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                    <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div className="px-2.5 pb-2.5">
                <div className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5">
                  {/* Estado de carga: se retira cuando llega el plan */}
                  <span
                    className="vg-swap-out absolute inset-0 flex items-center justify-center gap-1.5 px-3 text-center text-[10px] leading-snug text-[var(--color-fg-muted)]"
                    style={{ ["--d" as string]: "2.2s" }}
                  >
                    <VgSpinner className="h-3 w-3 flex-shrink-0 text-[var(--color-accent)]" />
                    Escribahoy está preparando una sugerencia para esta sección…
                  </span>

                  <div
                    className="vg-swap-in relative bg-[var(--color-bg-elevated)]"
                    style={{ ["--d" as string]: "2.3s" }}
                  >
                    <ul className="space-y-1">
                      {[
                        {
                          k: "apertura",
                          d: "2.5s",
                          t: <>Abre con el error de anclaje de precio.</>,
                        },
                        {
                          k: "anclaje",
                          d: "2.68s",
                          t: <>Contrasta con lo que ya explicaste en 3.1.</>,
                        },
                        {
                          k: "kb",
                          d: "2.86s",
                          t: (
                            <>
                              Apóyate en{" "}
                              <span className="font-mono text-[9px] text-[var(--color-accent)]">
                                [KB: tarifario-2024.pdf]
                              </span>
                              .
                            </>
                          ),
                        },
                        {
                          k: "cierre",
                          d: "3.04s",
                          t: <>Cierra con la regla de los tres números.</>,
                        },
                      ].map((item) => (
                        <li
                          key={item.k}
                          className="vg-in flex items-start gap-1.5 text-[10px] leading-[1.35] text-[var(--color-fg)]"
                          style={{ ["--d" as string]: item.d }}
                        >
                          <span className="mt-[5px] h-1 w-1 flex-shrink-0 rounded-full bg-[var(--color-accent)]" />
                          <span className="min-w-0">{item.t}</span>
                        </li>
                      ))}
                    </ul>

                    <p
                      className="vg-in mt-1 text-[9px] italic text-[var(--color-fg-subtle)]"
                      style={{ ["--d" as string]: "3.2s" }}
                    >
                      Tono: directo, sin jerga. 100–300 palabras.
                    </p>

                    <div
                      className="vg-in mt-1.5 flex flex-wrap items-center justify-between gap-2"
                      style={{ ["--d" as string]: "3.4s" }}
                    >
                      <span
                        className="vg-press relative inline-flex h-6 items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-2 text-[10px] font-medium text-[var(--color-accent-fg)]"
                        style={{ ["--d" as string]: "5.2s" }}
                      >
                        <span
                          className="vg-swap-out flex items-center gap-1.5 whitespace-nowrap"
                          style={{ ["--d" as string]: "5.35s" }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                            <path
                              d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Ejecutar sugerencia con IA
                        </span>
                        <span
                          className="vg-swap-in absolute inset-0 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[var(--color-accent)]"
                          style={{ ["--d" as string]: "5.45s" }}
                        >
                          <VgSpinner className="h-2.5 w-2.5" />
                          Desarrollando…
                        </span>
                      </span>

                      <span className="hidden items-center gap-1 text-[10px] text-[var(--color-fg-subtle)] sm:inline-flex">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                        Descartar
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marca verde que releva a la caja. Va dentro de un vg-grow para que
            no ocupe alto mientras la caja sigue abierta. */}
        <div className="vg-grow" style={{ ["--d" as string]: "9.4s" }}>
          <div>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2.5 py-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-success)]"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-success)]">
                Idea aplicada
              </span>
              <span className="ml-auto truncate text-[9px] text-[var(--color-fg-muted)]">
                Sección desarrollada · 1,728 palabras
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo de la sección */}
        <div className="prose-editor relative mt-2 min-h-0 flex-1 overflow-hidden text-[11px] leading-[1.5] sm:text-[12px]">
          <span
            className="vg-swap-out absolute inset-x-0 top-0 truncate text-[var(--color-fg-subtle)]"
            style={{ ["--d" as string]: "5.5s" }}
          >
            Empieza a escribir tu sección… o pídele a Escribahoy que te dé un esqueleto.
          </span>

          {[
            { t: "Bajar el precio no resuelve una objeción de precio: la confirma.", d: "5.7s" },
            { t: "Antes de mover la cifra, mueve la referencia con la que te comparan.", d: "6.2s" },
            { t: "En el tarifario, el rango medio ancla mejor que el número más bajo.", d: "6.7s" },
            { t: "Tres números bastan: el caro, el tuyo y el que no querías ofrecer.", d: "7.2s" },
            { t: "El resto de la conversación deja de ser sobre cuánto cuesta.", d: "7.7s" },
          ].map((line, i) => (
            <p
              key={line.t}
              className={`vg-in my-0 ${i === 0 ? "relative bg-[var(--color-bg-elevated)]" : ""}`}
              style={{ ["--d" as string]: line.d }}
            >
              {line.t}
              {i === 4 ? <span className="vg-caret ml-0.5" /> : null}
            </p>
          ))}
        </div>
      </div>

      {/* Puntero que pulsa "Ejecutar sugerencia con IA". El transform en línea
          deja su estado base sobre el botón: sin animación no aparece pegado a
          la esquina del marco. Entra desde fuera del marco, que recorta. */}
      <span className="hidden sm:block">
        <VgCursor
          style={{
            ["--x0" as string]: "400px",
            ["--y0" as string]: "430px",
            ["--x1" as string]: "47px",
            ["--y1" as string]: "255px",
            ["--dur" as string]: "0.8s",
            ["--d" as string]: "4.4s",
            transform: "translate(47px, 255px)",
          }}
        />
      </span>
    </VignetteFrame>
  );
}
