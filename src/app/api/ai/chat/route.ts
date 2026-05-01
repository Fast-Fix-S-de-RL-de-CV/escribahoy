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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    projectId: string;
    nodeId?: string | null;
    message: string;
  };

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!projectRows.length) {
    return new Response("Project not found", { status: 404 });
  }
  const project = projectRows[0];

  // Load outline (compact tree representation for context)
  const outline = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.projectId, project.id))
    .orderBy(asc(outlineNodes.position));
  const outlineText = renderOutline(outline);

  // Load KB summaries
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

  // Active section context
  let activeSection = "";
  if (body.nodeId) {
    const node = outline.find((n) => n.id === body.nodeId);
    if (node) {
      activeSection = `\n\nEstás trabajando en este momento en: "${node.title}" (${node.kind}).
${node.summary ? `Resumen previsto: ${node.summary}\n` : ""}Contenido actual (${node.wordCount} palabras):
${(node.content || "(vacío)").replace(/<[^>]*>/g, " ").slice(0, 4000)}`;
    }
  }

  // Conversation history
  const history = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.projectId, project.id))
    .orderBy(asc(aiMessages.createdAt));
  const recentHistory = history.slice(-10);

  // Save user message
  await db.insert(aiMessages).values({
    id: nanoid(),
    projectId: project.id,
    nodeId: body.nodeId ?? null,
    role: "user",
    content: body.message,
  });

  const system = `${SYSTEM_BASE}

Proyecto actual:
- Tipo: ${project.type === "book" ? "libro" : "curso"}
- Título: ${project.title}
${project.description ? `- Descripción: ${project.description}` : ""}
${project.audience ? `- Audiencia: ${project.audience}` : ""}
${project.tone ? `- Tono: ${project.tone}` : ""}

Outline actual:
${outlineText}
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}${activeSection}`;

  const anthropic = getAnthropic();
  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [
      ...recentHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: body.message },
    ],
  });

  const encoder = new TextEncoder();
  let assistantText = "";
  const projectId = project.id;
  const nodeId = body.nodeId ?? null;
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `\n\n[error: ${err instanceof Error ? err.message : "stream"}]`
          )
        );
      } finally {
        if (assistantText.trim()) {
          await db.insert(aiMessages).values({
            id: nanoid(),
            projectId,
            nodeId,
            role: "assistant",
            content: assistantText.trim(),
          });
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function renderOutline(
  nodes: { id: string; parentId: string | null; title: string; kind: string; status: string; wordCount: number; position: number }[]
): string {
  const roots = nodes
    .filter((n) => !n.parentId)
    .sort((a, b) => a.position - b.position);
  const lines: string[] = [];
  for (const r of roots) {
    lines.push(`- [${r.kind}] ${r.title} (${r.status})`);
    const kids = nodes
      .filter((n) => n.parentId === r.id)
      .sort((a, b) => a.position - b.position);
    for (const k of kids) {
      lines.push(`  - [${k.kind}] ${k.title} (${k.status}, ${k.wordCount}p)`);
    }
  }
  return lines.join("\n") || "(sin outline aún)";
}
