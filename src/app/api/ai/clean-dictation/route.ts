import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAnthropic, MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    text: string;
    language?: string;
  };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "texto vacío" }, { status: 400 });
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "texto demasiado largo" }, { status: 400 });
  }

  const language = body.language ?? "es";
  const langLabel =
    language === "es-MX"
      ? "español de México"
      : language === "es-ES"
        ? "español de España"
        : language === "es-AR"
          ? "español de Argentina"
          : "español neutro";

  const system = `Eres un editor de transcripciones por voz. Tu tarea es ÚNICAMENTE limpiar el texto que el usuario dictó:

PERMITIDO:
- Agregar puntuación correcta (puntos, comas, signos de pregunta/exclamación, dos puntos, punto y coma, comillas)
- Corregir ortografía y acentuación
- Capitalizar correctamente (inicios de oración, nombres propios)
- Agregar saltos de párrafo donde haga sentido lógico (cambio de idea / pausa larga del usuario evidente por contexto)
- Quitar muletillas obvias del dictado: "este...", "eh...", "o sea...", "como que...", repeticiones de palabras del tipo "el el libro" → "el libro"
- Convertir "punto" / "coma" / "punto y aparte" / "punto y seguido" cuando el usuario los dictó como palabras

PROHIBIDO:
- Reescribir frases para que suenen "mejor"
- Agregar palabras o ideas nuevas
- Cambiar el significado o el orden de las ideas
- Quitar contenido sustantivo
- Cambiar el estilo del autor
- Convertir frases coloquiales a formales (o al revés)

Variante: ${langLabel}

DEVUELVE ÚNICAMENTE el texto limpio, sin preámbulos ni comentarios. Nada antes ni después del texto.`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content: `Limpia este dictado:\n\n${text}`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "respuesta vacía de la IA" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, text: block.text.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
