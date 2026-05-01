import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { outlineNodes, projects, suggestions } from "@/lib/schema";
import { getMissingCoreSettings } from "@/lib/project-validation";
import {
  DECORATION_KINDS,
  renderDecorationHtml,
  type DecorationKind,
} from "@/lib/decorations";
import { logChange } from "@/lib/change-log";
import type { Project } from "@/lib/schema";
import type Anthropic from "@anthropic-ai/sdk";

export { DECORATION_KINDS, type DecorationKind };

export type ToolCtx = {
  projectId: string;
  userId: string;
  isBook: boolean;
  project: Project;
};

export type ToolName =
  | "rename_node"
  | "update_node_summary"
  | "add_node"
  | "delete_node"
  | "move_node"
  | "append_to_section"
  | "replace_section_content"
  | "insert_decoration"
  | "leave_suggestion";

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "rename_node",
    description:
      "Cambia el título de un capítulo, sección, módulo o lección existente. Usa el ID exacto del nodo del outline.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "ID del nodo a renombrar" },
        newTitle: { type: "string", description: "Nuevo título" },
      },
      required: ["nodeId", "newTitle"],
    },
  },
  {
    name: "update_node_summary",
    description:
      "Actualiza el resumen (1-2 frases) de un capítulo/sección/módulo/lección. No toca el contenido escrito por el usuario.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        summary: { type: "string" },
      },
      required: ["nodeId", "summary"],
    },
  },
  {
    name: "add_node",
    description:
      "Agrega un nuevo capítulo/sección/módulo/lección al outline. Si parentId es null, se agrega como capítulo o módulo raíz. La position controla el orden (0 = primero).",
    input_schema: {
      type: "object",
      properties: {
        parentId: {
          type: ["string", "null"],
          description:
            "ID del nodo padre (capítulo/módulo) o null para crear nodo raíz",
        },
        kind: {
          type: "string",
          enum: ["chapter", "section", "module", "lesson"],
        },
        title: { type: "string" },
        summary: { type: "string", description: "Resumen breve, opcional" },
        position: {
          type: "number",
          description:
            "Posición en el orden de hermanos. Si no se da, se agrega al final.",
        },
      },
      required: ["kind", "title"],
    },
  },
  {
    name: "delete_node",
    description:
      "Elimina un nodo del outline. Si es un capítulo/módulo, también borra todas sus secciones/lecciones hijas. NO uses esta tool sin que el usuario lo haya pedido explícitamente.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "move_node",
    description:
      "Reordena un nodo cambiando su parentId y/o su position dentro de los hermanos.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        newParentId: { type: ["string", "null"] },
        newPosition: { type: "number" },
      },
      required: ["nodeId", "newPosition"],
    },
  },
  {
    name: "append_to_section",
    description:
      "Agrega contenido HTML al final del cuerpo de una sección/lección. Útil para añadir un párrafo, un ejemplo, una lista. NO uses esto para escribir capítulos enteros — máximo 1-3 párrafos por turno.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        html: {
          type: "string",
          description:
            "HTML simple a agregar (p, ul, ol, li, blockquote, strong, em, code).",
        },
      },
      required: ["nodeId", "html"],
    },
  },
  {
    name: "replace_section_content",
    description:
      "REEMPLAZA todo el contenido de una sección con HTML nuevo. SOLO úsala si el usuario dijo explícitamente 'reemplaza' o 'rescribe esto'. Para añadir, usa append_to_section.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        html: { type: "string" },
      },
      required: ["nodeId", "html"],
    },
  },
  {
    name: "leave_suggestion",
    description:
      "Deja una sugerencia pendiente en un capítulo o sección específica. La sugerencia aparecerá como un box arriba del editor de ese nodo, y el autor podrá ejecutarla con un click ('Ejecutar con IA') que desarrolla el contenido completo a partir de tu idea. Úsala cuando el usuario te dé ideas en el chat que correspondan a OTRO nodo distinto al que está abierto, o cuando le digas 'te dejo esta idea en el cap. X'. La sugerencia debe ser específica y accionable: qué cubrir, en qué orden, con qué ángulo.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "ID del capítulo/sección/módulo/lección donde dejar la idea",
        },
        content: {
          type: "string",
          description:
            "Texto de la sugerencia. Sé específico: qué temas cubrir, qué ángulo, qué ejemplos, en qué orden. Markdown OK. 100-300 palabras.",
        },
      },
      required: ["nodeId", "content"],
    },
  },
  {
    name: "insert_decoration",
    description:
      "Inserta un accesorio de libro al final de la sección: una frase destacada (pullquote), un cuadro de tip (callout), un epígrafe al inicio de capítulo (epigraph), una definición de término (definition), un ejercicio para el lector (exercise), un dato impactante (stat) o un recap final (recap). Útil cuando el usuario te pida 'agrega una cita', 'mete un dato curioso', 'pon un epígrafe de fulanito', 'cierra con un ejercicio'.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        kind: {
          type: "string",
          enum: [
            "pullquote",
            "callout",
            "epigraph",
            "definition",
            "exercise",
            "recap",
            "stat",
          ],
          description:
            "Tipo de accesorio: pullquote (frase grande), callout (tip), epigraph (cita atribuida al inicio), definition (término), exercise (acción), recap (resumen final), stat (dato).",
        },
        text: {
          type: "string",
          description: "Texto del accesorio.",
        },
        attribution: {
          type: "string",
          description:
            "Autor o fuente (solo para epigraph, pullquote, stat). Opcional.",
        },
        title: {
          type: "string",
          description:
            "Título corto opcional (callout, definition, exercise, recap).",
        },
      },
      required: ["nodeId", "kind", "text"],
    },
  },
];

export type ToolResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

export async function executeTool(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: ToolCtx
): Promise<ToolResult> {
  try {
    switch (name as ToolName) {
      case "rename_node": {
        const nodeId = String(rawInput.nodeId ?? "");
        const newTitle = String(rawInput.newTitle ?? "").trim();
        if (!nodeId || !newTitle) return { ok: false, error: "nodeId y newTitle requeridos" };
        const found = await assertNodeOwned(nodeId, ctx);
        if (!found) return { ok: false, error: "nodo no encontrado" };
        const oldTitle = found.title;
        await db
          .update(outlineNodes)
          .set({ title: newTitle, updatedAt: new Date() })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "rename_node",
          nodeId,
          description: `Renombró "${oldTitle}" → "${newTitle}"`,
        });
        return { ok: true };
      }
      case "update_node_summary": {
        const nodeId = String(rawInput.nodeId ?? "");
        const summary = String(rawInput.summary ?? "").trim();
        if (!nodeId) return { ok: false, error: "nodeId requerido" };
        const found = await assertNodeOwned(nodeId, ctx);
        if (!found) return { ok: false, error: "nodo no encontrado" };
        await db
          .update(outlineNodes)
          .set({ summary, updatedAt: new Date() })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "update_summary",
          nodeId,
          description: `Actualizó el resumen de "${found.title}"`,
        });
        return { ok: true };
      }
      case "add_node": {
        const parentId =
          rawInput.parentId == null ? null : String(rawInput.parentId);
        const kind = String(rawInput.kind ?? "");
        const title = String(rawInput.title ?? "").trim();
        const summary = rawInput.summary ? String(rawInput.summary) : null;
        if (!["chapter", "section", "module", "lesson"].includes(kind))
          return { ok: false, error: "kind inválido" };
        if (!title) return { ok: false, error: "title requerido" };
        if (parentId) {
          const ok = await assertNodeOwned(parentId, ctx);
          if (!ok) return { ok: false, error: "parentId no pertenece al proyecto" };
        }
        const siblings = await db
          .select({ position: outlineNodes.position })
          .from(outlineNodes)
          .where(
            and(
              eq(outlineNodes.projectId, ctx.projectId),
              parentId
                ? eq(outlineNodes.parentId, parentId)
                : eq(outlineNodes.kind, kind as "chapter" | "module")
            )
          );
        const requestedPos =
          typeof rawInput.position === "number"
            ? Math.max(0, Math.floor(rawInput.position))
            : siblings.length;
        const id = nanoid();
        const now = new Date();
        await db.insert(outlineNodes).values({
          id,
          projectId: ctx.projectId,
          parentId,
          kind: kind as "chapter" | "section" | "module" | "lesson",
          title,
          summary,
          position: requestedPos,
          targetWords: kind === "section" ? 800 : kind === "lesson" ? 400 : 0,
          createdAt: now,
          updatedAt: now,
        });
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "add_node",
          nodeId: id,
          description: `Agregó "${title}" (${kind})`,
        });
        return { ok: true, data: { id } };
      }
      case "delete_node": {
        const nodeId = String(rawInput.nodeId ?? "");
        const found = await assertNodeOwned(nodeId, ctx);
        if (!found) return { ok: false, error: "nodo no encontrado" };
        const oldTitle = found.title;
        // Delete children first (one level — outline only has 2 levels).
        await db
          .delete(outlineNodes)
          .where(
            and(
              eq(outlineNodes.parentId, nodeId),
              eq(outlineNodes.projectId, ctx.projectId)
            )
          );
        await db.delete(outlineNodes).where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "delete_node",
          nodeId,
          description: `Eliminó "${oldTitle}"`,
        });
        return { ok: true };
      }
      case "move_node": {
        const nodeId = String(rawInput.nodeId ?? "");
        const newParentId =
          rawInput.newParentId == null ? null : String(rawInput.newParentId);
        const newPosition =
          typeof rawInput.newPosition === "number"
            ? Math.max(0, Math.floor(rawInput.newPosition))
            : 0;
        const found = await assertNodeOwned(nodeId, ctx);
        if (!found) return { ok: false, error: "nodo no encontrado" };
        await db
          .update(outlineNodes)
          .set({
            parentId: newParentId,
            position: newPosition,
            updatedAt: new Date(),
          })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "move_node",
          nodeId,
          description: `Reordenó "${found.title}"`,
        });
        return { ok: true };
      }
      case "append_to_section": {
        const missing = getMissingCoreSettings(ctx.project);
        if (missing.length) {
          return {
            ok: false,
            error: `Antes de escribir contenido, completa la configuración del proyecto: ${missing.join(", ")}. El usuario debe abrir 'Configurar' y llenar esos campos.`,
          };
        }
        const nodeId = String(rawInput.nodeId ?? "");
        const html = String(rawInput.html ?? "");
        if (!nodeId || !html) return { ok: false, error: "nodeId y html requeridos" };
        const node = await assertNodeOwned(nodeId, ctx);
        if (!node) return { ok: false, error: "nodo no encontrado" };
        const newContent = (node.content || "") + html;
        const wc = newContent.replace(/<[^>]*>/g, " ").trim().split(/\s+/)
          .filter(Boolean).length;
        const addedWords = wc - (node.wordCount ?? 0);
        await db
          .update(outlineNodes)
          .set({
            content: newContent,
            wordCount: wc,
            status: wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty",
            updatedAt: new Date(),
          })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "append_content",
          nodeId,
          description: `Añadió ${addedWords > 0 ? addedWords : ""} palabras a "${node.title}"`,
        });
        return { ok: true };
      }
      case "replace_section_content": {
        const missing = getMissingCoreSettings(ctx.project);
        if (missing.length) {
          return {
            ok: false,
            error: `Antes de escribir contenido, completa la configuración del proyecto: ${missing.join(", ")}.`,
          };
        }
        const nodeId = String(rawInput.nodeId ?? "");
        const html = String(rawInput.html ?? "");
        if (!nodeId) return { ok: false, error: "nodeId requerido" };
        const node = await assertNodeOwned(nodeId, ctx);
        if (!node) return { ok: false, error: "nodo no encontrado" };
        const wc = html.replace(/<[^>]*>/g, " ").trim().split(/\s+/)
          .filter(Boolean).length;
        await db
          .update(outlineNodes)
          .set({
            content: html,
            wordCount: wc,
            status: wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty",
            updatedAt: new Date(),
          })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "replace_content",
          nodeId,
          description: `Reemplazó el contenido de "${node.title}" (${wc} palabras nuevas)`,
        });
        return { ok: true };
      }
      case "leave_suggestion": {
        const nodeId = String(rawInput.nodeId ?? "");
        const content = String(rawInput.content ?? "").trim();
        if (!nodeId || !content)
          return { ok: false, error: "nodeId y content requeridos" };
        const node = await assertNodeOwned(nodeId, ctx);
        if (!node) return { ok: false, error: "nodo no encontrado" };
        const id = nanoid();
        await db.insert(suggestions).values({
          id,
          projectId: ctx.projectId,
          nodeId,
          content,
        });
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "leave_suggestion",
          nodeId,
          description: `Dejó una sugerencia en "${node.title}"`,
        });
        return { ok: true, data: { id, nodeTitle: node.title } };
      }
      case "insert_decoration": {
        const missing = getMissingCoreSettings(ctx.project);
        if (missing.length) {
          return {
            ok: false,
            error: `Antes de insertar accesorios, completa la configuración del proyecto: ${missing.join(", ")}.`,
          };
        }
        const nodeId = String(rawInput.nodeId ?? "");
        const kind = String(rawInput.kind ?? "") as DecorationKind;
        const text = String(rawInput.text ?? "").trim();
        const attribution = rawInput.attribution
          ? String(rawInput.attribution).trim()
          : "";
        const title = rawInput.title ? String(rawInput.title).trim() : "";
        if (!nodeId || !text) return { ok: false, error: "nodeId y text requeridos" };
        if (!(DECORATION_KINDS as readonly string[]).includes(kind)) {
          return { ok: false, error: "kind inválido" };
        }
        const node = await assertNodeOwned(nodeId, ctx);
        if (!node) return { ok: false, error: "nodo no encontrado" };
        const html = renderDecorationHtml(kind, { text, attribution, title });
        const newContent = (node.content || "") + html;
        const wc = newContent.replace(/<[^>]*>/g, " ").trim().split(/\s+/)
          .filter(Boolean).length;
        await db
          .update(outlineNodes)
          .set({
            content: newContent,
            wordCount: wc,
            status: wc > 50 ? "in_progress" : wc > 0 ? "draft" : "empty",
            updatedAt: new Date(),
          })
          .where(eq(outlineNodes.id, nodeId));
        await logChange({
          projectId: ctx.projectId,
          actor: "ai",
          kind: "insert_decoration",
          nodeId,
          description: `Insertó accesorio (${kind}) en "${node.title}"`,
        });
        return { ok: true };
      }
      default:
        return { ok: false, error: `tool desconocida: ${name}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "error ejecutando tool",
    };
  }
}

async function assertNodeOwned(nodeId: string, ctx: ToolCtx) {
  const rows = await db
    .select()
    .from(outlineNodes)
    .innerJoin(projects, eq(outlineNodes.projectId, projects.id))
    .where(
      and(
        eq(outlineNodes.id, nodeId),
        eq(outlineNodes.projectId, ctx.projectId),
        eq(projects.userId, ctx.userId)
      )
    )
    .limit(1);
  return rows[0]?.outline_nodes ?? null;
}

export async function renderOutlineWithIds(projectId: string): Promise<string> {
  const nodes = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.projectId, projectId))
    .orderBy(asc(outlineNodes.position));
  const roots = nodes
    .filter((n) => !n.parentId)
    .sort((a, b) => a.position - b.position);
  const lines: string[] = [];
  for (const r of roots) {
    lines.push(
      `- [${r.kind}] id=${r.id} | ${r.title} (${r.status})${r.summary ? ` — ${r.summary}` : ""}`
    );
    const kids = nodes
      .filter((n) => n.parentId === r.id)
      .sort((a, b) => a.position - b.position);
    for (const k of kids) {
      lines.push(
        `  - [${k.kind}] id=${k.id} | ${k.title} (${k.status}, ${k.wordCount}p)${k.summary ? ` — ${k.summary}` : ""}`
      );
    }
  }
  return lines.join("\n") || "(sin outline aún)";
}
