"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  aiMessages,
  suggestions,
} from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { getAnthropic, MODEL, SYSTEM_BASE } from "@/lib/anthropic";
import { logChange } from "@/lib/change-log";
import { getFormat } from "@/lib/book-formats";
import { wordCount } from "@/lib/utils";
import { consumirCuota, puedeCrearProyecto } from "@/lib/quotas";
import { registrarUso, usoDeRespuesta, type ModeloIA } from "@/lib/ai-usage";
import { planPorId } from "@/lib/plans";
import { esSuperAdmin, suscripcionDe } from "@/lib/subscription";

/**
 * Modelo con el que se registra el costo de las acciones de este archivo.
 * Las dos llamadas a la IA de aquí mandan `MODEL`, que hoy es exactamente
 * `modeloId("opus")` (claude-opus-4-7). Explícito a propósito: si alguna
 * cambia de modelo, esta línea cambia con ella o la métrica mentiría.
 */
const MODELO_USADO: ModeloIA = "opus";

const CreateProjectSchema = z.object({
  type: z.enum(["book", "course"]),
  kindDetail: z.string().trim().optional(),
  format: z.string().trim().optional(),
  targetPages: z.number().int().positive().optional(),
  title: z.string().min(2).trim(),
  description: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  goal: z.string().trim().optional(),
});

export async function createProject(input: {
  type: "book" | "course";
  kindDetail?: string;
  format?: string;
  targetPages?: number;
  title: string;
  description?: string;
  audience?: string;
  tone?: string;
  goal?: string;
}) {
  const user = await requireUser();
  const parsed = CreateProjectSchema.parse(input);

  // CUPO DE PROYECTOS. No es cuota mensual: es un tope de simultáneos, así que
  // se compara contra el estado actual (proyectos no archivados) en vez de
  // consumir un contador. Va antes del insert porque después ya no hay vuelta
  // atrás: el proyecto existiría y el usuario habría rebasado su plan.
  const cupo = await puedeCrearProyecto(user.id);
  if (!cupo.ok) throw new Error(cupo.mensaje);

  const id = nanoid();
  const now = new Date();
  await db.insert(projects).values({
    id,
    userId: user.id,
    type: parsed.type,
    kindDetail: parsed.kindDetail,
    format: parsed.format,
    targetPages: parsed.targetPages,
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
  format: z.string().trim().optional().nullable(),
  targetPages: z.number().int().positive().optional().nullable(),
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
  await logChange({
    projectId: parsed.id,
    actor: "user",
    kind: "update_settings",
    description: `Actualizó la configuración del proyecto`,
    metadata: rest as Record<string, unknown>,
  });
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

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // Después de verificar la propiedad (nadie gasta cuota por pedir el temario
  // de un proyecto ajeno) y antes de armar el prompt. Un temario completo son
  // ~15,430 tokens de entrada + hasta 6,000 de salida: es la acción más cara
  // del producto y no puede quedar sin puerta. Es un Server Action, así que el
  // contrato de error es lanzar: el formulario ya muestra el mensaje.
  const cuota = await consumirCuota(user.id, "temario");
  if (!cuota.ok) throw new Error(cuota.mensaje);

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

  // Tipos de libro donde el capítulo NO se subdivide en secciones —
  // todo el contenido va en el cuerpo del capítulo. Esto debe coincidir
  // con NO_SECTIONS_KINDS del workspace.
  const NO_SECTIONS_KINDS = new Set(["novela", "cuentos", "poesia"]);
  const flatChapters =
    isBook &&
    !!project.kindDetail &&
    NO_SECTIONS_KINDS.has(project.kindDetail);

  // Calcular palabras totales y distribución según target_pages.
  const fmt = getFormat(project.format);
  const targetPages = project.targetPages ?? null;
  const totalWords =
    fmt && targetPages ? fmt.wordsPerPage * targetPages : null;

  // Sugerencia de capítulos según extensión.
  let chapterCount = isBook ? 10 : 8;
  let sectionsPerChapter = flatChapters ? 0 : 4;
  if (totalWords) {
    if (totalWords < 25000) {
      chapterCount = isBook ? (flatChapters ? 12 : 6) : 5;
      sectionsPerChapter = flatChapters ? 0 : 3;
    } else if (totalWords < 50000) {
      chapterCount = isBook ? (flatChapters ? 18 : 8) : 6;
      sectionsPerChapter = flatChapters ? 0 : 3;
    } else if (totalWords < 90000) {
      chapterCount = isBook ? (flatChapters ? 24 : 10) : 8;
      sectionsPerChapter = flatChapters ? 0 : 4;
    } else if (totalWords < 150000) {
      chapterCount = isBook ? (flatChapters ? 30 : 12) : 10;
      sectionsPerChapter = flatChapters ? 0 : 4;
    } else {
      chapterCount = isBook ? (flatChapters ? 40 : 15) : 12;
      sectionsPerChapter = flatChapters ? 0 : 5;
    }
  }
  const wordsPerLeaf = totalWords
    ? Math.round(
        totalWords /
          (flatChapters
            ? chapterCount
            : chapterCount * sectionsPerChapter)
      )
    : flatChapters
      ? 2500
      : isBook
        ? 800
        : 400;

  const prompt = `Estoy creando ${isBook ? "un libro" : "un curso"} con estos datos:

Título: ${project.title}
${project.kindDetail ? `Tipo (${isBook ? "género" : "formato"}): ${project.kindDetail}\n` : ""}${fmt ? `Formato físico: ${fmt.label} (${fmt.widthIn}×${fmt.heightIn}″ / ${fmt.widthCm}×${fmt.heightCm}cm)\n` : ""}${targetPages ? `Páginas objetivo: ${targetPages}\n` : ""}${totalWords ? `Palabras totales aproximadas: ${totalWords.toLocaleString("es-MX")} (≈ ${fmt?.wordsPerPage} palabras/página)\n` : ""}${project.description ? `Descripción: ${project.description}\n` : ""}${project.audience ? `Audiencia: ${project.audience}\n` : ""}${project.tone ? `Tono: ${project.tone}\n` : ""}${project.perspective ? `Persona/punto de vista: ${project.perspective}\n` : ""}${project.formality ? `Formalidad: ${project.formality}\n` : ""}${project.styleNotes ? `Notas de estilo: ${project.styleNotes}\n` : ""}${project.glossary ? `Glosario obligatorio: ${project.glossary}\n` : ""}${project.avoidTerms ? `Términos a evitar: ${project.avoidTerms}\n` : ""}${project.goal ? `Meta del proyecto: ${project.goal}\n` : ""}

${knowledgeContext ? `Material de referencia (knowledge base):\n${knowledgeContext}\n\n` : ""}Genera un outline COMPLETO adecuado al tipo "${project.kindDetail ?? (isBook ? "libro general" : "curso general")}". Reglas según formato:
- Para una novela / cuentos / poesía: capítulos por escenas, arcos, voz narrativa. NO se subdividen en secciones — el contenido fluye corrido en cada capítulo.
- Para ensayo / no-ficción narrativa: tesis, argumentos, contra-argumentos, conclusión.
- Para auto-ayuda / negocios / manual: problema, marco, pasos accionables, cierre.
- Para técnico / académico: fundamentos, profundización, casos, referencias.
- Para curso bootcamp / técnico: fundamentos → práctica → proyecto final.
- Para masterclass / fundamentos: claridad conceptual, no exhaustividad.

${
  flatChapters
    ? `Tamaño exacto requerido: ${chapterCount} capítulos SIN sub-secciones (no incluyas el campo "children", o déjalo como array vacío). Cada capítulo debe rondar ${wordsPerLeaf} palabras (calibra la profundidad de los resúmenes para esa extensión, no lo escribas en el JSON).`
    : `Tamaño exacto requerido: ${chapterCount} ${isBook ? "capítulos" : "módulos"}, cada uno con ${sectionsPerChapter} ${isBook ? "secciones" : "lecciones"}.${totalWords ? ` Cada ${isBook ? "sección" : "lección"} debe rondar ${wordsPerLeaf} palabras (no agregues esto al JSON, sólo úsalo para calibrar la profundidad y especificidad de los títulos y resúmenes).` : ""}`
}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto antes ni después) con este formato exacto:

${
  flatChapters
    ? `{
  "nodes": [
    {
      "kind": "chapter",
      "title": "Título del capítulo 1",
      "summary": "1-2 frases sobre qué cubre"
    }
  ]
}`
    : `{
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
}`
}`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_BASE,
    messages: [{ role: "user", content: prompt }],
  });

  // Los tokens ya se gastaron aunque la respuesta no traiga JSON usable, así
  // que la huella de costo se registra ANTES de validarla.
  const uso = usoDeRespuesta(response.usage);
  await registrarUso({
    userId: user.id,
    projectId,
    accion: "temario",
    modelo: MODELO_USADO,
    inputTokens: uso.input,
    outputTokens: uso.output,
    cacheReadTokens: uso.cacheRead,
    cacheWriteTokens: uso.cacheWrite,
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

  // CRÍTICO: validar que la IA devolvió capítulos ANTES de borrar el outline
  // existente. Si la respuesta es {}, {"nodes": []} o {"nodes": null}, el
  // JSON.parse no lanza, y sin esta guarda destruiríamos el outline del autor
  // (capítulos + contenido escrito) reemplazándolo por front/back matter vacío.
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error(
      "La IA no devolvió capítulos válidos. No se modificó tu outline; intenta de nuevo."
    );
  }

  await db.delete(outlineNodes).where(eq(outlineNodes.projectId, projectId));
  const now = new Date();
  let pos = 0;

  // Front matter (libros): páginas preliminares estándar.
  if (isBook) {
    const frontMatter = buildFrontMatter(project.kindDetail);
    for (const fm of frontMatter) {
      await db.insert(outlineNodes).values({
        id: nanoid(),
        projectId,
        parentId: null,
        kind: "frontmatter",
        title: fm.title,
        summary: fm.summary,
        position: pos++,
        targetWords: fm.targetWords,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else {
    // Curso: bienvenida y cómo usar el curso
    const intro = [
      {
        title: "Bienvenida",
        summary: "Mensaje breve que da la bienvenida al alumno y enmarca el curso.",
      },
      {
        title: "Cómo aprovechar este curso",
        summary: "Guía rápida para usar el material, ritmo recomendado, recursos.",
      },
    ];
    for (const i of intro) {
      await db.insert(outlineNodes).values({
        id: nanoid(),
        projectId,
        parentId: null,
        kind: "frontmatter",
        title: i.title,
        summary: i.summary,
        position: pos++,
        targetWords: 200,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Cuerpo: capítulos / módulos
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
      // Para flat chapters el contenido vive en el cuerpo, así que el
      // target del capítulo mismo es alto. Para libros estructurados, el
      // capítulo solo lleva apertura corta (no le seteamos target aquí).
      targetWords: flatChapters ? wordsPerLeaf : 0,
      createdAt: now,
      updatedAt: now,
    });
    // Si el tipo no usa sub-secciones, ignoramos children aunque la IA
    // los haya devuelto.
    if (flatChapters) continue;
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
        targetWords: wordsPerLeaf,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Back matter (libros): páginas finales estándar.
  if (isBook) {
    const backMatter = buildBackMatter(project.kindDetail);
    for (const bm of backMatter) {
      await db.insert(outlineNodes).values({
        id: nanoid(),
        projectId,
        parentId: null,
        kind: "backmatter",
        title: bm.title,
        summary: bm.summary,
        position: pos++,
        targetWords: bm.targetWords,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else {
    // Curso: cierre + recursos
    const closing = [
      {
        title: "Conclusión y siguientes pasos",
        summary: "Resumen del aprendizaje, recomendaciones para profundizar.",
      },
      {
        title: "Recursos adicionales",
        summary: "Lecturas, herramientas y comunidades para seguir.",
      },
    ];
    for (const c of closing) {
      await db.insert(outlineNodes).values({
        id: nanoid(),
        projectId,
        parentId: null,
        kind: "backmatter",
        title: c.title,
        summary: c.summary,
        position: pos++,
        targetWords: 250,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db
    .update(projects)
    .set({ outlineGenerated: true, updatedAt: now })
    .where(eq(projects.id, projectId));

  await logChange({
    projectId,
    actor: "ai",
    kind: "generate_outline",
    description: `Generó el outline completo (${parsed.nodes?.length ?? 0} ${isBook ? "capítulos" : "módulos"})`,
  });
}

function buildFrontMatter(kindDetail: string | null) {
  const base: Array<{ title: string; summary: string; targetWords: number }> = [
    {
      title: "Dedicatoria",
      summary: "A quién le dedicas este libro. 1-3 frases personales.",
      targetWords: 30,
    },
    {
      title: "Epígrafe del libro",
      summary: "Cita corta de un autor que inspira el espíritu del libro.",
      targetWords: 30,
    },
    {
      title: "Prefacio",
      summary:
        "Cómo nació este libro, por qué lo escribiste, a quién va dirigido.",
      targetWords: 600,
    },
    {
      title: "Agradecimientos",
      summary: "Personas que hicieron posible este libro.",
      targetWords: 200,
    },
    {
      title: "Introducción",
      summary:
        "Plantea el problema central y promete el viaje que el lector hará.",
      targetWords: 1200,
    },
  ];
  if (kindDetail === "novela" || kindDetail === "cuentos") {
    return base.filter((b) => b.title === "Dedicatoria" || b.title === "Epígrafe del libro");
  }
  if (kindDetail === "poesia") {
    return base.filter((b) => ["Dedicatoria", "Epígrafe del libro"].includes(b.title));
  }
  if (kindDetail === "infantil") {
    return base.filter((b) => b.title === "Dedicatoria");
  }
  return base;
}

function buildBackMatter(kindDetail: string | null) {
  const epilogue = {
    title: "Epílogo",
    summary: "Reflexión final de cierre. Lo que el lector se lleva.",
    targetWords: 800,
  };
  const aboutAuthor = {
    title: "Sobre el autor",
    summary: "Bio breve, contexto, dónde encontrarte (web/redes).",
    targetWords: 200,
  };
  const glossary = {
    title: "Glosario",
    summary: "Términos clave usados en el libro con sus definiciones.",
    targetWords: 600,
  };
  const bibliography = {
    title: "Bibliografía y referencias",
    summary: "Fuentes citadas en el libro, lecturas recomendadas.",
    targetWords: 400,
  };
  const notes = {
    title: "Notas",
    summary: "Aclaraciones, citas extendidas, notas al final.",
    targetWords: 300,
  };

  if (kindDetail === "novela" || kindDetail === "cuentos") {
    return [aboutAuthor];
  }
  if (kindDetail === "poesia") {
    return [aboutAuthor];
  }
  if (kindDetail === "infantil") {
    return [aboutAuthor];
  }
  if (
    kindDetail === "academico" ||
    kindDetail === "tecnico"
  ) {
    return [epilogue, glossary, bibliography, notes, aboutAuthor];
  }
  if (kindDetail === "ensayo" || kindDetail === "no-ficcion") {
    return [epilogue, bibliography, notes, aboutAuthor];
  }
  // auto-ayuda, negocios, manual, memoria
  return [epilogue, glossary, aboutAuthor];
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
  closingContent: z.string().optional(),
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
    const wc = wordCount(parsed.content);
    updates.wordCount = wc;
    if (parsed.status === undefined) {
      updates.status = wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty";
    }
  }
  if (parsed.closingContent !== undefined)
    updates.closingContent = parsed.closingContent;
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

  // Log only meaningful user actions (avoid spamming on autosave content edits).
  if (parsed.title !== undefined) {
    await logChange({
      projectId: parsed.projectId,
      actor: "user",
      kind: "rename_node",
      nodeId: parsed.nodeId,
      description: `Renombró a "${parsed.title}"`,
    });
  }
  if (parsed.status !== undefined) {
    await logChange({
      projectId: parsed.projectId,
      actor: "user",
      kind: "update_status",
      nodeId: parsed.nodeId,
      description: `Marcó como ${parsed.status}`,
    });
  }
}

export async function addNode(input: {
  projectId: string;
  parentId: string | null;
  kind:
    | "chapter"
    | "section"
    | "module"
    | "lesson"
    | "frontmatter"
    | "backmatter";
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
  // Recolectar el nodo + sus hijos directos para limpiar también las
  // sugerencias ligadas (suggestions.nodeId no tiene FK a outline_nodes, así
  // que no cascadean solas; quedaban 'pending' apuntando a nodos borrados,
  // inflando el contador del sidebar para nodos inexistentes).
  const children = await db
    .select({ id: outlineNodes.id })
    .from(outlineNodes)
    .where(
      and(
        eq(outlineNodes.parentId, input.nodeId),
        eq(outlineNodes.projectId, input.projectId)
      )
    );
  const idsToClear = [input.nodeId, ...children.map((c) => c.id)];
  await db
    .delete(suggestions)
    .where(
      and(
        eq(suggestions.projectId, input.projectId),
        inArray(suggestions.nodeId, idsToClear)
      )
    );
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

  // ── MODO CURSO (función exclusiva del plan Autoridad) ─────────────────────
  // El guion de teleprompter es LA razón por la que alguien paga Autoridad. Se
  // verifica la bandera del plan, no la cuota, porque el mensaje tiene que
  // decir de qué plan es la función y no "ya usaste 0 guiones". Los super
  // admins pasan, igual que en consumirCuota, para poder probar en producción.
  const suscripcion = await suscripcionDe(user.id);
  const plan = planPorId(suscripcion.plan);
  if (!plan.modoCurso && !(await esSuperAdmin(user.id))) {
    throw new Error(
      "El guion de teleprompter es del plan Autoridad, que incluye el modo curso completo. Tu plan actual no lo trae: puedes cambiarlo desde la página de precios."
    );
  }

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

  // ── CUOTA ─────────────────────────────────────────────────────────────────
  // Después de la verificación de plan (para que gane el mensaje que explica
  // que es función de Autoridad) y de encontrar la lección — pedir un guion de
  // una lección inexistente no debe cobrarle una unidad a nadie —, y justo
  // antes de gastar tokens.
  const cuota = await consumirCuota(user.id, "guion");
  if (!cuota.ok) throw new Error(cuota.mensaje);

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

  // Igual que en el temario: la huella de costo primero, la validación de la
  // respuesta después. Los tokens ya se pagaron.
  const uso = usoDeRespuesta(response.usage);
  await registrarUso({
    userId: user.id,
    projectId: project.id,
    accion: "guion",
    modelo: MODELO_USADO,
    inputTokens: uso.input,
    outputTokens: uso.output,
    cacheReadTokens: uso.cacheRead,
    cacheWriteTokens: uso.cacheWrite,
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
