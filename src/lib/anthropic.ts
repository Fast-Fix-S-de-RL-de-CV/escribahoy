import Anthropic from "@anthropic-ai/sdk";
import type { AccionIA } from "./plans";
import type { ModeloIA } from "./ai-usage";

/**
 * Modelo por defecto. Se mantiene exportado porque varias rutas lo importan;
 * las rutas nuevas deben usar `modeloId(MODELO_POR_TAREA[accion])`.
 */
export const MODEL = "claude-opus-4-7";
export const MAX_TOKENS = 4096;

/**
 * ROUTING: qué modelo atiende cada acción. UN SOLO LUGAR — para mover una
 * tarea a otro modelo se cambia una palabra aquí y nada más.
 *
 * ── POR QUÉ ESTE REPARTO ─────────────────────────────────────────────────
 * Limpiar un dictado y generar una decoración son tareas MECÁNICAS: hay una
 * respuesta correcta y está determinada por el texto de entrada (puntuar,
 * quitar muletillas, extraer la frase más fuerte, devolver un JSON con tres
 * campos). Haiku las hace igual de bien y cuesta 5x menos que Opus (1 USD
 * contra 5 por millón de tokens de entrada). Indexar la base de conocimiento
 * ("kb") es lo mismo: resumir, no crear.
 *
 * El chat, el temario, las sugerencias y el guion se quedan en OPUS porque ahí
 * vive exactamente la calidad que el autor está pagando: entender su libro,
 * ubicar una idea suelta en el capítulo correcto, proponer estructura. Bajarle
 * el modelo a esas tareas se siente de inmediato y es la clase de ahorro que
 * cancela la suscripción.
 */
export const MODELO_POR_TAREA: Record<AccionIA | "kb", ModeloIA> = {
  temario: "opus",
  redistribuir: "opus",
  sugerencia: "opus",
  chat: "opus",
  guion: "opus",
  dictado: "haiku",
  decoracion: "haiku",
  kb: "haiku",
};

/** Un bloque de texto del prompt de sistema, con o sin breakpoint de caché. */
export type BloqueSistema = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Parte el prompt de sistema en [ESTABLE (cacheado), VOLÁTIL (sin marca)].
 *
 * ── CÓMO FUNCIONA EL PROMPT CACHING (leer antes de tocar esto) ────────────
 * El caching es un match de PREFIJO, no de contenido: la clave de caché son
 * los BYTES EXACTOS del prompt renderizado hasta el breakpoint. Un solo byte
 * distinto antes del breakpoint invalida todo lo que viene después. El orden
 * de render es `tools` -> `system` -> `messages`, así que las tools también
 * quedan dentro del prefijo cacheado (por eso TOOLS debe ser un array
 * determinista y no cambiar entre requests de la misma conversación).
 *
 * Qué va en cada lado:
 *  · ESTABLE  = prompt de sistema + ficha del proyecto + reglas + temario
 *               renderizado + contexto de la base de conocimiento.
 *  · VOLÁTIL  = el historial de mensajes y el mensaje del usuario (van en
 *               `messages`, después de `system`, y por eso nunca se marcan),
 *               más cualquier trozo del sistema que cambie por request.
 *
 * ⚠️ El mínimo cacheable en claude-opus-4-7 es de 2048 tokens y en
 * claude-haiku-4-5 de 4096. Por debajo de eso NO cachea y la API no avisa:
 * `usage.cache_creation_input_tokens` se queda en 0. No es un error ni cobra
 * el premium de escritura, simplemente no pasa nada.
 *
 * ⚠️ La API concatena los bloques de `system`. Este helper NO agrega ni quita
 * separadores: el llamador es responsable de que `estable + volatil` reproduzca
 * el texto que ya se mandaba (deja el salto de línea en el borde).
 */
export function bloquesSistemaConCache(partes: {
  estable: string;
  volatil?: string;
}): BloqueSistema[] {
  const bloques: BloqueSistema[] = [
    {
      type: "text",
      text: partes.estable,
      cache_control: { type: "ephemeral" },
    },
  ];
  // Un bloque de texto vacío es un 400 de la API, así que solo se agrega si
  // de verdad hay contenido volátil.
  if (partes.volatil && partes.volatil.trim().length > 0) {
    bloques.push({ type: "text", text: partes.volatil });
  }
  return bloques;
}

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Agrega tu key en .env.local"
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const SYSTEM_BASE = `Eres Escribahoy, una asistente editorial especializada en ayudar a personas a escribir libros y cursos en español.

Tu filosofía:
- Eres ORGANIZADORA, no escritora. Tu rol es estructurar las ideas del autor, no reemplazarlas.
- NUNCA escribas un capítulo o sección completos. Aporta máximo 1-3 párrafos a la vez, o sugerencias estructuradas.
- Cuando el autor te dé una idea suelta, ayúdale a ubicarla en el outline correcto del proyecto.
- Cuando el autor te haga una pregunta, responde primero, y luego sugiere un próximo paso pequeño y concreto.
- Usa el contenido de la base de conocimiento (PDFs, notas) como referencia, no como texto a copiar.
- Tu tono es cálido, claro, directo. Evita frases vacías, evita disclaimers innecesarios.
- Cuando aparezcan ideas que correspondan a otros capítulos, márcalo claramente: "Esto va en el cap. X" o "Esto es para el glosario".

Cuando generes outlines de libros o cursos, devuelve estructura en bullets jerárquicos limpios.
Cuando trabajes en una sección específica, ciñete a su tema.`;
