import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/auth";
import {
  BookOpenIcon,
  ListTreeIcon,
  SparklesIcon,
  UploadCloudIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  CheckIcon,
} from "lucide-react";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center">
          <Logo size={34} wordmarkClassName="text-xl" />
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard">
              <Button>Ir al dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Iniciar sesión</Button>
              </Link>
              <Link href="/register">
                <Button>Empezar gratis</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 py-20 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-xs font-medium mb-6">
            <SparklesIcon className="h-3.5 w-3.5" />
            Powered by Claude Opus
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight max-w-3xl mx-auto leading-[1.05]">
            Tus ideas sueltas se convierten en{" "}
            <span className="text-[var(--color-accent)]">capítulos</span>.
          </h1>
          <p className="text-lg text-[var(--color-fg-muted)] mt-6 max-w-2xl mx-auto">
            Escribe tu libro o tu curso sin perder ninguna idea. Sube tus PDFs,
            cuéntale a EscribaHoy lo que tienes en la cabeza, y la IA va organizando
            todo en su lugar.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link href={user ? "/dashboard" : "/register"}>
              <Button size="lg" className="gap-2">
                {user ? "Ir al dashboard" : "Empezar mi primer libro"}
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how">
              <Button size="lg" variant="ghost">
                Ver cómo funciona
              </Button>
            </Link>
          </div>
        </section>

        <section id="how" className="px-6 py-16 max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature
              icon={<UploadCloudIcon className="h-5 w-5" />}
              title="Knowledge base inicial"
              text="Suelta PDFs, notas, cualquier material. La IA extrae lo importante."
            />
            <Feature
              icon={<ListTreeIcon className="h-5 w-5" />}
              title="Outline desde el día 1"
              text="Antes de escribir el primer capítulo, ya tienes el temario completo."
            />
            <Feature
              icon={<BookOpenIcon className="h-5 w-5" />}
              title="Tú escribes, la IA organiza"
              text="Cuéntale tus ideas. EscribaHoy las pone donde corresponden."
            />
            <Feature
              icon={<GraduationCapIcon className="h-5 w-5" />}
              title="Modo curso + teleprompter"
              text="Cada lección genera su guión listo para grabar."
            />
          </div>
        </section>

        <section className="px-6 py-20 max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Un wizard que vive contigo durante todo el proyecto.
              </h2>
              <p className="text-[var(--color-fg-muted)] mt-4 leading-relaxed">
                EscribaHoy no escribe capítulos completos por ti. Aporta una idea, una
                referencia o una sugerencia estructural, y deja que tú llenes el
                contenido. Así el libro o curso se siente realmente tuyo.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Detecta a qué capítulo pertenece cada idea suelta",
                  "Te muestra avance por capítulo en tiempo real",
                  "Genera glosarios automáticamente",
                  "Convierte cualquier sección en guión listo para teleprompter",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center flex-shrink-0 mt-0.5">
                      <CheckIcon className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--color-bg-elevated)] rounded-[var(--radius-xl)] border border-[var(--color-border)] p-6 shadow-sm">
              <div className="text-xs text-[var(--color-fg-subtle)] mb-3">
                Outline del proyecto
              </div>
              <div className="space-y-2 font-serif">
                <OutlineRow done title="Capítulo 1 · Introducción" sub="2,340 palabras" />
                <OutlineRow done title="Capítulo 2 · Fundamentos" sub="1,820 palabras" />
                <OutlineRow active title="Capítulo 3 · Casos prácticos" sub="640 palabras · escribiendo ahora" />
                <OutlineRow title="Capítulo 4 · Errores comunes" sub="vacío" />
                <OutlineRow title="Capítulo 5 · Cierre" sub="vacío" />
                <OutlineRow muted title="Glosario" sub="auto-generado" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <div className="h-9 w-9 rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center mb-3">
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function OutlineRow({
  title,
  sub,
  done,
  active,
  muted,
}: {
  title: string;
  sub: string;
  done?: boolean;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md ${
        active ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-bg-muted)]"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full flex-shrink-0 ${
          done
            ? "bg-[var(--color-success)]"
            : active
              ? "bg-[var(--color-accent)] animate-pulse-soft"
              : muted
                ? "bg-[var(--color-fg-subtle)]"
                : "bg-[var(--color-border-strong)]"
        }`}
      />
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[var(--color-fg-subtle)]">{sub}</div>
      </div>
    </div>
  );
}
