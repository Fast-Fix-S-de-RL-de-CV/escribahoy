import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { suggestions, projects } from "@/lib/schema";
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
    .from(suggestions)
    .where(eq(suggestions.projectId, projectId))
    .orderBy(desc(suggestions.createdAt));
  return NextResponse.json({ items: rows });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  const body = (await req.json()) as {
    id: string;
    status: "dismissed" | "applied";
  };
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  await db
    .update(suggestions)
    .set({
      status: body.status,
      appliedAt: body.status === "applied" ? new Date() : undefined,
    })
    .where(
      and(
        eq(suggestions.id, body.id),
        eq(suggestions.projectId, projectId)
      )
    );
  return NextResponse.json({ ok: true });
}
