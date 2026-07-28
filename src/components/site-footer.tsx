import { HeartIcon } from "lucide-react";

/**
 * Franja de crédito delgada (una sola fila) para el pie de las páginas.
 * El corazón es un ícono lucide (no emoji) por convención de UI.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`px-6 py-4 border-t border-[var(--color-border)] ${className}`}
    >
      <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-fg-subtle)] text-center">
        <span>Hecho con</span>
        <HeartIcon
          className="h-3.5 w-3.5 text-[var(--color-danger)]"
          fill="currentColor"
          aria-label="amor"
        />
        <span>en México · Desarrollado por</span>
        <a
          href="https://fast-fix.com.mx"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          Fast Fix IT
        </a>
      </div>
    </footer>
  );
}
