import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
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
export const maxDuration = 60;

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

  // Solo aplica a secciones/lecciones (hojas).
  if (node.kind !== "section" && node.kind !== "lesson") {
    return NextResponse.json(
      { error: "solo aplica a secciones o lecciones" },
      { status: 400 }
    );
  }
  if ((node.wordCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "la sección ya tiene contenido" },
      { status: 400 }
    );
  }

  const missing = getMissingCoreSettings(project);
  if (missing.length) {
    return NextResponse.json(
      { error: `Completa primero: ${missing.join(", ")}`, code: "MISSING_CONFIG" },
      { status: 400 }
    );
  }

  // Si ya hay alguna sugerencia para este nodo (pending/applied/dismissed),
  // NO generamos otra automáticamente — el usuario ya tomó decisión sobre
  // ese nodo. Solo devolvemos lo que existe.
  const existing = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.nodeId, node.id))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({
      ok: true,
      skipped: "already_has_suggestion",
      suggestion: existing[0],
    });
  }

  // Contexto del capítulo padre + sus secciones hermanas para entender flujo.
  const allNodes = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.projectId, project.id))
    .orderBy(asc(outlineNodes.position));

  const parent = node.parentId
    ? allNodes.find((n) => n.id === node.parentId)
    : null;
  const siblings = parent
    ? allNodes
        .filter((n) => n.parentId === parent.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const myIndex = siblings.findIndex((s) => s.id === node.id);
  const previousSibling = myIndex > 0 ? siblings[myIndex - 1] : null;
  const nextSibling =
    myIndex >= 0 && myIndex < siblings.length - 1
      ? siblings[myIndex + 1]
      : null;

  // Outline compacto del libro.
  const roots = allNodes
    .filter((n) => !n.parentId && (n.kind === "chapter" || n.kind === "module"))
    .sort((a, b) => a.position - b.position);
  const outlineLines: string[] = [];
  roots.forEach((r, i) => {
    const num = i + 1;
    outlineLines.push(`${num}. ${r.title}`);
    const kids = allNodes
      .filter((n) => n.parentId === r.id)
      .sort((a, b) => a.position - b.position);
    kids.forEach((k, j) => {
      const isMe = k.id === node.id ? " ← (esta sección)" : "";
      outlineLines.push(`   ${num}.${j + 1} ${k.title}${isMe}`);
    });
  });

  // KB resumido.
  const kbRows = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.projectId, project.id));
  const kbContext = kbRows.length
    ? kbRows
        .map(
          (k) =>
            `[KB:${k.name}]\n${k.summary ?? k.extractedText.slice(0, 1200)}`
        )
        .join("\n\n")
        .slice(0, 8000)
    : "";

  const fmt = getFormat(project.format);
  const targetWords = node.targetWords || (project.type === "book" ? 800 : 400);

  const system = `${SYSTEM_BASE}

Proyecto:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- Glosario obligatorio: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}
${fmt ? `- Formato: ${fmt.label}` : ""}

Outline completo del libro (la sección actual está marcada):
${outlineLines.join("\n")}

${parent ? `Capítulo padre: "${parent.title}"${parent.summary ? ` — ${parent.summary}` : ""}` : ""}
${previousSibling ? `Sección anterior: "${previousSibling.title}"${previousSibling.summary ? ` — ${previousSibling.summary}` : ""}` : "(es la primera sección del capítulo)"}
${nextSibling ? `Próxima sección: "${nextSibling.title}"${nextSibling.summary ? ` — ${nextSibling.summary}` : ""}` : "(es la última sección del capítulo)"}

Sección actual a sugerir contenido:
- Título: "${node.title}"
- ${node.summary ? `Resumen previsto: ${node.summary}` : "Sin resumen previo"}
- Extensión objetivo: ~${targetWords} palabras
- Estado: vacía (no tiene contenido escrito aún)

${kbContext ? `Knowledge base del proyecto:\n${kbContext}` : ""}

TAREA:
Genera una SUGERENCIA estructural específica para que el autor sepa qué cubrir en esta sección. NO escribas el contenido de la sección — solo dale al autor un plan claro y accionable.

REGLAS DE LA SUGERENCIA:
- 100-300 palabras.
- Estructura clara: numera los puntos o usa bullets para que el autor pueda seguir el plan.
- Específica al tema de esta sección, NO genérica.
- Considera el flujo: qué se cubrió en la sección anterior, qué viene después, para no repetir ni dejar huecos.
- Si hay knowledge base, identifica fragmentos específicos que aplican aquí.
- Si el glosario tiene términos relevantes, mencionalos.
- Sugiere ejemplos, ganchos o casos prácticos cuando aplique.
- Termina con una nota corta del tono/voz que debe tener (1 frase).

EVITA:
- Frases genéricas tipo "explicar el concepto" o "dar ejemplos".
- Repetir lo que ya está en otras secciones del outline.
- Inventar datos o estadísticas.

DEVUELVE ÚNICAMENTE el texto de la sugerencia (markdown OK). Sin preámbulos como "Aquí está mi sugerencia:". Empieza directo con el plan.`;

  const userMessage = `Genera la sugerencia estructural para "${node.title}".`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
    const content = textBlock.text.trim();
    if (!content) {
      return NextResponse.json(
        { error: "respuesta vacía" },
        { status: 502 }
      );
    }

    const id = nanoid();
    await db.insert(suggestions).values({
      id,
      projectId: project.id,
      nodeId: node.id,
      content,
    });

    await logChange({
      projectId: project.id,
      actor: "ai",
      kind: "leave_suggestion",
      nodeId: node.id,
      description: `Generó sugerencia automática al abrir "${node.title}"`,
    });

    const created = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.id, id))
      .limit(1);

    return NextResponse.json({
      ok: true,
      suggestion: created[0],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "error generando",
      },
      { status: 500 }
    );
  }
}
