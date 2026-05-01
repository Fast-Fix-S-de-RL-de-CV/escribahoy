import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-7";
export const MAX_TOKENS = 4096;

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
