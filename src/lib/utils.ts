import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Cuenta palabras de un fragmento que puede traer HTML. Quita tags, decodifica
 * entidades comunes a espacio (&nbsp;, &amp;, &#160;, etc.) y normaliza el
 * whitespace antes de contar. Así `<p>&nbsp;</p>` cuenta 0 (no 1), y el status
 * derivado (empty/draft/in_progress) es correcto. Es la fuente única de verdad
 * usada por cliente y servidor.
 */
export function wordCount(text: string): number {
  if (!text) return 0;
  const words = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.length;
}

export function formatRelative(date: Date | number | string): string {
  const d = new Date(date);
  // Fecha inválida: no inventar 'Invalid Date' en la UI.
  if (isNaN(d.getTime())) return "";
  // Fechas futuras (relojes desfasados / datos importados): clamp a 0.
  const diff = Math.max(0, Date.now() - d.getTime());
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
