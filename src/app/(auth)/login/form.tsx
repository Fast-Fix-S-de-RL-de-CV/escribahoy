"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    undefined
  );

  // Si volvemos a un correo ya recordado, el usuario solo tiene que escribir la
  // contraseña: ahí va el foco y la casilla arranca marcada (si la desmarca, la
  // acción borra la cookie).
  const remembered = defaultEmail.length > 0;

  // Tras un intento fallido manda lo que la persona acababa de escribir: React
  // 19 resetea el form al terminar la acción, y sin esto había que reteclear el
  // correo en cada intento (gastando el rate limit de 10/15min).
  const emailValue = state?.values?.email ?? defaultEmail;
  const rememberValue = state?.values?.remember ?? remembered;

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
              autoComplete="email"
              defaultValue={emailValue}
              autoFocus={!emailValue}
              className="h-14 text-lg px-5"
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
              autoFocus={!!emailValue}
              className="h-14 text-lg px-5"
            />
          </div>
          {/* flex-wrap + gap-y: en pantallas angostas el enlace baja a su propia
              línea en vez de encimarse con el checkbox. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {/* El texto dice lo que el campo REALMENTE hace: `remember` no solo
                prellena el correo, también vuelve la sesión persistente (30
                días en disco en vez de morir al cerrar el navegador). Con la
                etiqueta anterior ("Recordar mi correo"), alguien en una
                computadora compartida la marcaba creyendo que solo prellenaba
                el campo y dejaba la sesión abierta para el siguiente. */}
            <Checkbox name="remember" defaultChecked={rememberValue}>
              Mantener mi sesión abierta en este equipo
            </Checkbox>
            <Link
              href="/forgot-password"
              className="text-base font-medium text-[var(--color-accent)] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
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
            {pending ? "Entrando..." : "Iniciar sesión"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
