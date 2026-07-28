/**
 * Rate limiter en memoria, ventana deslizante.
 *
 * ALCANCE: es POR PROCESO, no distribuido. No sobrevive a un reinicio ni se
 * comparte entre instancias. Basta para este despliegue porque el server corre
 * bajo PM2 en modo fork (un solo proceso Node); si algún día se pasa a cluster
 * o a varias máquinas, esto hay que mover a Redis/SQLite compartido.
 */

type Hits = number[];

// Cachear en globalThis (mismo patrón que src/lib/db.ts) para que el
// hot-reload de dev no reinicie los contadores en cada recompilación.
const globalForRateLimit = globalThis as unknown as {
  escribahoyRateLimit?: Map<string, Hits>;
};

const buckets: Map<string, Hits> =
  globalForRateLimit.escribahoyRateLimit ?? new Map<string, Hits>();

if (!globalForRateLimit.escribahoyRateLimit) {
  globalForRateLimit.escribahoyRateLimit = buckets;
}

// Cuando el Map pasa de este tamaño, barremos todas las claves para tirar las
// que ya no tienen timestamps vigentes (evita fuga con claves de un solo uso,
// p. ej. un correo distinto por intento).
const SWEEP_THRESHOLD = 5_000;

// Ninguna ventana de esta app es más larga que esto; sirve como techo para
// decidir qué timestamps son basura durante el barrido global.
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

function sweep(now: number): void {
  for (const [key, hits] of buckets) {
    let alive = false;
    for (const t of hits) {
      if (now - t < MAX_WINDOW_MS) {
        alive = true;
        break;
      }
    }
    if (!alive) buckets.delete(key);
  }
}

/**
 * Registra un intento para `key` y dice si cabe dentro del límite.
 *
 * @param key    identificador del sujeto limitado, ya namespaced por el
 *               llamador (p. ej. `login:correo@dominio.com`, `forgot:1.2.3.4`).
 * @param opts   `max` intentos permitidos dentro de `windowMs`.
 * @returns      `{ok:true, retryAfterSec:0}` si se permite; si no,
 *               `{ok:false, retryAfterSec}` con los segundos que faltan para
 *               que expire el intento más viejo de la ventana.
 *
 * Nota: solo cuenta el intento cuando se permite. Así un cliente bloqueado no
 * extiende su propio castigo a base de reintentar.
 */
export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const max = Math.max(1, Math.floor(opts.max));
  const windowMs = Math.max(1, Math.floor(opts.windowMs));

  const previous = buckets.get(key);
  // Purga los timestamps que ya salieron de la ventana antes de contar.
  const hits: Hits = previous ? previous.filter((t) => now - t < windowMs) : [];

  if (hits.length >= max) {
    const oldest = hits[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    // Guardamos la versión purgada para no arrastrar timestamps muertos.
    buckets.set(key, hits);
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  return { ok: true, retryAfterSec: 0 };
}
