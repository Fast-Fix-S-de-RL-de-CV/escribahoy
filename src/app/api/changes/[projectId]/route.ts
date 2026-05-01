import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeLog, projects } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const rows = await db
    .select()
    .from(changeLog)
    .where(eq(changeLog.projectId, projectId))
    .orderBy(desc(changeLog.createdAt))
    .limit(200);
  return NextResponse.json({ items: rows });
}
