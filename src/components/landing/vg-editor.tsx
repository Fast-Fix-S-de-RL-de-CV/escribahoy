"use client";

import { VgCheck, VgSpinner, VignetteFrame } from "./vignette-frame";

/**
 * Viñeta del módulo "El editor": la página escribiéndose.
 *
 * Guion (bucle de 11s): la cabecera real del editor escribe el título de la
 * sección, el cuerpo en serif se teclea línea por línea mientras el contador de
 * palabras y la barra de avance corren en paralelo, el autoguardado pasa por
 * "Guardando…" y aterriza en "Guardado ahora", y el estado del nodo se deriva
 * solo de borrador a en progreso.
 *
 * Todo lo visible corresponde a UI real del producto: el Badge muted con la
 * numeración en mono, el StatusToggle con su punto de color, la fila de
 * "x / 1,800 palabras" con Progress, el bloque de guardado y la barra de
 * herramientas del RichEditor (8 comandos + separador + "Accesorio").
 */

/** Iconos de la barra de herramientas: mismos comandos que RichEditor. */
const TOOLS: { id: string; path: React.ReactNode; hideSm?: boolean }[] = [
  {
    id: "h1",
    path: (
      <>
        <path d="M4 6v12M11 6v12M4 12h7" />
        <path d="m15.5 11 2-1.2V18" />
      </>
    ),
  },
  {
    id: "h2",
    path: (
      <>
        <path d="M4 6v12M11 6v12M4 12h7" />
        <path d="M15 11a2.2 2.2 0 1 1 4.2 1c0 1.4-1.4 2.2-4.2 6h4.4" />
      </>
    ),
  },
  {
    id: "h3",
    hideSm: true,
    path: (
      <>
        <path d="M4 6v12M11 6v12M4 12h7" />
        <path d="M15.2 9.6h4l-2.2 3.2a2.3 2.3 0 1 1-1.9 3.5" />
      </>
    ),
  },
  {
    id: "bold",
    path: <path d="M7 5h5.5a3.5 3.5 0 0 1 0 7H7zM7 12h6.5a3.5 3.5 0 0 1 0 7H7z" />,
  },
  {
    id: "italic",
    path: (
      <>
        <path d="M18 5h-7M13 19H6M15 5 9 19" />
      </>
    ),
  },
  {
    id: "ul",
    hideSm: true,
    path: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </>
    ),
  },
  {
    id: "ol",
    hideSm: true,
    path: (
      <>
        <path d="M10 6h10M10 12h10M10 18h10" />
        <path d="M4 5.5 5.5 4.8V10M4 10h3" />
        <path d="M4 15.2a1.6 1.6 0 1 1 2.9 1L4 20h3" />
      </>
    ),
  },
  {
    id: "quote",
    hideSm: true,
    path: (
      <>
        <path d="M10 6H7a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3V8a10 10 0 0 1-.4 3.6A5 5 0 0 1 6.5 15" />
        <path d="M19.5 6h-3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3V8a10 10 0 0 1-.4 3.6A5 5 0 0 1 16 15" />
      </>
    ),
  },
];

/** Las cinco líneas que se teclean, con su cuenta de caracteres. */
const LINES = [
  { t: "Hay tres errores de precio que se repiten en", d: "1.4s", s: 44 },
  { t: "cada mesa de negociación, y ninguno tiene que", d: "2.35s", s: 45 },
  { t: "ver con la cifra: tienen que ver con el orden", d: "3.3s", s: 45 },
  { t: "en que la presentas. El primero es abrir con el", d: "4.25s", s: 47 },
  { t: "número antes de haber puesto una referencia.", d: "5.2s", s: 44 },
];

export function VgEditor() {
  return (
    <VignetteFrame
      loopMs={11000}
      label="El editor de EscribaHoy escribiendo una sección: el texto en serif se teclea, el contador llega a 1,842 palabras y el autoguardado confirma 'Guardado ahora'."
      className="mx-auto w-full max-w-[560px]"
    >
      {/* Cabecera de la sección */}
      <div className="border-b border-[var(--color-border)] px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
              <span className="mr-1.5 font-mono">3.2</span>
              Sección
            </span>
            <h2 className="mt-1.5 font-serif text-base font-semibold tracking-tight sm:text-lg">
              <span className="vg-type" style={{ ["--d" as string]: "0.5s", ["--steps" as string]: 34 }}>
                Errores de precio que cuestan caro
              </span>
            </h2>
          </div>

          {/* Estado del nodo: pasa de borrador a en progreso al guardarse. */}
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)]">
            <span className="relative h-2 w-2 flex-shrink-0">
              <span className="vg-swap-out absolute inset-0 rounded-full bg-amber-400" style={{ ["--d" as string]: "7.8s" }} />
              <span className="vg-swap-in absolute inset-0 rounded-full bg-[var(--color-accent)]" style={{ ["--d" as string]: "7.9s" }} />
            </span>
            <span className="relative">
              <span className="vg-swap-out absolute inset-0 whitespace-nowrap" style={{ ["--d" as string]: "7.8s" }}>
                Borrador
              </span>
              <span className="vg-swap-in block whitespace-nowrap" style={{ ["--d" as string]: "7.9s" }}>
                En progreso
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3 flex-shrink-0">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* Contador de palabras, avance y autoguardado */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-[var(--color-fg-muted)]">
          <span className="flex items-center gap-1">
            <span
              className="vg-odo font-medium"
              style={{ ["--dur" as string]: "4.8s", ["--d" as string]: "1.4s", ["--stops" as string]: 9 }}
            >
              <span>0</span>
              <span>180</span>
              <span>402</span>
              <span>611</span>
              <span>845</span>
              <span>1,070</span>
              <span>1,288</span>
              <span>1,506</span>
              <span>1,704</span>
              <span>1,842</span>
            </span>
            <span>/ 1,800 palabras</span>
          </span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] sm:w-32">
            <span
              className="vg-fill block h-full rounded-full bg-[var(--color-accent)]"
              style={{
                ["--from" as string]: "0%",
                ["--to" as string]: "96%",
                ["--dur" as string]: "4.8s",
                ["--d" as string]: "1.4s",
              }}
            />
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="vg-in inline-flex" style={{ ["--d" as string]: "6.4s" }}>
              <span className="vg-swap-out flex items-center gap-1" style={{ ["--d" as string]: "7.4s" }}>
                <VgSpinner className="h-3 w-3" />
                Guardando…
              </span>
            </span>
            <span
              className="vg-swap-in flex items-center gap-1 text-[var(--color-success)]"
              style={{ ["--d" as string]: "7.5s" }}
            >
              <VgCheck className="h-3 w-3" />
              Guardado ahora
            </span>
          </span>
        </div>
      </div>

      {/* Barra de herramientas del editor */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 sm:px-3">
        {TOOLS.map((tool, i) => (
          <span
            key={tool.id}
            className={`vg-in h-8 w-8 place-items-center rounded-md text-[var(--color-fg-muted)] ${
              tool.hideSm ? "hidden sm:grid" : "grid"
            }`}
            style={{ ["--d" as string]: `${0.05 + i * 0.05}s` }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              {tool.path}
            </svg>
          </span>
        ))}
        <span className="mx-1 h-5 w-px flex-shrink-0 bg-[var(--color-border)]" />
        <span
          className="vg-in flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--color-fg-muted)]"
          style={{ ["--d" as string]: "0.5s" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-3.5 w-3.5"
          >
            <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Accesorio
        </span>
      </div>

      {/* Cuerpo: la página en serif */}
      <div className="h-[190px] overflow-hidden px-3 py-2.5 sm:h-[205px] sm:px-5 sm:py-3">
        <div className="prose-editor space-y-1 text-[12px] leading-relaxed sm:text-[13px]">
          {LINES.map((line) => (
            <p key={line.t}>
              <span className="vg-type" style={{ ["--d" as string]: line.d, ["--steps" as string]: line.s }}>
                {line.t}
              </span>
            </p>
          ))}
          <span className="vg-caret vg-in" style={{ ["--d" as string]: "0.4s" }} />
        </div>
      </div>
    </VignetteFrame>
  );
}
