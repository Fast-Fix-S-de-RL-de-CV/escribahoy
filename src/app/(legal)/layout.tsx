import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

/**
 * Layout de lectura para los documentos legales. Columna angosta (max-w-3xl),
 * mucho aire y tipografía grande: son textos largos que la gente lee de
 * verdad cuando algo le preocupa.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <Logo size={36} wordmarkClassName="text-xl" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 py-12">{children}</article>
      </main>

      <SiteFooter />
    </div>
  );
}
