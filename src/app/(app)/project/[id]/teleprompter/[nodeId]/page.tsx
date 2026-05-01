import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, outlineNodes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { TeleprompterView } from "./view";

export default async function TeleprompterPage(props: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, nodeId } = await props.params;

  const proj = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);
  if (!proj.length) notFound();

  const node = await db
    .select()
    .from(outlineNodes)
    .where(and(eq(outlineNodes.id, nodeId), eq(outlineNodes.projectId, id)))
    .limit(1);
  if (!node.length) notFound();

  return (
    <TeleprompterView
      projectId={id}
      title={node[0].title}
      script={node[0].scriptContent || ""}
    />
  );
}
