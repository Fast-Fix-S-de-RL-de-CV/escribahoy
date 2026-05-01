import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md bg-[var(--color-accent)] grid place-items-center text-white font-serif font-bold">
            E
          </span>
          <span className="font-semibold tracking-tight">Escribahoy</span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}
