import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escribahoy — Escribe tu libro o curso con IA",
  description:
    "Una herramienta donde tus ideas sueltas se convierten en capítulos. La IA organiza, tú escribes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
        {children}
      </body>
    </html>
  );
}
