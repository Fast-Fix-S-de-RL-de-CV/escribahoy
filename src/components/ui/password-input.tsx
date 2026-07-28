"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con botón de "ojito" para alternar la visibilidad.
 *
 * - Reenvía TODAS las props de input (name, id, required, autoComplete,
 *   autoFocus, minLength, placeholder, onChange, value/defaultValue...) y el
 *   ref al <input> real, así que funciona controlado y no controlado.
 * - Alternar la visibilidad solo cambia el atributo `type` del MISMO input, por
 *   lo que el valor escrito nunca se pierde (React no remonta el elemento).
 *
 * Uso típico en auth (tamaños Typeform):
 *   <PasswordInput name="password" required className="h-14 text-lg px-5" />
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className, disabled, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);
  const actionLabel = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        disabled={disabled}
        // `type` va DESPUÉS del spread: el consumidor no puede romper el campo.
        type={visible ? "text" : "password"}
        // `pr-12` va al FINAL del cn: tailwind-merge descarta la clase anterior
        // cuando choca con una posterior, y `px-5` (que suele venir del
        // consumidor) choca con `pr-*`. Al ir de último sobrevive al merge, y en
        // el CSS generado `padding-right` se emite después de `padding-inline`,
        // así que gana. Deja ~48px libres para el botón del ojito.
        className={cn(className, "pr-12")}
      />
      <button
        // CRÍTICO: sin type="button" este botón haría submit del <form>.
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Evita que el input pierda foco y caret al hacer clic con el mouse.
        // No usamos tabIndex={-1}: el botón sigue alcanzable con Tab (0).
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={actionLabel}
        aria-pressed={visible}
        title={actionLabel}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center",
          "rounded-[var(--radius-sm)] text-[var(--color-fg-subtle)] transition-colors",
          "hover:text-[var(--color-fg-muted)]",
          // focus-visible: al hacer clic no aparece anillo (el foco visual se
          // queda en el input); con teclado sí se ve.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
