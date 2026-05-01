import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  suggestions,
} from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAnthropic, MODEL, SYSTEM_BASE } from "@/lib/anthropic";
import { getMissingCoreSettings } from "@/lib/project-validation";
import { getFormat } from "@/lib/book-formats";
import { logChange } from "@/lib/change-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { suggestionId: string };

  const sRows = await db
    .select()
    .from(suggestions)
    .innerJoin(projects, eq(suggestions.projectId, projects.id))
    .where(
      and(
        eq(suggestions.id, body.suggestionId),
        eq(projects.userId, user.id)
      )
    )
    .limit(1);
  if (!sRows.length)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const suggestion = sRows[0].suggestions;
  const project = sRows[0].projects;

  const missing = getMissingCoreSettings(project);
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Antes de ejecutar sugerencias, completa la configuración: ${missing.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const nodeRows = await db
    .select()
    .from(outlineNodes)
    .where(
      and(
        eq(outlineNodes.id, suggestion.nodeId),
        eq(outlineNodes.projectId, project.id)
      )
    )
    .limit(1);
  if (!nodeRows.length)
    return NextResponse.json({ error: "node not found" }, { status: 404 });
  const node = nodeRows[0];

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

  const fmt = getFormat(project.format);
  const isContainer = node.kind === "chapter" || node.kind === "module";

  // Project preamble used by both branches.
  const projectPreamble = `Proyecto:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- Glosario: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}
${fmt ? `- Formato: ${fmt.label} (${fmt.widthCm}×${fmt.heightCm}cm)` : ""}`;

  if (isContainer) {
    return await handleContainer(
      project,
      node,
      suggestion,
      projectPreamble,
      kbContext
    );
  } else {
    return await handleLeaf(
      project,
      node,
      suggestion,
      projectPreamble,
      kbContext
    );
  }
}

async function handleLeaf(
  project: typeof projects.$inferSelect,
  node: typeof outlineNodes.$inferSelect,
  suggestion: typeof suggestions.$inferSelect,
  projectPreamble: string,
  kbContext: string
) {
  const targetWords = node.targetWords || (project.type === "book" ? 800 : 400);
  const system = `${SYSTEM_BASE}

${projectPreamble}

Nodo a desarrollar: "${node.title}" (${node.kind})
${node.summary ? `Resumen previsto: ${node.summary}` : ""}
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}

EXCEPCIÓN A LA REGLA NORMAL:
El usuario te pidió EXPLÍCITAMENTE desarrollar el contenido completo a partir de la sugerencia que dejaste. Por lo tanto SÍ desarrolla el contenido completo (~${targetWords} palabras).
- Mantén el tono, persona narrativa y términos del proyecto.
- Devuelve HTML simple: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>.
- NO uses fences markdown ni \`\`\`. Devuelve SOLO el HTML.`;

  const userMessage = `Desarrolla el contenido completo de "${node.title}" siguiendo esta sugerencia:

${suggestion.content}`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "respuesta vacía de la IA" },
        { status: 502 }
      );
    }
    let html = textBlock.text.trim();
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```$/i, "").trim();
    const wc = html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;

    await db
      .update(outlineNodes)
      .set({
        content: html,
        wordCount: wc,
        status: wc > 50 ? "in_progress" : "draft",
        updatedAt: new Date(),
      })
      .where(eq(outlineNodes.id, node.id));

    await db
      .update(suggestions)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(suggestions.id, suggestion.id));

    await logChange({
      projectId: project.id,
      actor: "ai",
      kind: "apply_suggestion",
      nodeId: node.id,
      description: `Aplicó sugerencia en "${node.title}" (${wc} palabras)`,
    });

    return NextResponse.json({
      ok: true,
      mode: "section",
      summary: `Se desarrolló el contenido de "${node.title}" (~${wc} palabras).`,
      nodeId: node.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "error desarrollando",
      },
      { status: 500 }
    );
  }
}

async function handleContainer(
  project: typeof projects.$inferSelect,
  node: typeof outlineNodes.$inferSelect,
  suggestion: typeof suggestions.$inferSelect,
  projectPreamble: string,
  kbContext: string
) {
  // Lee secciones existentes del capítulo.
  const existingChildren = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.parentId, node.id));
  existingChildren.sort((a, b) => a.position - b.position);

  const childKind = node.kind === "chapter" ? "section" : "lesson";
  const fmt = getFormat(project.format);
  const wordsPerLeaf =
    project.type === "book"
      ? Math.round((fmt?.wordsPerPage ?? 350) * 6) // ~6 páginas por sección
      : 400;

  const childrenSnapshot = existingChildren
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} | "${c.title}"${c.summary ? ` — ${c.summary}` : ""} (${c.wordCount} palabras escritas)`
    )
    .join("\n");

  const system = `${SYSTEM_BASE}

${projectPreamble}

Capítulo a desarrollar: "${node.title}"
${node.summary ? `Resumen del capítulo: ${node.summary}` : ""}

${
  existingChildren.length > 0
    ? `Secciones existentes del capítulo:\n${childrenSnapshot}`
    : "El capítulo aún NO tiene secciones."
}

${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}

REGLA CRÍTICA:
Un capítulo NO debe llevar el contenido completo en su propio cuerpo. El contenido se distribuye en sus SECCIONES (sub-niveles). El capítulo solo lleva una intro corta de 1-2 párrafos máximo.

TAREA:
Convierte la sugerencia del usuario en una distribución de contenido entre intro del capítulo + secciones.

REGLAS DE DISTRIBUCIÓN:
- Si la sugerencia tiene N "movimientos", "puntos", "partes" o ideas distintas, mapea cada una a una sección.
- Si ya existen secciones que cubren bien las partes de la sugerencia → desarrolla el contenido en esas secciones existentes (action: "update_existing", reusa su id).
- Si las secciones existentes NO cubren las partes de la sugerencia → crea nuevas secciones (action: "create").
- Si las secciones existentes están vacías y sus títulos no encajan, puedes mantenerlas vacías (no las incluyes en la respuesta) y crear las que sí encajen.
- Cada sección desarrollada debe tener ~${wordsPerLeaf} palabras.
- La intro del capítulo NO repite contenido de las secciones — solo enmarca el capítulo (qué viene, por qué importa).

DEVUELVE ÚNICAMENTE un JSON válido (sin markdown, sin texto antes/después):
{
  "chapterIntro": "<HTML corto de 1-2 párrafos para APERTURA del capítulo (gancho/historia/dato que enmarca el tema)>",
  "chapterClosing": "<HTML corto de 1-2 párrafos opcionales para CIERRE del capítulo (síntesis y transición al próximo). Solo si lo amerita la sugerencia, si no devuelve cadena vacía>",
  "sections": [
    {
      "action": "update_existing",
      "id": "<id de la sección existente>",
      "title": "<título nuevo opcional, si conviene cambiarlo>",
      "summary": "<resumen breve de 1 frase>",
      "content": "<HTML completo del contenido de la sección>"
    },
    {
      "action": "create",
      "title": "<título de la nueva sección>",
      "summary": "<resumen breve>",
      "content": "<HTML completo>"
    }
  ]
}

REGLAS DE HTML:
- Solo <p>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <code>.
- NO uses fences markdown.
- NO repitas el título dentro del content (el título va aparte).`;

  const userMessage = `Desarrolla el capítulo "${node.title}" distribuyendo este plan en sus secciones:

${suggestion.content}`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: userMessage }],
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

    let totalWords = 0;
    let updatedCount = 0;
    let createdCount = 0;

    // Update chapter intro (apertura) and closing (cierre).
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

    // Determine next position for new sections.
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
      totalWords += wc;
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

    await db
      .update(suggestions)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(suggestions.id, suggestion.id));

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
      description: `Aplicó sugerencia en "${node.title}": ${summary || "sin cambios"}`,
    });

    return NextResponse.json({
      ok: true,
      mode: "chapter",
      summary: summary || "Sin cambios",
      totalWords,
      updatedCount,
      createdCount,
      nodeId: node.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "error desarrollando",
      },
      { status: 500 }
    );
  }
}
