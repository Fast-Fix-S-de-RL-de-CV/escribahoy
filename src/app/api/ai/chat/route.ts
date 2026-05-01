import { NextRequest } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  aiMessages,
} from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAnthropic, MODEL, SYSTEM_BASE } from "@/lib/anthropic";
import {
  TOOLS,
  executeTool,
  renderOutlineWithIds,
  type ToolCtx,
} from "@/lib/ai-tools";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOL_LOOPS = 6;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    projectId: string;
    nodeId?: string | null;
    scope?: "section" | "global";
    message: string;
  };
  const scope: "section" | "global" =
    body.scope === "section" || body.scope === "global"
      ? body.scope
      : body.nodeId
        ? "section"
        : "global";

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!projectRows.length) {
    return new Response("Project not found", { status: 404 });
  }
  const project = projectRows[0];
  const ctx: ToolCtx = {
    projectId: project.id,
    userId: user.id,
    isBook: project.type === "book",
    project,
  };

  // Save user message immediately.
  await db.insert(aiMessages).values({
    id: nanoid(),
    projectId: project.id,
    nodeId: body.nodeId ?? null,
    role: "user",
    content: body.message,
  });

  // Recent history (text-only — tool calls are not replayed)
  const history = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.projectId, project.id))
    .orderBy(asc(aiMessages.createdAt));
  const priorHistory = history.slice(0, -1).slice(-10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let assistantText = "";
      let outlineChanged = false;

      try {
        let outlineText = await renderOutlineWithIds(project.id);
        const kb = await db
          .select()
          .from(knowledgeFiles)
          .where(eq(knowledgeFiles.projectId, project.id));
        const kbContext = kb.length
          ? kb
              .map(
                (k) =>
                  `[KB:${k.name}] ${k.summary ?? k.extractedText.slice(0, 600)}`
              )
              .join("\n\n")
              .slice(0, 8000)
          : "";

        let activeSection = "";
        let scopeInstruction = "";
        if (body.nodeId && scope === "section") {
          const node = await db
            .select()
            .from(outlineNodes)
            .where(eq(outlineNodes.id, body.nodeId))
            .limit(1);
          if (node[0]) {
            activeSection = `\n\nEstás trabajando en este momento en: id=${node[0].id} "${node[0].title}" (${node[0].kind}).
${node[0].summary ? `Resumen: ${node[0].summary}\n` : ""}Contenido actual (${node[0].wordCount} palabras):
${(node[0].content || "(vacío)").replace(/<[^>]*>/g, " ").slice(0, 4000)}`;
            scopeInstruction = `

ALCANCE ACTUAL DEL CHAT: "Esta sección" — el usuario eligió que trabajemos SOLO en "${node[0].title}" (id=${node[0].id}).

Reglas para este alcance:
- Toda acción que ejecutes con tools debe afectar esta sección o sus hijos directos.
- Si el usuario te pide algo que claramente afecta OTRAS secciones, capítulos, el outline completo, el título del libro, o la configuración del proyecto:
  1. NO ejecutes la herramienta inmediatamente.
  2. Responde explicando que esa acción es de alcance global y afecta más allá de esta sección.
  3. Pregúntale si quiere que cambie el alcance a "Todo el proyecto" para proceder, o si prefiere reformular.
  4. Solo después de su confirmación explícita, ejecuta las herramientas.
- Acciones consideradas globales: regenerar outline, agregar/eliminar/renombrar capítulos enteros, mover capítulos, editar otra sección distinta, cambiar settings del proyecto.
- Acciones de alcance local OK: append_to_section/replace_section_content sobre la sección actual, insert_decoration en la sección actual, update_node_summary o rename_node SOBRE la sección actual.`;
          }
        } else {
          scopeInstruction = `

ALCANCE ACTUAL DEL CHAT: "Todo el proyecto" — puedes editar cualquier capítulo, sección, módulo, lección o el outline completo según lo que pida el usuario. Aún así pregunta antes de eliminar capítulos enteros.`;
        }

        const buildSystem = (currentOutline: string) => `${SYSTEM_BASE}

Proyecto actual:
- Tipo: ${project.type === "book" ? "libro" : "curso"}${project.kindDetail ? ` (${project.kindDetail})` : ""}
- Título: ${project.title}
${project.description ? `- Descripción: ${project.description}` : ""}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}
${project.perspective ? `- Persona: ${project.perspective}` : ""}
${project.formality ? `- Formalidad: ${project.formality}` : ""}
${project.styleNotes ? `- Notas de estilo: ${project.styleNotes}` : ""}
${project.glossary ? `- Glosario obligatorio: ${project.glossary}` : ""}
${project.avoidTerms ? `- Términos a evitar: ${project.avoidTerms}` : ""}

IMPORTANTE: Cuando el usuario te pida modificar el outline o el contenido (renombrar, agregar, eliminar, reordenar capítulos/secciones; añadir contenido a una sección), USA LAS HERRAMIENTAS DISPONIBLES (rename_node, add_node, delete_node, move_node, update_node_summary, append_to_section, replace_section_content). NO solo describas los cambios — EJECÚTALOS. Después de ejecutar las herramientas, confirma brevemente al usuario lo que hiciste.

Reglas para tools:
- Para conocer los IDs de los nodos consulta el outline abajo.
- NUNCA elimines un nodo a menos que el usuario lo haya pedido explícitamente.
- replace_section_content: SOLO si el usuario dijo "reemplaza" o "rescribe esto". Si no, usa append_to_section.
- append_to_section: máximo 1-3 párrafos por turno. Tu trabajo es organizar, no escribir capítulos enteros.

Outline actual (con IDs):
${currentOutline}
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}${activeSection}${scopeInstruction}`;

        const anthropic = getAnthropic();
        const messages: Anthropic.Messages.MessageParam[] = [
          ...priorHistory.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: body.message },
        ];

        let loop = 0;
        while (loop < MAX_TOOL_LOOPS) {
          loop++;
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: buildSystem(outlineText),
            tools: TOOLS,
            messages,
          });

          const blocks = response.content;
          for (const block of blocks) {
            if (block.type === "text") {
              assistantText += (assistantText ? "\n" : "") + block.text;
              send({ type: "delta", text: block.text });
            }
          }

          const toolUses = blocks.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
            break;
          }

          // Execute tool uses, send progress, build tool_result blocks.
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send({
              type: "tool",
              name: tu.name,
              input: tu.input,
              status: "running",
            });
            const result = await executeTool(
              tu.name,
              (tu.input ?? {}) as Record<string, unknown>,
              ctx
            );
            send({
              type: "tool",
              name: tu.name,
              status: result.ok ? "ok" : "error",
              error: result.ok ? undefined : result.error,
            });
            if (result.ok) outlineChanged = true;
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              is_error: !result.ok,
              content: result.ok
                ? JSON.stringify(result.data ?? { ok: true })
                : (result.error ?? "error"),
            });
          }

          messages.push({ role: "assistant", content: blocks });
          messages.push({ role: "user", content: toolResults });

          if (outlineChanged) {
            outlineText = await renderOutlineWithIds(project.id);
          }
        }
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "stream error",
        });
        assistantText +=
          (assistantText ? "\n\n" : "") +
          `[error: ${err instanceof Error ? err.message : "stream"}]`;
      } finally {
        if (assistantText.trim()) {
          await db.insert(aiMessages).values({
            id: nanoid(),
            projectId: project.id,
            nodeId: body.nodeId ?? null,
            role: "assistant",
            content: assistantText.trim(),
          });
        }
        send({ type: "end", outlineChanged });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
