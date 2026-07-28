import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ResetPasswordForm } from "./form";

/**
 * En esta versión de Next (16.2.4) `searchParams` es una PROMESA: hay que
 * await-earla dentro de un Server Component async
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:
 * "A promise that resolves to an object containing the search parameters...
 * Since the `searchParams` prop is a promise. You must use `async/await` or
 * React's `use` function to access the values").
 *
 * Además el valor de una clave puede llegar como string[] si la URL repite el
 * parámetro (`?token=a&token=b`), así que normalizamos antes de usarlo.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await props.searchParams;
  const raw = Array.isArray(token) ? token[0] : token;
  const cleanToken = (raw ?? "").trim();

  // Sin token no hay nada que resetear: mostramos una salida clara en vez de
  // un formulario que fallaría al enviarse.
  if (!cleanToken) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">
            Enlace no válido
          </h1>
          <p className="text-lg text-[var(--color-fg-muted)] mt-3">
            Este enlace está incompleto o ya venció.
          </p>
        </div>
        <Card>
          <CardBody className="p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-[var(--color-bg-muted)] grid place-items-center text-[var(--color-warning)] mx-auto mb-5">
              <TriangleAlertIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Pide un enlace nuevo
            </h2>
            <p className="text-base text-[var(--color-fg-muted)] mt-3 leading-relaxed">
              Los enlaces para cambiar la contraseña vencen a los 60 minutos y
              solo sirven una vez. Escribe tu correo y te mandamos otro.
            </p>
            <Link href="/forgot-password" className="block mt-6">
              <Button size="lg" className="w-full text-base">
                Solicitar enlace nuevo
              </Button>
            </Link>
          </CardBody>
        </Card>
        <p className="text-center text-base text-[var(--color-fg-muted)] mt-8">
          <Link
            href="/login"
            className="text-[var(--color-accent)] font-medium hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          Crea tu nueva contraseña
        </h1>
        <p className="text-lg text-[var(--color-fg-muted)] mt-3">
          Escríbela dos veces y listo.
        </p>
      </div>
      <ResetPasswordForm token={cleanToken} />
      <p className="text-center text-base text-[var(--color-fg-muted)] mt-8">
        ¿Prefieres entrar con la de siempre?{" "}
        <Link
          href="/login"
          className="text-[var(--color-accent)] font-medium hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
