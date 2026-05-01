"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { loginAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    undefined
  );
  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Iniciar sesión"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
