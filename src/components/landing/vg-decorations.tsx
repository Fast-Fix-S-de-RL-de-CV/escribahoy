"use client";

import { VgCursor, VgSpinner, VgTopbar, VignetteFrame } from "./vignette-frame";

/**
 * Viñeta de accesorios editoriales: "el accesorio entra a la página".
 *
 * Guion (bucle de 14s): el cursor abre el menú "Accesorio" con los siete
 * bloques reales del producto, elige "Frase destacada", el modal genera el
 * texto con IA —con su fuente y su contador de versiones—, se pide otra
 * versión y al insertar, el bloque maquetado crece dentro de la página y
 * cede el turno al tip y al dato para enseñar la variedad de maquetado.
 *
 * Todo lo que se ve es UI real: las etiquetas de DECORATION_LABELS, el
 * "Fuente: del contenido escrito" de generate-decoration y las clases
 * .book-pullquote / .book-callout / .book-stat que usa el editor.
 *
 * Estado base = estado final: sin animación (o con movimiento reducido) se
 * ve el menú de los siete tipos, el modal con la primera versión y los tres
 * bloques apilados dentro de la página.
 */

function Icon({
  className = "h-3 w-3",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SparkleIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
  </Icon>
);

/** Los siete accesorios, en el orden real de DECORATION_KINDS. */
const KINDS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Frase destacada",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M10 7H5v5h5v-1c0 2.4-1.3 3.8-3.4 4.6" />
        <path d="M19 7h-5v5h5v-1c0 2.4-1.3 3.8-3.4 4.6" />
      </Icon>
    ),
  },
  {
    label: "Tip / Callout",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M9.5 18h5M10.5 21h3" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" />
      </Icon>
    ),
  },
  {
    label: "Epígrafe",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M3 21l5-1.5 11-11a2.1 2.1 0 0 0-3-3l-11 11L3 21z" />
        <path d="M14.5 6.5l3 3" />
      </Icon>
    ),
  },
  {
    label: "Definición",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M12 7.5v12" />
        <path d="M3 5h4.5A4.5 4.5 0 0 1 12 7.5 4.5 4.5 0 0 1 16.5 5H21v13h-4.5a4.5 4.5 0 0 0-4.5 2 4.5 4.5 0 0 0-4.5-2H3V5z" />
      </Icon>
    ),
  },
  {
    label: "Ejercicio",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </Icon>
    ),
  },
  {
    label: "Recap del capítulo",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </Icon>
    ),
  },
  {
    label: "Dato impactante",
    icon: (
      <Icon className="h-2.5 w-2.5">
        <path d="M5 20V11M12 20V4M19 20v-6" />
      </Icon>
    ),
  },
];

export function VgDecorations() {
  return (
    <VignetteFrame
      loopMs={14000}
      label="El editor de EscribaHoy: se abre el menú de accesorios editoriales, la IA redacta una frase destacada y el bloque maquetado aterriza dentro de la página."
      className="mx-auto w-full max-w-[560px]"
    >
      <VgTopbar
        title="Manual de ventas directas"
        meta="3.2 Errores de precio · Sección"
        right={
          <span className="hidden text-[10px] text-[var(--color-fg-subtle)] sm:block">
            1,842 palabras
          </span>
        }
      />

      {/* Barra de herramientas del editor */}
      <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] px-2.5 py-1.5 text-[var(--color-fg-muted)]">
        <span className="grid h-6 w-6 place-items-center rounded-md">
          <Icon className="h-3.5 w-3.5">
            <path d="M6 4v16M18 4v16M6 12h12" />
          </Icon>
        </span>
        <span className="grid h-6 w-6 place-items-center rounded-md">
          <Icon className="h-3.5 w-3.5">
            <path d="M7 4h6a4 4 0 0 1 0 8H7z" />
            <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
          </Icon>
        </span>
        <span className="grid h-6 w-6 place-items-center rounded-md">
          <Icon className="h-3.5 w-3.5">
            <path d="M19 4h-9M14 20H5M15 4l-6 16" />
          </Icon>
        </span>
        <span className="grid h-6 w-6 place-items-center rounded-md">
          <Icon className="h-3.5 w-3.5">
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
          </Icon>
        </span>
        <span className="mx-1 h-4 w-px flex-shrink-0 bg-[var(--color-border)]" />

        {/* Botón que abre el menú de accesorios */}
        <span
          className="vg-press ml-auto inline-flex h-6 flex-shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] font-medium text-[var(--color-fg-muted)]"
          style={{ ["--d" as string]: "1.2s" }}
        >
          <SparkleIcon className="h-3 w-3 text-[var(--color-accent)]" />
          Accesorio
        </span>
      </div>

      <div className="flex h-[344px] text-[11px] sm:h-[352px]">
        {/* Página del libro */}
        <div className="min-w-0 flex-1 overflow-hidden px-4 py-2.5">
          <div className="prose-editor text-[12px] leading-relaxed">
            <p className="my-0">
              Bajar el precio es la salida fácil. Cuando el cliente dice que está
              caro, casi siempre está diciendo otra cosa.
            </p>
            <p className="mb-0 mt-2">
              Antes de mover la cifra, mueve la referencia.
            </p>
          </div>

          {/* Hueco donde aterriza el accesorio: tres bloques que se relevan. */}
          <div className="mt-3 space-y-1.5 text-[11px]">
            {/* 1 · Frase destacada */}
            <div className="vg-grow" style={{ ["--d" as string]: "7.8s" }}>
              <div>
                <div
                  className="vg-shrink grid grid-rows-[1fr]"
                  style={{ ["--d" as string]: "9.6s" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <aside
                      className="book-deco book-pullquote"
                      style={{ margin: 0, padding: "0.7em 0.9em" }}
                    >
                      <span className="book-deco-label">Frase destacada</span>
                      <p>
                        El descuento no crea valor: solo lo destruye más rápido.
                      </p>
                    </aside>
                  </div>
                </div>
              </div>
            </div>

            {/* 2 · Tip */}
            <div className="vg-grow" style={{ ["--d" as string]: "9.8s" }}>
              <div>
                <div
                  className="vg-shrink grid grid-rows-[1fr]"
                  style={{ ["--d" as string]: "11.0s" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <aside
                      className="book-deco book-callout"
                      style={{ margin: 0, padding: "0.7em 0.9em" }}
                    >
                      <span className="book-deco-label">Tip</span>
                      <p>
                        Si te piden descuento antes de ver la propuesta, el
                        problema no es el número.
                      </p>
                    </aside>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 · Dato impactante */}
            <div className="vg-grow" style={{ ["--d" as string]: "11.2s" }}>
              <div>
                <aside
                  className="book-deco book-stat"
                  style={{ margin: 0, padding: "0.75em 0.9em" }}
                >
                  <strong>68%</strong>
                  <cite style={{ fontSize: "10px" }}>
                    de los descuentos no cambian la decisión de compra
                  </cite>
                </aside>
              </div>
            </div>
          </div>
        </div>

        {/* Columna del menú + modal (decorativa en pantallas chicas) */}
        <div className="hidden w-[216px] flex-shrink-0 flex-col gap-2 overflow-hidden border-l border-[var(--color-border)] p-2.5 sm:flex">
          {/* Menú del botón "Accesorio" */}
          <div className="vg-out" style={{ ["--d" as string]: "2.15s" }}>
            <div
              className="vg-in rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1 shadow-md"
              style={{ ["--d" as string]: "1.2s" }}
            >
              {KINDS.map((kind, i) => {
                const row = (
                  <div className="relative flex items-center gap-1.5 rounded-[6px] px-1.5 py-[2px]">
                    {i === 0 ? (
                      <span
                        className="vg-in absolute inset-0 rounded-[6px] bg-[var(--color-bg-muted)]"
                        style={{ ["--d" as string]: "1.8s" }}
                      />
                    ) : null}
                    <span className="relative grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                      {kind.icon}
                    </span>
                    <span className="relative min-w-0 flex-1 truncate text-[10px]">
                      {kind.label}
                    </span>
                  </div>
                );
                return (
                  <div
                    key={kind.label}
                    className="vg-in"
                    style={{ ["--d" as string]: `${1.3 + i * 0.06}s` }}
                  >
                    {i === 0 ? (
                      <div
                        className="vg-press"
                        style={{ ["--d" as string]: "2.05s" }}
                      >
                        {row}
                      </div>
                    ) : (
                      row
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal "Insertar Frase destacada" */}
          <div className="vg-out" style={{ ["--d" as string]: "7.45s" }}>
            <div
              className="vg-in rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5 shadow-md"
              style={{ ["--d" as string]: "2.3s" }}
            >
              <div className="text-[11px] font-semibold">
                Insertar Frase destacada
              </div>
              <div className="mt-0.5 text-[9px] leading-tight text-[var(--color-fg-subtle)]">
                Cita grande resaltada en el flujo del texto
              </div>

              <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  {/* Dos pulsaciones anidadas: "Generar con IA" y "Otra versión" */}
                  <span
                    className="vg-press inline-flex"
                    style={{ ["--d" as string]: "3s" }}
                  >
                    <span
                      className="vg-press inline-flex"
                      style={{ ["--d" as string]: "6.2s" }}
                    >
                      <span className="inline-flex h-5 items-center rounded-md bg-[var(--color-accent)] px-2 text-[9px] font-medium leading-none text-[var(--color-accent-fg)]">
                        <span
                          className="vg-odo"
                          style={{
                            ["--d" as string]: "1.95s",
                            ["--dur" as string]: "2.2s",
                            ["--stops" as string]: 2,
                          }}
                        >
                          <span>
                            <span className="inline-flex items-center gap-1 align-top">
                              <SparkleIcon className="h-2.5 w-2.5" />
                              Generar con IA
                            </span>
                          </span>
                          <span>
                            <span className="inline-flex items-center gap-1 align-top">
                              <VgSpinner className="h-2.5 w-2.5" />
                              Generando…
                            </span>
                          </span>
                          <span>
                            <span className="inline-flex items-center gap-1 align-top">
                              <Icon className="h-2.5 w-2.5">
                                <path d="M20 11A8 8 0 0 0 6.3 5.7L4 8" />
                                <path d="M4 4v4h4" />
                                <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" />
                                <path d="M20 20v-4h-4" />
                              </Icon>
                              Otra versión
                            </span>
                          </span>
                        </span>
                      </span>
                    </span>
                  </span>

                  {/* Navegación entre versiones */}
                  <span
                    className="vg-in flex flex-shrink-0 items-center gap-0.5 text-[9px] text-[var(--color-fg-muted)]"
                    style={{ ["--d" as string]: "5.7s" }}
                  >
                    <Icon className="h-2.5 w-2.5">
                      <path d="M14 6l-6 6 6 6" />
                    </Icon>
                    <span
                      className="vg-odo"
                      style={{
                        ["--d" as string]: "6.05s",
                        ["--dur" as string]: "0.35s",
                        ["--stops" as string]: 1,
                      }}
                    >
                      <span>1/1</span>
                      <span>2/2</span>
                    </span>
                    <Icon className="h-2.5 w-2.5">
                      <path d="M10 6l6 6-6 6" />
                    </Icon>
                  </span>
                </div>

                <div
                  className="vg-in mt-1 text-[9px] leading-tight text-[var(--color-fg-subtle)]"
                  style={{ ["--d" as string]: "5.75s" }}
                >
                  Fuente: del contenido escrito
                </div>
              </div>

              {/* Campo de texto con las dos versiones generadas */}
              <div className="mt-2 rounded-md border border-[var(--color-border)] px-2 py-1.5 font-serif text-[10px] italic leading-tight">
                <div>
                  <span
                    className="vg-odo"
                    style={{
                      ["--d" as string]: "6.05s",
                      ["--dur" as string]: "0.35s",
                      ["--stops" as string]: 1,
                    }}
                  >
                    <span>
                      <span
                        className="vg-type"
                        style={{
                          ["--d" as string]: "4.2s",
                          ["--steps" as string]: 27,
                        }}
                      >
                        Bajar el precio no responde
                      </span>
                    </span>
                    <span>El descuento no crea valor:</span>
                  </span>
                </div>
                <div>
                  <span
                    className="vg-odo"
                    style={{
                      ["--d" as string]: "6.05s",
                      ["--dur" as string]: "0.35s",
                      ["--stops" as string]: 1,
                    }}
                  >
                    <span>
                      <span
                        className="vg-type"
                        style={{
                          ["--d" as string]: "4.7s",
                          ["--steps" as string]: 23,
                        }}
                      >
                        una objeción de precio.
                      </span>
                    </span>
                    <span>solo lo destruye más rápido.</span>
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px]">
                <span className="rounded-md px-2 py-1 text-[var(--color-fg-muted)]">
                  Cancelar
                </span>
                <span
                  className="vg-press inline-flex rounded-md bg-[var(--color-accent)] px-2.5 py-1 font-medium text-[var(--color-accent-fg)]"
                  style={{ ["--d" as string]: "7.4s" }}
                >
                  Insertar
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Puntero: viaja de la página al botón "Accesorio" y se queda ahí. */}
      <VgCursor
        style={{
          left: "auto",
          right: 0,
          ["--x0" as string]: "-240px",
          ["--y0" as string]: "210px",
          ["--x1" as string]: "-72px",
          ["--y1" as string]: "62px",
          ["--dur" as string]: "0.8s",
          ["--d" as string]: "0.4s",
          transform: "translate(-72px, 62px)",
        }}
      />
    </VignetteFrame>
  );
}
