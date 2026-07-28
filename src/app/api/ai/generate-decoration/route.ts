import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, outlineNodes, knowledgeFiles } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getAnthropic,
  SYSTEM_BASE,
  MODELO_POR_TAREA,
  bloquesSistemaConCache,
} from "@/lib/anthropic";
import { modeloId, registrarUso, usoDeRespuesta } from "@/lib/ai-usage";
import { consumirCuota } from "@/lib/quotas";
import { DECORATION_KINDS, type DecorationKind } from "@/lib/decorations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_INSTRUCTIONS: Record<DecorationKind, string> = {
  pullquote:
    "Escoge la frase MÁS impactante y memorable del contenido para destacarla. Debe ser una sola oración, breve (máx 25 palabras), que el lector quiera tatuarse. Si hay autor citado, ponlo en attribution.",
  epigraph:
    "Genera un epígrafe: una cita corta de un autor famoso (Wilde, Rumi, Aristóteles, Borges, Einstein, Hemingway, etc.) que conecte temáticamente con el contenido del capítulo. Usa SOLO citas reales y bien atribuidas. Devuelve cita en text y autor en attribution. Máximo 30 palabras.",
  callout:
    "Resume en una caja amarilla un TIP o advertencia clave que aparece en el contenido. Si no aparece explícito, propón uno coherente con el tema. text: 1-2 frases. title: corto (ej 'Tip', 'Cuidado', 'Importante').",
  definition:
    "Identifica el término técnico más importante del contenido y crea su definición clara. title: el término. text: la definición en 1-3 frases, sin jerga.",
  exercise:
    "Crea un ejercicio práctico para el lector basado en el contenido. Algo accionable que pueda hacer en 5-15 minutos. title: nombre breve del ejercicio (ej 'Tu turno', 'Prueba esto'). text: instrucciones claras y específicas.",
  recap:
    "Resume los puntos clave del contenido del capítulo en formato lista o párrafo corto. title: 'Recap del capítulo' o similar. text: 3-5 puntos clave, máximo 100 palabras.",
  stat:
    "Encuentra un dato impactante mencionado en el contenido o, si no hay, propón uno verificable y relevante al tema. text: el dato corto (ej '70% de los emprendedores fracasan en su primer año'). attribution: la fuente (ej 'Harvard Business Review, 2023', 'CB Insights').",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    projectId: string;
    nodeId: string;
    kind: string;
    instruction?: string;
  };
  if (!(DECORATION_KINDS as readonly string[]).includes(body.kind)) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }
  const kind = body.kind as DecorationKind;

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!projectRows.length)
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  const project = projectRows[0];

  const nodeRows = await db
    .select()
    .from(outlineNodes)
    .where(
      and(
        eq(outlineNodes.id, body.nodeId),
        eq(outlineNodes.projectId, project.id)
      )
    )
    .limit(1);
  if (!nodeRows.length)
    return NextResponse.json({ error: "node not found" }, { status: 404 });
  const node = nodeRows[0];

  // Source 1: existing content of the section.
  const plainText = (node.content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasExistingContent = plainText.length > 100;

  // Source 2: KB.
  const kbRows = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.projectId, project.id));
  const kbContext = kbRows.length
    ? kbRows
        .map(
          (k) =>
            `[KB:${k.name}]\n${k.summary ?? k.extractedText.slice(0, 1500)}`
        )
        .join("\n\n")
        .slice(0, 12000)
    : "";

  // Source priority instruction.
  let sourcePriority = "";
  if (hasExistingContent) {
    sourcePriority = `PRIMERO: extrae el accesorio del contenido YA ESCRITO de la sección (es lo más fiel a la voz del autor).`;
  } else if (kbContext) {
    sourcePriority = `La sección no tiene contenido escrito todavía. PRIMERO: usa el knowledge base (PDFs/notas del autor) como fuente principal.`;
  } else {
    sourcePriority = `No hay contenido ni KB. Genera con tu conocimiento general, alineado al tema y tono del proyecto.`;
  }

  // ── PREFIJO ESTABLE (con breakpoint de caché) ───────────────────────────
  // Prompt de sistema + ficha del proyecto: idénticos en todas las decoraciones
  // del mismo proyecto. Lo que cambia por request (sección, contenido escrito,
  // KB, tipo de accesorio) va después del breakpoint.
  // ⚠️ Con este orden el prefijo estable ronda los ~500 tokens, por debajo del
  // mínimo cacheable de claude-haiku-4-5 (4096): hoy la marca no cachea (ni
  // cobra premium). NO se reordenó el prompt para meter el KB en el prefijo
  // porque eso sí cambiaría el prompt que ve el modelo, y la calidad no se toca
  // en este pase. Ver el reporte: mover el KB arriba es la palanca pendiente.
  const systemEstable = `${SYSTEM_BASE}

Proyecto:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.glossary ? `- Glosario: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}
`;

  // ── VOLÁTIL (después del breakpoint, sin marca) ─────────────────────────
  // Arranca con salto de línea para que `estable + volatil` reproduzca byte por
  // byte el prompt que ya se mandaba.
  const systemVolatil = `
Sección actual: "${node.title}"
${node.summary ? `Resumen previsto: ${node.summary}` : ""}

${
  hasExistingContent
    ? `Contenido escrito por el autor (${plainText.length} caracteres):\n${plainText.slice(0, 6000)}`
    : "(la sección está vacía)"
}

${kbContext ? `Knowledge base del proyecto:\n${kbContext}\n` : ""}

INSTRUCCIONES PARA GENERAR EL ACCESORIO:
Tipo de accesorio a generar: ${kind}
${KIND_INSTRUCTIONS[kind]}

ORDEN DE PRIORIDAD DE FUENTE:
${sourcePriority}

DEVUELVE ÚNICAMENTE un JSON válido con este formato exacto (sin markdown, sin texto antes ni después):
{
  "text": "...",
  "attribution": "...",
  "title": "..."
}

- "text" es obligatorio.
- "attribution" solo si aplica al tipo (pullquote, epigraph, stat). Si no aplica, omite la propiedad.
- "title" solo para callout, definition, exercise, recap. Si no aplica, omite la propiedad.
- Respeta el tono, la persona narrativa y los términos a evitar.`;

  const userMessage = body.instruction
    ? `Genera el accesorio. Instrucción adicional del usuario: ${body.instruction}`
    : `Genera el accesorio.`;

  const modeloTarea = MODELO_POR_TAREA.decoracion;

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // Después de validar el tipo de accesorio, la propiedad del proyecto y la
  // existencia del nodo (ninguna de esas llama a la IA), y justo antes de
  // gastar tokens. OJO: cada "generar otra versión" del editor es una llamada
  // nueva y cuenta como una decoración, que es exactamente lo que promete el
  // plan ("portadas y decoraciones" al mes).
  const cuota = await consumirCuota(user.id, "decoracion");
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

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: modeloId(modeloTarea),
      max_tokens: 1024,
      system: bloquesSistemaConCache({
        estable: systemEstable,
        volatil: systemVolatil,
      }),
      messages: [{ role: "user", content: userMessage }],
    });

    const uso = usoDeRespuesta(response.usage);
    await registrarUso({
      userId: user.id,
      projectId: project.id,
      accion: "decoracion",
      modelo: modeloTarea,
      inputTokens: uso.input,
      outputTokens: uso.output,
      cacheReadTokens: uso.cacheRead,
      cacheWriteTokens: uso.cacheWrite,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "respuesta vacía de la IA" },
        { status: 502 }
      );
    }
    let raw = textBlock.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
    let parsed: { text?: string; attribution?: string; title?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "la IA devolvió un formato inesperado" },
        { status: 502 }
      );
    }
    if (!parsed.text || typeof parsed.text !== "string") {
      return NextResponse.json(
        { error: "respuesta sin texto" },
        { status: 502 }
      );
    }
    return NextResponse.json({
      text: parsed.text.trim(),
      attribution: parsed.attribution?.trim() || undefined,
      title: parsed.title?.trim() || undefined,
      source: hasExistingContent
        ? "existing-content"
        : kbContext
          ? "knowledge-base"
          : "general",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "error generando accesorio",
      },
      { status: 500 }
    );
  }
}
