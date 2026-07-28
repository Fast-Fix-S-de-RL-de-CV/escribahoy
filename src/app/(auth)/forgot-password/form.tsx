"use client";

import { useActionState } from "react";
import { MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import {
  forgotPasswordAction,
  type ForgotState,
} from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    forgotPasswordAction,
    undefined
  );

  // Éxito: reemplazamos el formulario para que no quede la tentación de volver
  // a pedir otro enlace (y quemar el rate limit) creyendo que no pasó nada.
  // El texto es a propósito genérico: nunca confirmamos si el correo existe.
  if (state?.ok) {
    return (
      <Card>
        <CardBody className="p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] mx-auto mb-5">
            <MailCheckIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Revisa tu correo
          </h2>
          <p className="text-base text-[var(--color-fg-muted)] mt-3 leading-relaxed">
            Si existe una cuenta con ese correo, ya va en camino un enlace para
            crear tu nueva contraseña. El enlace vence en 60 minutos.
          </p>
          <p className="text-sm text-[var(--color-fg-muted)] mt-4">
            ¿No lo ves? Revisa la carpeta de spam o correo no deseado.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-8">
        <form action={action} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="h-14 text-lg px-5"
            />
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              El correo con el que creaste tu cuenta.
            </p>
          </div>
          {state?.error && (
            <p className="text-base text-[var(--color-danger)]">{state.error}</p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full text-base"
            disabled={pending}
          >
            {pending ? "Enviando..." : "Enviarme el enlace"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
