import Link from "next/link";
import {
  LayoutDashboardIcon,
  PlusIcon,
  LogOutIcon,
  HeartIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";
import type { SafeUser } from "@/lib/auth";

export function AppShell({
  user,
  children,
  active,
}: {
  user: SafeUser;
  children: React.ReactNode;
  active?: "dashboard" | "new";
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex-col">
        <Link href="/" className="px-5 py-4 flex items-center border-b border-[var(--color-border)]">
          <Logo size={30} wordmarkClassName="text-lg" />
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          <SideLink
            href="/dashboard"
            icon={<LayoutDashboardIcon className="h-4 w-4" />}
            active={active === "dashboard"}
          >
            Dashboard
          </SideLink>
          <SideLink
            href="/onboarding"
            icon={<PlusIcon className="h-4 w-4" />}
            active={active === "new"}
          >
            Nuevo proyecto
          </SideLink>
        </nav>
        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="px-3 py-2 text-xs text-[var(--color-fg-subtle)]">
            {user.name}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]"
            >
              <LogOutIcon className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
          <div className="px-3 pt-3 mt-1 flex items-center justify-center gap-1 text-[10px] text-[var(--color-fg-subtle)] border-t border-[var(--color-border)]">
            <span>Hecho con</span>
            <HeartIcon
              className="h-2.5 w-2.5 text-[var(--color-danger)]"
              fill="currentColor"
            />
            <span>en México ·</span>
            <a
              href="https://fast-fix.com.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-[var(--color-accent)]"
            >
              Fast Fix IT
            </a>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function SideLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)]"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
