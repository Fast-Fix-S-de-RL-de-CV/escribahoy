import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects, outlineNodes, knowledgeFiles } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAnthropic, MODEL, SYSTEM_BASE } from "@/lib/anthropic";
import { getMissingCoreSettings } from "@/lib/project-validation";
import { getFormat } from "@/lib/book-formats";
import { logChange } from "@/lib/change-log";
import { consumirCuota } from "@/lib/quotas";
import { registrarUso, usoDeRespuesta, type ModeloIA } from "@/lib/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Modelo con el que se registra el costo. Esta ruta manda `MODEL`, que hoy es
 * exactamente `modeloId("opus")` (claude-opus-4-7). Explícito a propósito: si
 * la ruta cambia de modelo, esta línea cambia con ella o la métrica mentiría.
 */
const MODELO_USADO: ModeloIA = "opus";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { nodeId: string };

  const nodeRows = await db
    .select()
    .from(outlineNodes)
    .innerJoin(projects, eq(outlineNodes.projectId, projects.id))
    .where(
      and(
        eq(outlineNodes.id, body.nodeId),
        eq(projects.userId, user.id)
      )
    )
    .limit(1);
  if (!nodeRows.length)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const node = nodeRows[0].outline_nodes;
  const project = nodeRows[0].projects;

  if (node.kind !== "chapter" && node.kind !== "module") {
    return NextResponse.json(
      { error: "Solo aplica a capítulos o módulos" },
      { status: 400 }
    );
  }

  const missing = getMissingCoreSettings(project);
  if (missing.length) {
    return NextResponse.json(
      { error: `Completa primero: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const plainText = (node.content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plainText.length < 200) {
    return NextResponse.json(
      { error: "el capítulo no tiene contenido suficiente para redistribuir" },
      { status: 400 }
    );
  }

  const existingChildren = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.parentId, node.id));
  existingChildren.sort((a, b) => a.position - b.position);

  const childKind = node.kind === "chapter" ? "section" : "lesson";
  const fmt = getFormat(project.format);
  const wordsPerLeaf =
    project.type === "book"
      ? Math.round((fmt?.wordsPerPage ?? 350) * 6)
      : 400;

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
        .slice(0, 8000)
    : "";

  const childrenSnapshot = existingChildren
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} | "${c.title}"${c.summary ? ` — ${c.summary}` : ""} (${c.wordCount} palabras escritas)`
    )
    .join("\n");

  const system = `${SYSTEM_BASE}

Proyecto:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.glossary ? `- Glosario: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}

Capítulo: "${node.title}"
${node.summary ? `Resumen: ${node.summary}` : ""}

${
  existingChildren.length > 0
    ? `Secciones actuales del capítulo:\n${childrenSnapshot}`
    : "El capítulo NO tiene secciones."
}

${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}

CONTENIDO ACTUAL DEL CUERPO DEL CAPÍTULO (todo este texto está mal puesto en el capítulo y debe distribuirse en sus secciones):

${node.content}

TAREA:
Redistribuir el contenido anterior siguiendo estas REGLAS:

1. NO inventes contenido nuevo. Reorganiza el que ya está, conservando la voz y los detalles del autor.
2. El cuerpo del capítulo después de redistribuir debe tener SOLO una intro corta (1-2 párrafos máximo) que enmarque el capítulo.
3. El resto del contenido se distribuye en SECCIONES.
4. Si las secciones existentes tienen títulos que mapean naturalmente a partes del contenido → reusa esas secciones (action: "update_existing", reusa su id).
5. Si el contenido tiene partes que no encajan con ninguna sección existente, crea nuevas secciones (action: "create").
6. Si una sección existente no tiene contenido que corresponderle del cuerpo actual del capítulo, NO la incluyas en la respuesta (queda como está).
7. Cada sección debe tener ~${wordsPerLeaf} palabras.

DEVUELVE ÚNICAMENTE un JSON válido (sin markdown, sin texto antes/después):
{
  "chapterIntro": "<HTML corto de 1-2 párrafos para APERTURA del capítulo>",
  "chapterClosing": "<HTML corto de 1-2 párrafos para CIERRE del capítulo. Solo si en el contenido original hay material que sirva como síntesis o cierre. Si no, devuelve cadena vacía>",
  "sections": [
    {
      "action": "update_existing",
      "id": "<id existente>",
      "title": "<título nuevo opcional>",
      "summary": "<resumen breve>",
      "content": "<HTML del contenido reorganizado>"
    },
    {
      "action": "create",
      "title": "<título de nueva sección>",
      "summary": "<resumen breve>",
      "content": "<HTML completo>"
    }
  ]
}

REGLAS DE HTML:
- Solo <p>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <code>.
- NO uses fences markdown.
- NO repitas el título dentro del content.`;

  const userMessage = `Redistribuye el contenido actual del capítulo "${node.title}" en sus secciones, dejando solo una intro corta en el cuerpo del capítulo.`;

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // Al final de las validaciones y antes de la IA: un capítulo sin contenido
  // suficiente sale más arriba sin gastar tokens, así que tampoco debe gastar
  // cuota. Redistribuir es la acción más cara del sistema (manda el capítulo
  // completo y pide hasta 16k tokens de salida), de ahí que tenga su propio
  // límite en plans.ts y no comparta el de sugerencias.
  const cuota = await consumirCuota(user.id, "redistribuir");
  if (!cuota.ok) {
    // 402 Payment Required: se acabó la cuota del plan, no el permiso.
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
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    // Los tokens ya se gastaron aunque la respuesta venga vacía o mal formada:
    // la huella de costo se escribe antes de validar nada. Nunca lanza.
    const uso = usoDeRespuesta(response.usage);
    await registrarUso({
      userId: user.id,
      projectId: project.id,
      accion: "redistribuir",
      modelo: MODELO_USADO,
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
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);

    let parsed: {
      chapterIntro?: string;
      chapterClosing?: string;
      sections?: Array<{
        action: "create" | "update_existing";
        id?: string;
        title?: string;
        summary?: string;
        content: string;
      }>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "la IA devolvió un formato inesperado" },
        { status: 502 }
      );
    }

    let updatedCount = 0;
    let createdCount = 0;

    const introHtml = (parsed.chapterIntro ?? "").trim();
    const closingHtml = (parsed.chapterClosing ?? "").trim();
    const introWc = introHtml
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const closingWc = closingHtml
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    await db
      .update(outlineNodes)
      .set({
        content: introHtml,
        closingContent: closingHtml,
        wordCount: introWc,
        status: introWc > 0 ? "draft" : "empty",
        updatedAt: new Date(),
      })
      .where(eq(outlineNodes.id, node.id));

    const maxPos = existingChildren.length
      ? Math.max(...existingChildren.map((c) => c.position))
      : -1;
    let nextPos = maxPos + 1;

    for (const s of parsed.sections ?? []) {
      const html = (s.content ?? "").trim();
      const wc = html
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      if (s.action === "update_existing" && s.id) {
        const exists = existingChildren.find((c) => c.id === s.id);
        if (!exists) continue;
        await db
          .update(outlineNodes)
          .set({
            title: s.title?.trim() || exists.title,
            summary: s.summary?.trim() || exists.summary,
            content: html,
            wordCount: wc,
            status: wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty",
            updatedAt: new Date(),
          })
          .where(eq(outlineNodes.id, s.id));
        updatedCount++;
      } else if (s.action === "create" && s.title?.trim()) {
        const id = nanoid();
        const now = new Date();
        await db.insert(outlineNodes).values({
          id,
          projectId: project.id,
          parentId: node.id,
          kind: childKind,
          title: s.title.trim(),
          summary: s.summary?.trim() ?? null,
          position: nextPos++,
          targetWords: wordsPerLeaf,
          content: html,
          wordCount: wc,
          status: wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty",
          createdAt: now,
          updatedAt: now,
        });
        createdCount++;
      }
    }

    const summary = [
      introWc > 0 ? `apertura (${introWc} palabras)` : null,
      updatedCount
        ? `${updatedCount} ${updatedCount === 1 ? "sección actualizada" : "secciones actualizadas"}`
        : null,
      createdCount
        ? `${createdCount} ${createdCount === 1 ? "nueva sección creada" : "nuevas secciones creadas"}`
        : null,
      closingWc > 0 ? `cierre (${closingWc} palabras)` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    await logChange({
      projectId: project.id,
      actor: "ai",
      kind: "apply_suggestion",
      nodeId: node.id,
      description: `Redistribuyó "${node.title}": ${summary}`,
    });

    return NextResponse.json({
      ok: true,
      summary: summary || "Sin cambios",
      updatedCount,
      createdCount,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "error redistribuyendo",
      },
      { status: 500 }
    );
  }
}
