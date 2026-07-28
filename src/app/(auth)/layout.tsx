import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size={36} wordmarkClassName="text-xl" />
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 pb-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
