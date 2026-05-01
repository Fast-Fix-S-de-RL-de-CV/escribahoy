import type { OutlineNode } from "@/lib/schema";

/**
 * Calcula la numeración jerárquica de cada nodo del outline.
 * - frontmatter / backmatter: NO se numeran (devuelven null)
 * - chapter / module: 1, 2, 3...
 * - section / lesson: 1.1, 1.2, 2.1...
 * Retorna un map { nodeId -> "1" | "1.1" | null }.
 */
export function computeNumbering(
  nodes: OutlineNode[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  // Front matter: sin numeración.
  for (const n of nodes) {
    if (n.kind === "frontmatter" || n.kind === "backmatter") {
      result[n.id] = null;
    }
  }

  // Capítulos / módulos numerados a nivel raíz, ordenados por position.
  const roots = nodes
    .filter((n) => !n.parentId && (n.kind === "chapter" || n.kind === "module"))
    .sort((a, b) => a.position - b.position);

  roots.forEach((parent, i) => {
    const chapterNum = i + 1;
    result[parent.id] = String(chapterNum);
    const kids = nodes
      .filter((n) => n.parentId === parent.id)
      .sort((a, b) => a.position - b.position);
    kids.forEach((kid, j) => {
      result[kid.id] = `${chapterNum}.${j + 1}`;
    });
  });

  return result;
}
