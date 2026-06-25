"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { registerAction, type AuthState } from "@/lib/actions/auth";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerAction,
    undefined
  );
  return (
    <Card>
      <CardBody className="p-8">
        <form action={action} className="space-y-6">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              required
              autoFocus
              className="h-14 text-lg px-5"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="h-14 text-lg px-5"
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="h-14 text-lg px-5"
            />
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              Mínimo 8 caracteres
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
            {pending ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
