import type { Project } from "@/lib/schema";

export type CoreField = {
  key: keyof Project;
  label: string;
};

export const CORE_FIELDS: CoreField[] = [
  { key: "kindDetail", label: "Tipo de libro/curso" },
  { key: "audience", label: "Audiencia" },
  { key: "tone", label: "Tono" },
  { key: "perspective", label: "Persona narrativa" },
];

export function getMissingCoreSettings(project: Project): string[] {
  const missing: string[] = [];
  for (const f of CORE_FIELDS) {
    const v = project[f.key];
    if (v == null || (typeof v === "string" && v.trim().length === 0)) {
      missing.push(f.label);
    }
  }
  return missing;
}

export function isReadyForAIWriting(project: Project): boolean {
  return getMissingCoreSettings(project).length === 0;
}
