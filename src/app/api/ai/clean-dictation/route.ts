import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getAnthropic,
  MODELO_POR_TAREA,
  bloquesSistemaConCache,
} from "@/lib/anthropic";
import { modeloId, registrarUso, usoDeRespuesta } from "@/lib/ai-usage";
import { consumirCuota } from "@/lib/quotas";
import { wordCount } from "@/lib/utils";

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

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // El dictado se mide en PALABRAS, no en llamadas: el plan promete "2,000
  // palabras de dictado" / "≈3 horas al mes", y una sola grabación pueden ser
  // cientos. Se cobran las palabras del texto que ENTRA (lo que el usuario
  // dictó), no las que devuelve la IA: la limpieza quita muletillas y bajaría
  // el consumo justo cuando el dictado fue más largo y más caro de procesar.
  // Si no alcanza, `mensajeLimite` ya distingue "te quedan N y esto necesita M".
  const palabras = wordCount(text);
  const cuota = await consumirCuota(user.id, "dictado", palabras);
  if (!cuota.ok) {
    // 402 Payment Required: el usuario está autorizado, lo que se acabó es su
    // cuota. 403 diría "no eres tú", y no es eso.
    return NextResponse.json(
      {
        error: cuota.mensaje,
        limite: cuota.limite,
        usado: cuota.usado,
        upgrade: true,
      },
      { status: 402 }
    );
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

  // ── PREFIJO ESTABLE (con breakpoint de caché) ───────────────────────────
  // El reglamento de limpieza es IDÉNTICO en cada dictado, así que es el
  // prefijo natural. Lo único que cambia por request es la variante de español
  // y eso va después del breakpoint.
  // ⚠️ Este reglamento ronda los ~600 tokens, muy por debajo del mínimo
  // cacheable de claude-haiku-4-5 (4096), así que hoy la marca NO cachea nada
  // (ni cobra premium: la API simplemente la ignora). Se deja puesta porque es
  // gratis y queda correcta si el prompt crece o la tarea sube de modelo.
  const systemEstable = `Eres un editor de transcripciones por voz. Tu tarea es ÚNICAMENTE limpiar el texto que el usuario dictó:

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
`;

  // ── VOLÁTIL (después del breakpoint, sin marca) ─────────────────────────
  // Empieza con salto de línea para que `estable + volatil` reproduzca byte por
  // byte el prompt que ya se mandaba.
  const systemVolatil = `
Variante: ${langLabel}

DEVUELVE ÚNICAMENTE el texto limpio, sin preámbulos ni comentarios. Nada antes ni después del texto.`;

  const modeloTarea = MODELO_POR_TAREA.dictado;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: modeloId(modeloTarea),
      max_tokens: 4096,
      system: bloquesSistemaConCache({
        estable: systemEstable,
        volatil: systemVolatil,
      }),
      messages: [
        {
          role: "user",
          content: `Limpia este dictado:\n\n${text}`,
        },
      ],
    });

    const uso = usoDeRespuesta(response.usage);
    await registrarUso({
      userId: user.id,
      accion: "dictado",
      modelo: modeloTarea,
      inputTokens: uso.input,
      outputTokens: uso.output,
      cacheReadTokens: uso.cacheRead,
      cacheWriteTokens: uso.cacheWrite,
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
