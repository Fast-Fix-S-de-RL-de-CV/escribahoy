import * as React from "react";
import { MailIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas de composición para los documentos legales (/privacidad, /terminos).
 * Son componentes puros de presentación: sin estado, sin hooks, sin fechas
 * calculadas. La fecha de "última actualización" siempre se pasa como string
 * estático desde cada página para que el documento sea reproducible.
 */

export function DocHeader({
  title,
  lead,
  updatedAt,
}: {
  title: string;
  lead?: React.ReactNode;
  updatedAt: string;
}) {
  return (
    <header className="mb-10 pb-8 border-b border-[var(--color-border)]">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-brand-ink)]">
        {title}
      </h1>
      <p className="mt-3 text-sm font-medium text-[var(--color-fg-subtle)]">
        Última actualización: {updatedAt}
      </p>
      {lead && (
        <p className="mt-5 text-base leading-relaxed text-[var(--color-fg-muted)]">
          {lead}
        </p>
      )}
    </header>
  );
}

/** Índice de contenidos con anclas a cada sección. */
export function Toc({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <nav
      aria-label="Contenido del documento"
      className="mb-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
        Contenido
      </p>
      <ol className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={item.id} className="text-base leading-relaxed">
            <a
              href={`#${item.id}`}
              className="text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
            >
              <span className="tabular-nums text-[var(--color-fg-subtle)]">
                {i + 1}.
              </span>{" "}
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 first:mt-0">
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
        {typeof n === "number" && (
          <span className="text-[var(--color-fg-subtle)] tabular-nums">
            {n}.{" "}
          </span>
        )}
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-[var(--color-fg)] pt-2">
      {children}
    </h3>
  );
}

export function P({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-base leading-relaxed text-[var(--color-fg-muted)]",
        className
      )}
    >
      {children}
    </p>
  );
}

export function Bullets({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "list-disc pl-6 space-y-2.5 text-base leading-relaxed text-[var(--color-fg-muted)] marker:text-[var(--color-accent)]",
        className
      )}
    >
      {children}
    </ul>
  );
}

export function Numbers({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "list-decimal pl-6 space-y-2.5 text-base leading-relaxed text-[var(--color-fg-muted)] marker:text-[var(--color-fg-subtle)] marker:tabular-nums",
        className
      )}
    >
      {children}
    </ol>
  );
}

export function Item({ children }: { children: React.ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

/** Resalta el término de una lista sin romper la lectura del párrafo. */
export function Term({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-semibold text-[var(--color-fg)]">{children}</strong>
  );
}

/** Bloque destacado para cláusulas que el usuario NO debería pasar por alto. */
export function Highlight({
  icon: Icon = InfoIcon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] px-5 py-4">
      <div className="flex gap-3">
        <Icon
          className="h-5 w-5 shrink-0 mt-0.5 text-[var(--color-accent)]"
          strokeWidth={2}
        />
        <div className="space-y-2">
          {title && (
            <p className="text-base font-semibold text-[var(--color-brand-ink)]">
              {title}
            </p>
          )}
          <div className="text-base leading-relaxed text-[var(--color-fg-muted)] space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Enlace mailto consistente en los dos documentos. */
export function MailLink({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
    >
      {address}
    </a>
  );
}

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
    >
      {children}
    </a>
  );
}

/** Tarjeta de contacto al pie de cada documento. */
export function ContactBox({
  address,
  children,
}: {
  address: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-5">
      <div className="flex gap-3">
        <MailIcon
          className="h-5 w-5 shrink-0 mt-0.5 text-[var(--color-accent)]"
          strokeWidth={2}
        />
        <div className="space-y-2">
          <p className="text-base font-semibold text-[var(--color-fg)]">
            ¿Dudas sobre este documento?
          </p>
          <p className="text-base leading-relaxed text-[var(--color-fg-muted)]">
            Escríbenos a <MailLink address={address} /> y te contestamos una
            persona real.
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
