import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Empieza a escribir hoy
        </h1>
        <p className="text-[var(--color-fg-muted)] mt-2">
          Tu primer libro o curso, organizado por la IA.
        </p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-[var(--color-fg-muted)] mt-6">
        ¿Ya tienes cuenta?{" "}
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
