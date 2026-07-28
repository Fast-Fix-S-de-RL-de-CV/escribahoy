import { CheckIcon } from "lucide-react";

/**
 * Fila de módulo en zigzag: copy de un lado, viñeta animada del otro,
 * alternando el lado en cada módulo.
 *
 * En móvil siempre se apila con el texto primero: la viñeta es apoyo visual,
 * no debe empujar el mensaje fuera de la primera pantalla. El intercambio de
 * lados se hace con `order` en el breakpoint grande, no reordenando el DOM,
 * para que el orden de lectura y el foco del teclado sigan el orden real.
 */
export function ZigZag({
  id,
  eyebrow,
  headline,
  body,
  bullets,
  media,
  flip = false,
}: {
  id?: string;
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  media: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section
      id={id}
      className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20"
    >
      <div className={flip ? "lg:order-2" : undefined}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
          {eyebrow}
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {headline}
        </h2>
        <p className="mt-4 leading-relaxed text-[var(--color-fg-muted)]">{body}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <CheckIcon className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`min-w-0 ${flip ? "lg:order-1" : ""}`}>{media}</div>
    </section>
  );
}
