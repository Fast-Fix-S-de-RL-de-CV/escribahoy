"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  aiMessages,
} from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { getAnthropic, MODEL, SYSTEM_BASE } from "@/lib/anthropic";

const CreateProjectSchema = z.object({
  type: z.enum(["book", "course"]),
  kindDetail: z.string().trim().optional(),
  title: z.string().min(2).trim(),
  description: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  goal: z.string().trim().optional(),
});

export async function createProject(input: {
  type: "book" | "course";
  kindDetail?: string;
  title: string;
  description?: string;
  audience?: string;
  tone?: string;
  goal?: string;
}) {
  const user = await requireUser();
  const parsed = CreateProjectSchema.parse(input);
  const id = nanoid();
  const now = new Date();
  await db.insert(projects).values({
    id,
    userId: user.id,
    type: parsed.type,
    kindDetail: parsed.kindDetail,
    title: parsed.title,
    description: parsed.description,
    audience: parsed.audience,
    tone: parsed.tone,
    goal: parsed.goal,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

const UpdateProjectSchema = z.object({
  id: z.string(),
  kindDetail: z.string().trim().optional(),
  title: z.string().trim().min(2).optional(),
  subtitle: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  audience: z.string().trim().optional().nullable(),
  tone: z.string().trim().optional().nullable(),
  goal: z.string().trim().optional().nullable(),
  language: z.string().trim().optional(),
  perspective: z.string().trim().optional().nullable(),
  formality: z.string().trim().optional().nullable(),
  styleNotes: z.string().trim().optional().nullable(),
  glossary: z.string().trim().optional().nullable(),
  avoidTerms: z.string().trim().optional().nullable(),
});

export async function updateProject(input: z.infer<typeof UpdateProjectSchema>) {
  const user = await requireUser();
  const parsed = UpdateProjectSchema.parse(input);
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, parsed.id), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) throw new Error("Proyecto no encontrado");
  const { id: _id, ...rest } = parsed;
  await db
    .update(projects)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(projects.id, parsed.id));
}

export async function generateOutlineForProject(projectId: string) {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!rows.length) throw new Error("Proyecto no encontrado");
  const project = rows[0];

  const kb = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.projectId, projectId));

  const knowledgeContext = kb.length
    ? kb
        .map(
          (k) =>
            `Archivo: ${k.name}\n${k.extractedText.slice(0, 3000)}${
              k.extractedText.length > 3000 ? "\n[...]" : ""
            }`
        )
        .join("\n\n---\n\n")
        .slice(0, 30000)
    : "";

  const isBook = project.type === "book";
  const prompt = `Estoy creando ${isBook ? "un libro" : "un curso"} con estos datos:

Título: ${project.title}
${project.kindDetail ? `Tipo (${isBook ? "género" : "formato"}): ${project.kindDetail}\n` : ""}${project.description ? `Descripción: ${project.description}\n` : ""}${project.audience ? `Audiencia: ${project.audience}\n` : ""}${project.tone ? `Tono: ${project.tone}\n` : ""}${project.perspective ? `Persona/punto de vista: ${project.perspective}\n` : ""}${project.formality ? `Formalidad: ${project.formality}\n` : ""}${project.styleNotes ? `Notas de estilo: ${project.styleNotes}\n` : ""}${project.glossary ? `Glosario obligatorio: ${project.glossary}\n` : ""}${project.avoidTerms ? `Términos a evitar: ${project.avoidTerms}\n` : ""}${project.goal ? `Meta del proyecto: ${project.goal}\n` : ""}

${knowledgeContext ? `Material de referencia (knowledge base):\n${knowledgeContext}\n\n` : ""}Genera un outline COMPLETO adecuado al tipo "${project.kindDetail ?? (isBook ? "libro general" : "curso general")}". Reglas según formato:
- Para una novela / cuentos / poesía: capítulos por escenas, arcos, voz narrativa.
- Para ensayo / no-ficción narrativa: tesis, argumentos, contra-argumentos, conclusión.
- Para auto-ayuda / negocios / manual: problema, marco, pasos accionables, cierre.
- Para técnico / académico: fundamentos, profundización, casos, referencias.
- Para curso bootcamp / técnico: fundamentos → práctica → proyecto final.
- Para masterclass / fundamentos: claridad conceptual, no exhaustividad.

Tamaño aproximado: ${isBook ? "8-12 capítulos" : "6-10 módulos"}, cada uno con 3-5 ${isBook ? "secciones" : "lecciones"}.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto antes ni después) con este formato exacto:

{
  "nodes": [
    {
      "kind": "${isBook ? "chapter" : "module"}",
      "title": "Título del ${isBook ? "capítulo" : "módulo"} 1",
      "summary": "1-2 frases sobre qué cubre",
      "children": [
        { "kind": "${isBook ? "section" : "lesson"}", "title": "Sección/Lección 1", "summary": "Una frase" }
      ]
    }
  ]
}`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_BASE,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Respuesta vacía de la IA");
  }
  let raw = textBlock.text.trim();
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    raw = raw.slice(jsonStart, jsonEnd + 1);
  }
  type OutlineChild = {
    kind: string;
    title: string;
    summary?: string;
  };
  type OutlineParent = OutlineChild & { children?: OutlineChild[] };
  type OutlineResponse = { nodes: OutlineParent[] };
  let parsed: OutlineResponse;
  try {
    parsed = JSON.parse(raw) as OutlineResponse;
  } catch {
    throw new Error("La IA devolvió un formato inesperado, intenta de nuevo");
  }

  await db.delete(outlineNodes).where(eq(outlineNodes.projectId, projectId));
  const now = new Date();
  let pos = 0;
  for (const node of parsed.nodes ?? []) {
    const parentId = nanoid();
    await db.insert(outlineNodes).values({
      id: parentId,
      projectId,
      parentId: null,
      kind: (node.kind as "chapter" | "module") ?? (isBook ? "chapter" : "module"),
      title: node.title,
      summary: node.summary,
      position: pos++,
      createdAt: now,
      updatedAt: now,
    });
    let childPos = 0;
    for (const c of node.children ?? []) {
      await db.insert(outlineNodes).values({
        id: nanoid(),
        projectId,
        parentId,
        kind: (c.kind as "section" | "lesson") ?? (isBook ? "section" : "lesson"),
        title: c.title,
        summary: c.summary,
        position: childPos++,
        targetWords: isBook ? 800 : 400,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db
    .update(projects)
    .set({ outlineGenerated: true, updatedAt: now })
    .where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  revalidatePath("/dashboard");
}

const UpdateSectionSchema = z.object({
  projectId: z.string(),
  nodeId: z.string(),
  content: z.string().optional(),
  scriptContent: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["empty", "draft", "in_progress", "complete"]).optional(),
});

export async function updateNode(input: z.infer<typeof UpdateSectionSchema>) {
  const user = await requireUser();
  const parsed = UpdateSectionSchema.parse(input);
  const owns = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, parsed.projectId), eq(projects.userId, user.id))
    )
    .limit(1);
  if (!owns.length) throw new Error("Proyecto no encontrado");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.content !== undefined) {
    updates.content = parsed.content;
    const wc = parsed.content.replace(/<[^>]*>/g, " ").trim().split(/\s+/)
      .filter(Boolean).length;
    updates.wordCount = wc;
    if (parsed.status === undefined) {
      updates.status = wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty";
    }
  }
  if (parsed.scriptContent !== undefined)
    updates.scriptContent = parsed.scriptContent;
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.status !== undefined) updates.status = parsed.status;

  await db
    .update(outlineNodes)
    .set(updates)
    .where(
      and(
        eq(outlineNodes.id, parsed.nodeId),
        eq(outlineNodes.projectId, parsed.projectId)
      )
    );
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, parsed.projectId));
}

export async function addNode(input: {
  projectId: string;
  parentId: string | null;
  kind: "chapter" | "section" | "module" | "lesson";
  title: string;
}) {
  const user = await requireUser();
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) throw new Error("No autorizado");
  const siblings = await db
    .select({ position: outlineNodes.position })
    .from(outlineNodes)
    .where(
      and(
        eq(outlineNodes.projectId, input.projectId),
        input.parentId
          ? eq(outlineNodes.parentId, input.parentId)
          : eq(outlineNodes.kind, input.kind)
      )
    );
  const nextPos = siblings.length
    ? Math.max(...siblings.map((s) => s.position)) + 1
    : 0;
  const id = nanoid();
  const now = new Date();
  await db.insert(outlineNodes).values({
    id,
    projectId: input.projectId,
    parentId: input.parentId,
    kind: input.kind,
    title: input.title,
    position: nextPos,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

export async function deleteNode(input: {
  projectId: string;
  nodeId: string;
}) {
  const user = await requireUser();
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) throw new Error("No autorizado");
  await db
    .delete(outlineNodes)
    .where(
      and(
        eq(outlineNodes.id, input.nodeId),
        eq(outlineNodes.projectId, input.projectId)
      )
    );
  await db
    .delete(outlineNodes)
    .where(
      and(
        eq(outlineNodes.parentId, input.nodeId),
        eq(outlineNodes.projectId, input.projectId)
      )
    );
}

export async function generateScriptForLesson(input: {
  projectId: string;
  nodeId: string;
}) {
  const user = await requireUser();
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) throw new Error("No autorizado");
  const project = owns[0];

  const node = await db
    .select()
    .from(outlineNodes)
    .where(
      and(
        eq(outlineNodes.id, input.nodeId),
        eq(outlineNodes.projectId, input.projectId)
      )
    )
    .limit(1);
  if (!node.length) throw new Error("Lección no encontrada");

  const anthropic = getAnthropic();
  const prompt = `Convierte el siguiente contenido en un guión hablado, listo para teleprompter. Reglas:
- Frases cortas, lenguaje natural y cercano.
- Líneas de máximo 12 palabras.
- Pausas marcadas con saltos de línea.
- NO inventes contenido nuevo. Solo reformula lo que ya está.
- Empieza con un gancho directo de 1 frase.
- Cierra con una frase de transición a la siguiente lección.

Lección: ${node[0].title}
${node[0].summary ? `Resumen: ${node[0].summary}\n` : ""}
Contenido escrito:
${(node[0].content || "(vacío)").replace(/<[^>]*>/g, " ").slice(0, 6000)}

Devuelve SOLO el guión, sin explicaciones.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_BASE,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("La IA no devolvió guión");
  }
  await db
    .update(outlineNodes)
    .set({ scriptContent: textBlock.text.trim(), updatedAt: new Date() })
    .where(eq(outlineNodes.id, input.nodeId));
  return { script: textBlock.text.trim() };
}

export async function clearAIHistory(projectId: string) {
  const user = await requireUser();
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) throw new Error("No autorizado");
  await db.delete(aiMessages).where(eq(aiMessages.projectId, projectId));
}
