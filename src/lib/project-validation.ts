import type { Project } from "@/lib/schema";

export type CoreField = {
  key: keyof Project;
  label: string;
  bookOnly?: boolean;
};

export const CORE_FIELDS: CoreField[] = [
  { key: "kindDetail", label: "Tipo de libro/curso" },
  { key: "audience", label: "Audiencia" },
  { key: "tone", label: "Tono" },
  { key: "perspective", label: "Persona narrativa" },
  { key: "format", label: "Formato de impresión", bookOnly: true },
  { key: "targetPages", label: "Páginas objetivo", bookOnly: true },
];

export function getMissingCoreSettings(project: Project): string[] {
  const missing: string[] = [];
  for (const f of CORE_FIELDS) {
    if (f.bookOnly && project.type !== "book") continue;
    const v = project[f.key];
    if (v == null) {
      missing.push(f.label);
      continue;
    }
    if (typeof v === "string" && v.trim().length === 0) {
      missing.push(f.label);
      continue;
    }
    if (typeof v === "number" && v <= 0) {
      missing.push(f.label);
    }
  }
  return missing;
}

export function isReadyForAIWriting(project: Project): boolean {
  return getMissingCoreSettings(project).length === 0;
}
