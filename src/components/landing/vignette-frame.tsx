"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Marco de las viñetas animadas de la landing.
 *
 * El bucle NO se hace con `animation-iteration-count: infinite`: cada viñeta
 * es una secuencia de muchos elementos con retardos distintos, y sincronizar
 * eso en un solo keyframe obliga a escribir porcentajes a mano para cada
 * elemento. En vez de eso las primitivas son de una sola pasada y aquí se
 * remonta la escena (`key={cycle}`) cada `loopMs`, lo que reinicia todas las
 * animaciones a la vez y mantiene la sincronía exacta.
 *
 * Sólo cicla cuando la viñeta está en pantalla y el usuario no pidió
 * movimiento reducido. En ambos casos contrarios el contenido queda en su
 * estado final —que es el estado base del CSS—, nunca en blanco.
 */
export function VignetteFrame({
  loopMs,
  className = "",
  label,
  children,
}: {
  loopMs: number;
  className?: string;
  /** Descripción para lectores de pantalla; la animación en sí es decorativa. */
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    if (!("IntersectionObserver" in window)) {
      setPlaying(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setPlaying(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCycle((c) => c + 1), loopMs);
    return () => window.clearInterval(timer);
  }, [playing, loopMs]);

  return (
    <div
      ref={ref}
      className={`vg ${className}`}
      data-play={playing ? "true" : "false"}
      role="img"
      aria-label={label}
    >
      <div key={cycle}>{children}</div>
    </div>
  );
}

/** Barra superior falsa, idéntica a la topbar real del proyecto. */
export function VgTopbar({
  title,
  meta,
  right,
}: {
  title: string;
  meta: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-3 py-2.5">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight">{title}</span>
        <span className="block truncate text-[10px] leading-tight text-[var(--color-fg-subtle)]">{meta}</span>
      </span>
      {right ? <span className="ml-auto flex items-center gap-1.5">{right}</span> : null}
    </div>
  );
}

/** Fila del outline, con la misma anatomía que el sidebar del producto. */
export function VgOutlineRow({
  num,
  title,
  status = "empty",
  active,
  header,
  className = "",
  style,
  children,
}: {
  num?: string;
  title?: string;
  status?: "empty" | "draft" | "in_progress" | "complete";
  active?: boolean;
  header?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  if (header) {
    return (
      <div
        className={`px-2.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] ${className}`}
        style={style}
      >
        {header}
      </div>
    );
  }

  const dot =
    status === "complete"
      ? "bg-[var(--color-success)]"
      : status === "in_progress"
        ? "bg-[var(--color-accent)]"
        : status === "draft"
          ? "bg-amber-400"
          : "bg-[var(--color-border-strong)]";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
        active ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : ""
      } ${className}`}
      style={style}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
      {num ? (
        <span className="flex-shrink-0 font-mono text-[10px] text-[var(--color-fg-subtle)]">{num}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[11px]">{title}</span>
      {children}
    </div>
  );
}

/** Spinner circular equivalente al del producto. */
export function VgSpinner({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`spin-progress ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function VgCheck({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className} aria-hidden="true">
      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Puntero para las escenas donde algo se pulsa. */
export function VgCursor({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="vg-cursor pointer-events-none absolute left-0 top-0 z-20 h-4 w-4 drop-shadow-sm"
      style={style}
      aria-hidden="true"
    >
      <path d="M5 2.5 19 12l-6.2 1.1L9.8 19 5 2.5z" fill="#1c1917" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
