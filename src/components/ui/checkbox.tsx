import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = {
  id?: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Checkbox accesible del design system. Server-safe: no usa hooks ni APIs del
 * navegador (si el consumidor pasa `onChange`, ese consumidor debe ser "use
 * client"; sin `onChange` funciona en un Server Component).
 *
 * - El <input type="checkbox"> real es sr-only (no display:none) para que el
 *   form lo envíe, `required` dispare la validación nativa del navegador y el
 *   control siga siendo enfocable con teclado.
 * - La caja visual y el CheckIcon reaccionan al input con las variantes
 *   peer-checked:/peer-focus-visible: de Tailwind.
 * - ENLACES DENTRO DEL LABEL: por spec de HTML, el activation behavior del
 *   <label> NO se dispara cuando el click va a "interactive content" (p.ej.
 *   <a href>) ni a sus descendientes, así que un <a> dentro de {children} navega
 *   sin togglear el checkbox y NO necesita stopPropagation. Solo si el
 *   consumidor mete algo no-interactivo con onClick propio (un <span
 *   onClick>...) debe llamar e.preventDefault() para que el label no togglee.
 */
export function Checkbox({
  id,
  name,
  checked,
  defaultChecked,
  onChange,
  required,
  className,
  children,
}: CheckboxProps): React.JSX.Element {
  return (
    // `relative` mantiene al input sr-only (position:absolute) anclado aquí,
    // para que la burbuja de validación nativa salga junto a la caja.
    // `group` habilita el hover de la caja desde cualquier parte del label.
    <label
      className={cn(
        "group relative flex items-start gap-3 cursor-pointer",
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        required={required}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          // mt-0.5 centra la caja de 20px con la primera línea de texto-base
          // (line-height 24px). Alinea bien junto a inputs h-14.
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
          // --radius-sm son exactamente los 6px del diseño.
          "rounded-[var(--radius-sm)] border border-[var(--color-border-strong)]",
          "bg-[var(--color-bg-elevated)] transition-colors",
          "group-hover:not-peer-checked:border-[var(--color-fg-subtle)]",
          "peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2",
          // El icono es descendiente (no hermano) del input, así que la variante
          // peer-checked se aplica sobre esta caja apuntando al svg de adentro.
          "peer-checked:[&_svg]:opacity-100"
        )}
      >
        <CheckIcon
          className="h-3.5 w-3.5 text-white opacity-0 transition-opacity"
          strokeWidth={3}
        />
      </span>
      <span className="text-base leading-6 text-[var(--color-fg-muted)]">
        {children}
      </span>
    </label>
  );
}
