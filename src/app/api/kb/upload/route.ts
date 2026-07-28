import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects, knowledgeFiles } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { ORDEN_PLANES, PLANES, planPorId } from "@/lib/plans";
import { esSuperAdmin, suscripcionDe } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const MB = 1024 * 1024;

const FORMATO_NUMERO = new Intl.NumberFormat("es-MX");

/**
 * Límites de la base de conocimiento del plan (archivos y megas).
 *
 * ⚠️ NO son cuota mensual: son un tope ACUMULADO sobre lo que hay guardado
 * ahora mismo, así que NO se usa `consumirCuota` (que incrementa un contador
 * por periodo y nunca baja). Se cuenta el estado real y se compara: borrar un
 * archivo libera espacio de inmediato, que es lo que el usuario espera.
 *
 * Se cuenta por USUARIO (a través de todos sus proyectos), no por proyecto:
 * el plan promete "N archivos en tu base de conocimiento", y contarlo por
 * proyecto dejaría que un plan de 3 proyectos subiera 3 veces el tope.
 */
async function limitesKb(
  userId: string,
  nuevoTamanoBytes: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  // El super admin nunca se bloquea (misma regla que en las cuotas de IA), y
  // se sale antes de contar para no pagar la consulta.
  if (await esSuperAdmin(userId)) return { ok: true };

  const suscripcion = await suscripcionDe(userId);
  const plan = planPorId(suscripcion.plan);
  const maxArchivos = plan.cuotas.archivosKb;
  const maxBytes = plan.cuotas.kbMegas * MB;

  const rows = await db
    .select({
      archivos: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(${knowledgeFiles.sizeBytes}), 0)`,
    })
    .from(knowledgeFiles)
    .innerJoin(projects, eq(knowledgeFiles.projectId, projects.id))
    .where(eq(projects.userId, userId));
  const archivos = Number(rows[0]?.archivos ?? 0);
  const bytes = Number(rows[0]?.bytes ?? 0);

  const etiquetaPlan = plan.id === "gratis" ? "gratis" : plan.nombre;
  const arriba = ORDEN_PLANES.slice(ORDEN_PLANES.indexOf(plan.id) + 1)
    .map((id) => PLANES[id])
    .find(
      (p) =>
        p.cuotas.archivosKb > maxArchivos || p.cuotas.kbMegas > plan.cuotas.kbMegas
    );

  if (archivos + 1 > maxArchivos) {
    const base = `Tu plan ${etiquetaPlan} incluye ${FORMATO_NUMERO.format(
      maxArchivos
    )} ${maxArchivos === 1 ? "archivo" : "archivos"} en la base de conocimiento y ya ${
      archivos === 1 ? "tienes 1" : `tienes ${FORMATO_NUMERO.format(archivos)}`
    }. Borra alguno para subir este`;
    return {
      ok: false,
      mensaje: arriba
        ? `${base}, o sube al plan ${arriba.nombre} y lleva ${FORMATO_NUMERO.format(
            arriba.cuotas.archivosKb
          )}.`
        : `${base}.`,
    };
  }

  if (bytes + nuevoTamanoBytes > maxBytes) {
    const usadosMb = Math.round((bytes / MB) * 10) / 10;
    const base = `Tu plan ${etiquetaPlan} incluye ${FORMATO_NUMERO.format(
      plan.cuotas.kbMegas
    )} MB de base de conocimiento y llevas ${FORMATO_NUMERO.format(
      usadosMb
    )} MB. Este archivo pesa ${FORMATO_NUMERO.format(
      Math.round((nuevoTamanoBytes / MB) * 10) / 10
    )} MB y ya no cabe. Borra algo para hacerle lugar`;
    return {
      ok: false,
      mensaje: arriba
        ? `${base}, o sube al plan ${arriba.nombre} y lleva ${FORMATO_NUMERO.format(
            arriba.cuotas.kbMegas
          )} MB.`
        : `${base}.`,
    };
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const projectId = form.get("projectId") as string | null;
  const file = form.get("file") as File | null;

  if (!projectId || !file) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "archivo demasiado grande" }, { status: 413 });
  }

  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  // Límites del plan ANTES de leer y parsear el archivo: si no cabe, no tiene
  // sentido gastar CPU y memoria extrayendo un PDF que no se va a guardar.
  const limite = await limitesKb(user.id, file.size);
  if (!limite.ok) {
    // 402 Payment Required: el usuario está autorizado, lo que se llenó es el
    // cupo de su plan.
    return NextResponse.json(
      { error: limite.mensaje, upgrade: true },
      { status: 402 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let extracted = "";

  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      type PdfParseFn = (b: Buffer) => Promise<{ text: string }>;
      // @ts-expect-error - subpath import has no type declarations
      const pdfMod: unknown = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse: PdfParseFn =
        typeof pdfMod === "function"
          ? (pdfMod as PdfParseFn)
          : ((pdfMod as { default: PdfParseFn }).default);
      const result = await pdfParse(buf);
      extracted = result.text;
    } else if (file.type.startsWith("text/") || /\.(md|txt|markdown)$/i.test(file.name)) {
      extracted = buf.toString("utf-8");
    } else {
      extracted = buf.toString("utf-8").slice(0, 200000);
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: `no pudimos leer el archivo: ${
          err instanceof Error ? err.message : "error"
        }`,
      },
      { status: 422 }
    );
  }

  extracted = extracted
    .replace(/\u0000/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\x20]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!extracted) {
    return NextResponse.json(
      { error: "no se pudo extraer texto del archivo" },
      { status: 422 }
    );
  }

  const id = nanoid();
  await db.insert(knowledgeFiles).values({
    id,
    projectId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    extractedText: extracted.slice(0, 800000),
    summary: extracted.slice(0, 500),
  });

  return NextResponse.json({
    id,
    name: file.name,
    sizeBytes: file.size,
    chars: extracted.length,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, projectId } = (await req.json()) as {
    id: string;
    projectId: string;
  };
  const owns = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  if (!owns.length)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  await db
    .delete(knowledgeFiles)
    .where(
      and(eq(knowledgeFiles.id, id), eq(knowledgeFiles.projectId, projectId))
    );
  return NextResponse.json({ ok: true });
}
