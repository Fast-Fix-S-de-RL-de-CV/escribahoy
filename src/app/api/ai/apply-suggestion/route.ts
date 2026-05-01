import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
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
export const maxDuration = 120;

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
  const targetWords = node.targetWords || (project.type === "book" ? 800 : 400);

  const isContainer =
    node.kind === "chapter" || node.kind === "module";

  // Si es un capítulo/módulo, expandimos las secciones hijas también.
  let childrenContext = "";
  if (isContainer) {
    const kids = await db
      .select()
      .from(outlineNodes)
      .where(eq(outlineNodes.parentId, node.id));
    childrenContext = kids
      .map((k) => `- ${k.title}${k.summary ? ` — ${k.summary}` : ""}`)
      .join("\n");
  }

  const system = `${SYSTEM_BASE}

Proyecto:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- Glosario: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}
${fmt ? `- Formato: ${fmt.label} (${fmt.widthCm}×${fmt.heightCm}cm)` : ""}

Nodo a desarrollar: "${node.title}" (${node.kind})
${node.summary ? `Resumen previsto: ${node.summary}` : ""}
${childrenContext ? `\nSubsecciones hijas:\n${childrenContext}` : ""}
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}

EXCEPCIÓN A LA REGLA NORMAL:
En este caso EL USUARIO TE PIDIÓ EXPLÍCITAMENTE desarrollar el contenido completo a partir de la sugerencia que dejaste. Por lo tanto:
- Sí desarrolla el contenido completo (~${targetWords} palabras para sección, más si es capítulo).
- Mantén el tono, persona narrativa y términos del proyecto.
- Si es un capítulo (container), introduce el capítulo de forma general; no desarrolles el contenido de cada sub-sección — eso se hace después.
- Si es una sección/lección, desarrolla el contenido específico.
- Devuelve HTML simple: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>.
- NO uses fences markdown ni \`\`\`. Devuelve SOLO el HTML.`;

  const userMessage = `Desarrolla el contenido completo de "${node.title}" siguiendo esta sugerencia que dejaste antes:

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
    // Limpia fences markdown si se colaron.
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
      content: html,
      wordCount: wc,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "error desarrollando sugerencia",
      },
      { status: 500 }
    );
  }
}
