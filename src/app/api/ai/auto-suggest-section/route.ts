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

function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

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

  if (node.kind !== "section" && node.kind !== "lesson") {
    return NextResponse.json(
      { error: "solo aplica a secciones o lecciones" },
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

  // Si ya hay alguna sugerencia para este nodo, no generamos otra.
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

  // === CONTEXTO COMPLETO ===

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

  // Outline compacto del libro completo.
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
      const summary = k.summary ? ` — ${k.summary}` : "";
      const wc =
        k.wordCount > 0 ? ` [${k.wordCount} palabras escritas]` : "";
      outlineLines.push(
        `   ${num}.${j + 1} ${k.title}${summary}${wc}${isMe}`
      );
    });
  });

  // Knowledge base completo (más texto, no solo summary).
  const kbRows = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.projectId, project.id));
  const kbContext = kbRows.length
    ? kbRows
        .map(
          (k) =>
            `[KB · ${k.name}]\n${k.extractedText.slice(0, 6000)}${k.extractedText.length > 6000 ? "\n[...truncado...]" : ""}`
        )
        .join("\n\n---\n\n")
        .slice(0, 30000)
    : "";

  // Apertura del capítulo padre (si tiene contenido).
  const parentOpening = parent
    ? htmlToText(parent.content).slice(0, 3000)
    : "";
  const parentClosing = parent
    ? htmlToText(parent.closingContent).slice(0, 1500)
    : "";

  // Contenido COMPLETO de las secciones hermanas que ya están escritas (no solo summary).
  const siblingsWithContent = siblings
    .filter((s) => s.id !== node.id && (s.wordCount ?? 0) > 0)
    .map((s) => {
      const text = htmlToText(s.content);
      const truncated = text.slice(0, 2500);
      return `── ${s.title} (${s.wordCount} palabras)${s.summary ? ` — ${s.summary}` : ""}\n${truncated}${text.length > 2500 ? "\n[...truncado...]" : ""}`;
    })
    .join("\n\n")
    .slice(0, 20000);

  // Contenido actual de la propia sección (si existe).
  const myCurrentContent = htmlToText(node.content);
  const hasExistingContent = myCurrentContent.length > 30;

  const fmt = getFormat(project.format);
  const targetWords = node.targetWords || (project.type === "book" ? 800 : 400);

  const system = `${SYSTEM_BASE}

═══════════════════════════════════════════════════
PROYECTO COMPLETO
═══════════════════════════════════════════════════
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.subtitle ? `- Subtítulo: ${project.subtitle}` : ""}
${project.description ? `- Descripción: ${project.description}` : ""}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona narrativa: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- GLOSARIO OBLIGATORIO (respeta estos términos exactos):\n${project.glossary}` : ""}
${project.avoidTerms ? `- TÉRMINOS A EVITAR (NO los uses):\n${project.avoidTerms}` : ""}
${fmt ? `- Formato físico: ${fmt.label} (${fmt.widthCm}×${fmt.heightCm}cm), ${project.targetPages} páginas objetivo` : ""}

═══════════════════════════════════════════════════
ESTRUCTURA COMPLETA DEL LIBRO
═══════════════════════════════════════════════════
${outlineLines.join("\n")}

═══════════════════════════════════════════════════
CAPÍTULO PADRE: "${parent?.title ?? "(sin padre)"}"
═══════════════════════════════════════════════════
${parent?.summary ? `Resumen: ${parent.summary}\n` : ""}${
    parentOpening
      ? `APERTURA del capítulo (lo que el lector lee antes de esta sección):\n${parentOpening}\n`
      : "(El capítulo aún no tiene apertura escrita.)\n"
  }${
    parentClosing
      ? `\nCIERRE del capítulo (lo que viene después de las secciones):\n${parentClosing}`
      : ""
  }

═══════════════════════════════════════════════════
SECCIÓN ANTERIOR
═══════════════════════════════════════════════════
${
  previousSibling
    ? `"${previousSibling.title}"${previousSibling.summary ? ` — ${previousSibling.summary}` : ""} (${previousSibling.wordCount} palabras escritas)`
    : "(es la primera sección del capítulo)"
}

═══════════════════════════════════════════════════
PRÓXIMA SECCIÓN
═══════════════════════════════════════════════════
${
  nextSibling
    ? `"${nextSibling.title}"${nextSibling.summary ? ` — ${nextSibling.summary}` : ""} (${nextSibling.wordCount} palabras escritas)`
    : "(es la última sección del capítulo)"
}

═══════════════════════════════════════════════════
CONTENIDO YA ESCRITO EN OTRAS SECCIONES DEL MISMO CAPÍTULO
(NO repitas estos contenidos en la sugerencia)
═══════════════════════════════════════════════════
${siblingsWithContent || "(ninguna otra sección de este capítulo tiene contenido escrito todavía)"}

${
  kbContext
    ? `═══════════════════════════════════════════════════
KNOWLEDGE BASE DEL PROYECTO (PDFs/notas que el autor subió)
═══════════════════════════════════════════════════
${kbContext}`
    : ""
}

═══════════════════════════════════════════════════
SECCIÓN ACTUAL A SUGERIR
═══════════════════════════════════════════════════
- Título: "${node.title}"
- ${node.summary ? `Resumen previsto: ${node.summary}` : "Sin resumen previo"}
- Extensión objetivo: ~${targetWords} palabras
- Estado actual: ${hasExistingContent ? `tiene ${node.wordCount} palabras YA ESCRITAS` : "vacía (sin contenido aún)"}
${
  hasExistingContent
    ? `\nCONTENIDO ACTUAL ESCRITO POR EL AUTOR (respétalo, NO lo reemplaces):\n${myCurrentContent.slice(0, 4000)}${myCurrentContent.length > 4000 ? "\n[...]" : ""}`
    : ""
}

═══════════════════════════════════════════════════
TAREA
═══════════════════════════════════════════════════
${
  hasExistingContent
    ? `El autor YA empezó a escribir esta sección. Genera una sugerencia que:
- Reconozca qué ya tiene escrito y construya sobre eso (NO le pidas reescribir).
- Sugiera qué FALTA cubrir para completar la sección de forma coherente.
- Identifique posibles brechas, conexiones no hechas con otras secciones, ejemplos que faltan, transiciones débiles.
- Si el contenido actual contradice algo del resto del libro, márcalo claramente.`
    : `El autor está abriendo esta sección por primera vez. Genera un plan estructural específico para que sepa qué cubrir.`
}

REGLAS DE LA SUGERENCIA:
- 100-300 palabras.
- Estructura clara: bullets o numeración.
- ESPECÍFICA al tema de esta sección, no genérica.
- Considera el FLUJO: qué viene de la sección anterior, qué se entrega a la próxima.
- Si el knowledge base contiene material relevante para esta sección específicamente, IDENTIFÍCALO con cita corta y úsalo en la sugerencia (ej. "según [KB:nombre del archivo]: ...").
- Respeta el GLOSARIO obligatorio (usa esos términos exactos).
- NUNCA uses los términos prohibidos.
- NO repitas lo que ya está cubierto en otras secciones del mismo capítulo (mostradas arriba).
- Si hay conexiones obvias con otros capítulos del outline, menciónalas como "ver cap. X.Y".
- Termina con una nota corta del tono/voz que debe tener (1 frase).

EVITA:
- Frases genéricas tipo "explicar el concepto" o "dar ejemplos".
- Inventar datos o estadísticas que no están en el KB ni son verificables.
- Repetir el outline.

DEVUELVE ÚNICAMENTE el texto de la sugerencia (markdown OK). Sin preámbulos. Empieza directo con el plan o la observación.`;

  const userMessage = hasExistingContent
    ? `El autor ya empezó a escribir "${node.title}". Genera la sugerencia para ayudarle a completarla coherentemente con todo el libro.`
    : `Genera la sugerencia estructural para "${node.title}".`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
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

    // Re-verificar justo antes de insertar: si otra request concurrente ya
    // creó una sugerencia para este nodo durante los segundos que tardó la
    // IA, no insertamos una duplicada.
    const raceCheck = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.nodeId, node.id))
      .limit(1);
    if (raceCheck.length) {
      return NextResponse.json({
        ok: true,
        skipped: "race_existing",
        suggestion: raceCheck[0],
      });
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
      description: `Generó sugerencia automática al abrir "${node.title}"${hasExistingContent ? " (con contenido existente)" : ""}`,
    });

    const created = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.id, id))
      .limit(1);

    return NextResponse.json({
      ok: true,
      suggestion: created[0],
      hadExistingContent: hasExistingContent,
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
