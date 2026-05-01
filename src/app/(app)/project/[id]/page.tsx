import { notFound, redirect } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  outlineNodes,
  knowledgeFiles,
  aiMessages,
  suggestions,
} from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { ProjectWorkspace } from "./workspace";

export default async function ProjectPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ node?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await props.params;
  const { node: nodeParam } = await props.searchParams;

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);
  if (!rows.length) notFound();
  const project = rows[0];

  const nodes = await db
    .select()
    .from(outlineNodes)
    .where(eq(outlineNodes.projectId, id))
    .orderBy(asc(outlineNodes.position));

  const kb = await db
    .select()
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.projectId, id));

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.projectId, id))
    .orderBy(asc(aiMessages.createdAt));

  const suggestionRows = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.projectId, id))
    .orderBy(asc(suggestions.createdAt));

  const initialNodeId =
    nodeParam ?? nodes.find((n) => n.kind === "section" || n.kind === "lesson")?.id ?? null;

  return (
    <ProjectWorkspace
      user={user}
      project={project}
      nodes={nodes}
      kb={kb.map((k) => ({
        id: k.id,
        name: k.name,
        sizeBytes: k.sizeBytes,
        chars: k.extractedText.length,
      }))}
      messages={messages}
      suggestions={suggestionRows}
      initialNodeId={initialNodeId}
    />
  );
}
