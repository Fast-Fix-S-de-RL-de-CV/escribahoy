import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-lg text-[var(--color-fg-muted)] mt-3">
          Te enviamos un enlace para crear una nueva.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-base text-[var(--color-fg-muted)] mt-8">
        ¿Ya la recordaste?{" "}
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
