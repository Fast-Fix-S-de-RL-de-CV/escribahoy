export const DECORATION_KINDS = [
  "pullquote",
  "callout",
  "epigraph",
  "definition",
  "exercise",
  "recap",
  "stat",
] as const;
export type DecorationKind = (typeof DECORATION_KINDS)[number];

export function renderDecorationHtml(
  kind: DecorationKind,
  parts: { text: string; attribution?: string; title?: string }
): string {
  const text = escapeHtml(parts.text);
  const attribution = parts.attribution ? escapeHtml(parts.attribution) : "";
  const title = parts.title ? escapeHtml(parts.title) : "";
  switch (kind) {
    case "pullquote":
      return `<aside class="book-deco book-pullquote" data-deco="pullquote"><span class="book-deco-label">Frase destacada</span><p>${text}</p>${attribution ? `<cite>— ${attribution}</cite>` : ""}</aside>`;
    case "epigraph":
      return `<aside class="book-deco book-epigraph" data-deco="epigraph"><p>${text}</p>${attribution ? `<cite>— ${attribution}</cite>` : ""}</aside>`;
    case "callout":
      return `<aside class="book-deco book-callout" data-deco="callout"><span class="book-deco-label">${title || "Tip"}</span><p>${text}</p></aside>`;
    case "definition":
      return `<aside class="book-deco book-definition" data-deco="definition"><span class="book-deco-label">${title || "Definición"}</span><p>${text}</p></aside>`;
    case "exercise":
      return `<aside class="book-deco book-exercise" data-deco="exercise"><span class="book-deco-label">${title || "Ejercicio"}</span><p>${text}</p></aside>`;
    case "recap":
      return `<aside class="book-deco book-recap" data-deco="recap"><span class="book-deco-label">${title || "Recap del capítulo"}</span><p>${text}</p></aside>`;
    case "stat":
      return `<aside class="book-deco book-stat" data-deco="stat"><strong>${text}</strong>${attribution ? `<cite>${attribution}</cite>` : ""}</aside>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
