import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function wordCount(text: string): number {
  if (!text) return 0;
  const stripped = text.replace(/<[^>]*>/g, " ").replace(/&\w+;/g, " ");
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function formatRelative(date: Date | number | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "ahora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day}d`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}
