import Anthropic from "@anthropic-ai/sdk";
import type { AccionIA } from "./plans";
import { modeloId, type ModeloIA } from "./ai-usage";

/**
 * Modelo por defecto. Se mantiene exportado porque varias rutas lo importan;
 * las rutas nuevas deben usar `modeloId(MODELO_POR_TAREA[accion])`.
 *
 * Se DERIVA de `modeloId("opus")` en vez de repetir el string a mano: así el
 * id del modelo vive en un solo lugar (`IDS_MODELO` en ai-usage.ts) y una
 * subida de versión no puede dejar aquí un id viejo. Las rutas que lo importan
 * registran su costo como "opus", que es justo lo que esto vale.
 */
export const MODEL = modeloId("opus");
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
 * El temario y la redistribución se quedan en OPUS: definen la estructura de
 * toda la obra, corren una o dos veces por proyecto y cuestan centavos, así que
 * es el lugar más barato donde comprar calidad.
 *
 * El chat, las sugerencias y el guion pasaron a SONNET por MEDICIÓN, no por
 * corazonada: 6 corridas por modelo con la tarea real (insertar una historia
 * dictada en la sección correcta) dieron 6/6 en ambos — llamó la herramienta,
 * eligió el nodo correcto y conservó los datos concretos del autor — a la mitad
 * del costo y 25% más rápido. Pagar el doble sin diferencia medible no es
 * comprar calidad, es regalar margen.
 *
 * ⚠️ ESTA TABLA SOLO SIRVE SI LAS RUTAS LA LEEN. Toda llamada debe usar
 * `modeloId(MODELO_POR_TAREA[accion])`, nunca la constante MODEL.
 */
export const MODELO_POR_TAREA: Record<AccionIA | "kb", ModeloIA> = {
  // Definen la ESTRUCTURA de toda la obra y se ejecutan una o dos veces por
  // proyecto: aquí se compra calidad porque es barato hacerlo.
  temario: "opus",
  redistribuir: "opus",
  // Volumen. Medido con la tarea real de la app (6 corridas por modelo,
  // insertar una historia dictada en la sección correcta): Sonnet 5 acertó
  // 6/6 igual que Opus — llamó la herramienta, eligió el nodo correcto y
  // conservó los datos concretos del autor — a la MITAD del costo y 25% más
  // rápido. No hubo diferencia de calidad que justifique pagar el doble.
  sugerencia: "sonnet",
  chat: "sonnet",
  guion: "sonnet",
  // Tareas mecánicas: hay una respuesta correcta determinada por la entrada.
  dictado: "haiku",
  decoracion: "haiku",
  kb: "haiku",
};

/**
 * Configuración de razonamiento por llamada.
 *
 * ⚠️ OBLIGATORIO EN LOS MODELOS 5: Opus 5 y Sonnet 5 PIENSAN POR DEFECTO, y el
 * `max_tokens` es un tope COMPARTIDO entre el razonamiento y el texto de la
 * respuesta. Una ruta con `max_tokens` ajustado que antes cabía en Opus 4.7
 * (que no pensaba salvo que se lo pidieran) puede quedar truncada a media
 * respuesta. Por eso toda llamada declara su modo de forma explícita en vez de
 * confiar en el default.
 *
 * Se usa `adaptive` y NO `disabled` en las rutas con herramientas: con el
 * razonamiento apagado, estos modelos ocasionalmente escriben la llamada a la
 * herramienta como TEXTO PLANO — el turno termina bien, la herramienta nunca
 * corre y el usuario cree que se guardó algo que no se guardó. Es exactamente
 * la falla que este producto ya sufrió. Cuesta ~10% más y lo vale.
 */
export const RAZONAMIENTO = {
  type: "adaptive" as const,
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
 * ⚠️ El mínimo cacheable depende del modelo: 512 tokens en claude-opus-5,
 * 1024 en claude-sonnet-5 y 4096 en claude-haiku-4-5 (NO es monótono entre
 * generaciones). Por debajo de eso NO cachea y la API no avisa:
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
