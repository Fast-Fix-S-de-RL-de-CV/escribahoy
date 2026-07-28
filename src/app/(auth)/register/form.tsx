"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { registerAction, type AuthState } from "@/lib/actions/auth";

/**
 * Enlaces legales que viven DENTRO del label del checkbox.
 *
 * Dos cosas resueltas a propósito:
 * 1. NO togglean el checkbox. Por spec, el activation behavior del <label> ya
 *    se salta el "interactive content" (<a href>), pero además cortamos la
 *    propagación del click para que el label ni se entere: así el
 *    comportamiento no depende de esa sutileza del navegador.
 * 2. NO pierden lo ya escrito: abren en pestaña nueva (target="_blank"), de
 *    modo que el formulario a medio llenar se queda intacto. rel="noopener
 *    noreferrer" evita que la pestaña nueva pueda tocar window.opener.
 */
function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-[var(--color-accent)] hover:underline"
    >
      {children}
    </Link>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerAction,
    undefined
  );

  // React 19 resetea el <form action> al terminar la acción. Sin estos
  // defaults, un error como "Ya existe una cuenta con ese email" borraba
  // nombre, correo y la casilla de términos, obligando a teclear todo de nuevo.
  const nameValue = state?.values?.name ?? "";
  const emailValue = state?.values?.email ?? "";
  const termsValue = state?.values?.terms ?? false;

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
              autoComplete="name"
              defaultValue={nameValue}
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
              autoComplete="email"
              defaultValue={emailValue}
              className="h-14 text-lg px-5"
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-14 text-lg px-5"
            />
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              Mínimo 8 caracteres
            </p>
          </div>
          <Checkbox id="terms" name="terms" required defaultChecked={termsValue}>
            {/* text-sm en el span interno: pesa menos que los campos y gana
                sobre el text-base del wrapper del Checkbox por estar en el
                elemento más cercano. */}
            <span className="block text-sm leading-relaxed">
              Acepto los{" "}
              <LegalLink href="/terminos">Términos y Condiciones</LegalLink> y el{" "}
              <LegalLink href="/privacidad">Aviso de Privacidad</LegalLink>.
            </span>
          </Checkbox>
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
