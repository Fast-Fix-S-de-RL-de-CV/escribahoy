"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction, type ResetState } from "@/lib/actions/auth";

const MISMATCH = "Las dos contraseñas no coinciden";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    undefined
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Error de cliente: lo ponemos al intentar enviar, no mientras escribe (nadie
  // quiere ver "no coinciden" en la primera letra que teclea del segundo campo).
  const [localError, setLocalError] = useState<string | null>(null);

  if (state?.ok) {
    return (
      <Card>
        <CardBody className="p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] mx-auto mb-5">
            <CheckCircle2Icon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Tu contraseña quedó lista
          </h2>
          <p className="text-base text-[var(--color-fg-muted)] mt-3 leading-relaxed">
            Por seguridad cerramos las sesiones abiertas en los demás
            dispositivos. Entra de nuevo con tu contraseña nueva.
          </p>
          <Link href="/login" className="block mt-6">
            <Button size="lg" className="w-full text-base">
              Iniciar sesión
            </Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  // El error de cliente manda mientras exista; en cuanto la acción responde,
  // ya la limpiamos en el submit y se ve el mensaje del servidor.
  const error = localError ?? state?.error;

  return (
    <Card>
      <CardBody className="p-8">
        <form
          action={action}
          // Validación de cliente: si no coinciden, preventDefault corta el
          // envío ANTES de que React dispare la Server Action (React respeta el
          // defaultPrevented del submit). La acción valida lo mismo del lado
          // del servidor, así que esto solo ahorra el viaje, no lo sustituye.
          onSubmit={(e) => {
            if (password !== confirm) {
              e.preventDefault();
              setLocalError(MISMATCH);
              return;
            }
            setLocalError(null);
          }}
          className="space-y-6"
        >
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError(null);
              }}
              className="h-14 text-lg px-5"
            />
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              Mínimo 8 caracteres
            </p>
          </div>
          <div>
            <Label htmlFor="passwordConfirm">Repite la contraseña</Label>
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setLocalError(null);
              }}
              className="h-14 text-lg px-5"
            />
          </div>
          {error && (
            <p className="text-base text-[var(--color-danger)]">{error}</p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full text-base"
            disabled={pending}
          >
            {pending ? "Guardando..." : "Guardar contraseña"}
          </Button>
          <p className="text-center text-sm text-[var(--color-fg-muted)]">
            ¿El enlace ya venció?{" "}
            <Link
              href="/forgot-password"
              className="text-[var(--color-accent)] hover:underline"
            >
              Pide uno nuevo
            </Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
