import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Bienvenido de vuelta</h1>
        <p className="text-[var(--color-fg-muted)] mt-2">
          Sigue escribiendo donde lo dejaste.
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-[var(--color-fg-muted)] mt-6">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href="/register"
          className="text-[var(--color-accent)] font-medium hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
