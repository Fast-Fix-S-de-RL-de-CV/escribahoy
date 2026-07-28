/**
 * MEDICIÓN de costo de IA. Este módulo NO decide nada: solo mide y registra.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 * Medido con la API de conteo de tokens de Anthropic sobre el contexto REAL
 * de producción: 1 mensaje de chat = 21,552 tokens de entrada, 1 temario =
 * 15,430. A precio de Opus, un usuario del plan de 499 MXN que agote su cuota
 * de chat cuesta más que su mensualidad: margen NEGATIVO. No se puede
 * optimizar lo que no se mide, así que cada llamada a la IA deja aquí su
 * huella de tokens y su costo en dólares.
 *
 * ── SEPARACIÓN DE RESPONSABILIDADES (a propósito) ─────────────────────────
 * `registrarUso()` NO toca cuotas ni contadores de periodo. El gating vive en
 * `src/lib/quotas.ts` y lo llama quien invoca a la IA, ANTES de gastar. Si
 * este módulo importara quotas.ts, medir y cobrar quedarían acoplados y un
 * fallo del contador tumbaría la medición (o al revés).
 */

import { nanoid } from "nanoid";
import { db } from "./db";
import { aiUsage } from "./schema";
import type { AccionIA } from "./plans";

export type ModeloIA = "opus" | "sonnet" | "haiku";

/**
 * Precio en USD por 1,000,000 de tokens. Si Anthropic cambia precios, esto es
 * lo único que hay que editar: el resto del cálculo se deriva de aquí.
 */
export const PRECIOS_USD: Record<ModeloIA, { entrada: number; salida: number }> =
  {
    opus: { entrada: 5, salida: 25 },
    sonnet: { entrada: 3, salida: 15 },
    haiku: { entrada: 1, salida: 5 },
  };

/**
 * Multiplicadores del prompt caching (TTL de 5 minutos, el default):
 *  · LEER de caché cuesta 0.1x el precio de entrada (90% de descuento).
 *  · ESCRIBIR la caché cuesta 1.25x el precio de entrada (premium de 25%).
 * Con TTL de 5 min el punto de equilibrio son DOS requests con el mismo
 * prefijo (1.25x + 0.1x = 1.35x contra 2x sin caché). Si algún día se usa
 * `ttl: "1h"`, la escritura pasa a 2x y hacen falta tres.
 */
export const MULT_CACHE_LECTURA = 0.1;
export const MULT_CACHE_ESCRITURA = 1.25;

/**
 * String EXACTO del modelo que se manda a la API. No se construyen a mano ni
 * se les agrega sufijo de fecha: los alias ya son completos.
 */
const IDS_MODELO: Record<ModeloIA, string> = {
  // Opus 5 cuesta lo MISMO por token que Opus 4.7 (5/25 USD por millón), así
  // que subir de versión no cuesta nada por token — solo escribe un poco más.
  opus: "claude-opus-5",
  sonnet: "claude-sonnet-5",
  haiku: "claude-haiku-4-5",
};

export function modeloId(m: ModeloIA): string {
  return IDS_MODELO[m];
}

/** Costo en USD de una llamada. Los tokens de caché se cobran distinto. */
export function costoUsd(
  m: ModeloIA,
  u: { input: number; output: number; cacheRead?: number; cacheWrite?: number }
): number {
  const p = PRECIOS_USD[m];
  const porMillon = (tokens: number, precio: number) =>
    (tokens / 1_000_000) * precio;
  return (
    porMillon(u.input, p.entrada) +
    porMillon(u.cacheRead ?? 0, p.entrada * MULT_CACHE_LECTURA) +
    porMillon(u.cacheWrite ?? 0, p.entrada * MULT_CACHE_ESCRITURA) +
    porMillon(u.output, p.salida)
  );
}

/**
 * Lee el objeto `usage` de una respuesta del SDK de Anthropic sin confiar en
 * su forma. Los campos de caché son `number | null` en el SDK y pueden faltar
 * por completo en respuestas de error o en versiones distintas del SDK, así
 * que aquí todo lo que no sea un número finito y positivo cuenta como 0.
 * Nunca lanza: si esto reventara, tumbaría la respuesta de IA del usuario.
 */
export function usoDeRespuesta(usage: unknown): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
} {
  const u = (usage ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  return {
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cacheRead: n(u.cache_read_input_tokens),
    cacheWrite: n(u.cache_creation_input_tokens),
  };
}

/**
 * Guarda la huella de una llamada a la IA.
 *
 * ⚠️ NUNCA LANZA. Se llama después de que la IA ya respondió: si la métrica
 * falla, se pierde un renglón de telemetría, no la respuesta del usuario.
 * Por eso el try/catch se traga todo y solo loguea.
 */
export async function registrarUso(o: {
  userId: string;
  projectId?: string | null;
  accion: AccionIA | "kb";
  modelo: ModeloIA;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): Promise<void> {
  try {
    const cacheRead = o.cacheReadTokens ?? 0;
    const cacheWrite = o.cacheWriteTokens ?? 0;
    await db.insert(aiUsage).values({
      id: nanoid(),
      userId: o.userId,
      projectId: o.projectId ?? null,
      accion: o.accion,
      modelo: o.modelo,
      inputTokens: o.inputTokens,
      outputTokens: o.outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costoUsd: costoUsd(o.modelo, {
        input: o.inputTokens,
        output: o.outputTokens,
        cacheRead,
        cacheWrite,
      }),
    });
  } catch (e) {
    console.error("[ai-usage] no se pudo registrar el uso:", e);
  }
}
