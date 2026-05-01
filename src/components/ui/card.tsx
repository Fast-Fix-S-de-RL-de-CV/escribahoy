import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-5 border-b border-[var(--color-border)]", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "accent" | "muted";
}) {
  const variants = {
    default: "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-700",
    accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    muted: "bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "w-full h-1.5 rounded-full bg-[var(--color-bg-subtle)] overflow-hidden",
        className
      )}
    >
      <div
        className="h-full bg-[var(--color-accent)] transition-all duration-500 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
