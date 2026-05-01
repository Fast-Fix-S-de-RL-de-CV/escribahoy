export type BookFormat = {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
  widthMm: number;
  heightMm: number;
  widthCm: number;
  heightCm: number;
  description: string;
  fitsKinds: string[];
  // Páginas recomendadas para este formato.
  pageMin: number;
  pageSweetMin: number;
  pageSweetMax: number;
  pageMax: number;
  // Palabras aproximadas por página impresa (depende de tipografía/interlineado).
  wordsPerPage: number;
};

export const BOOK_FORMATS: BookFormat[] = [
  {
    id: "pocket",
    label: "Bolsillo",
    widthIn: 4.25,
    heightIn: 6.87,
    widthMm: 108,
    heightMm: 175,
    widthCm: 10.8,
    heightCm: 17.5,
    description: "Mass-market paperback. Económico, ideal para lectura casual.",
    fitsKinds: ["novela", "poesia", "cuentos"],
    pageMin: 120,
    pageSweetMin: 160,
    pageSweetMax: 280,
    pageMax: 320,
    wordsPerPage: 280,
  },
  {
    id: "trade-5x8",
    label: "Trade 5×8",
    widthIn: 5,
    heightIn: 8,
    widthMm: 127,
    heightMm: 203,
    widthCm: 12.7,
    heightCm: 20.3,
    description: "Tamaño clásico para novela y ensayo. Compacto y elegante.",
    fitsKinds: ["novela", "memoria", "ensayo", "no-ficcion", "cuentos", "poesia"],
    pageMin: 150,
    pageSweetMin: 200,
    pageSweetMax: 350,
    pageMax: 450,
    wordsPerPage: 300,
  },
  {
    id: "trade-5.25x8",
    label: "Trade 5.25×8",
    widthIn: 5.25,
    heightIn: 8,
    widthMm: 133,
    heightMm: 203,
    widthCm: 13.3,
    heightCm: 20.3,
    description: "Trade estándar — equilibrio entre legibilidad y portabilidad.",
    fitsKinds: ["novela", "memoria", "ensayo", "no-ficcion", "auto-ayuda"],
    pageMin: 160,
    pageSweetMin: 220,
    pageSweetMax: 380,
    pageMax: 480,
    wordsPerPage: 300,
  },
  {
    id: "trade-5.5x8.5",
    label: "Trade 5.5×8.5",
    widthIn: 5.5,
    heightIn: 8.5,
    widthMm: 140,
    heightMm: 216,
    widthCm: 14.0,
    heightCm: 21.6,
    description: "Tamaño popular para no-ficción y libros de negocios.",
    fitsKinds: ["auto-ayuda", "negocios", "no-ficcion", "memoria", "ensayo"],
    pageMin: 170,
    pageSweetMin: 240,
    pageSweetMax: 400,
    pageMax: 500,
    wordsPerPage: 320,
  },
  {
    id: "trade-6x9",
    label: "Trade 6×9",
    widthIn: 6,
    heightIn: 9,
    widthMm: 152,
    heightMm: 229,
    widthCm: 15.2,
    heightCm: 22.9,
    description: "El más vendido en Amazon KDP. Ideal para casi todo libro adulto.",
    fitsKinds: [
      "auto-ayuda",
      "negocios",
      "manual",
      "tecnico",
      "academico",
      "no-ficcion",
      "memoria",
      "ensayo",
    ],
    pageMin: 180,
    pageSweetMin: 250,
    pageSweetMax: 450,
    pageMax: 600,
    wordsPerPage: 350,
  },
  {
    id: "manual-7x10",
    label: "Manual 7×10",
    widthIn: 7,
    heightIn: 10,
    widthMm: 178,
    heightMm: 254,
    widthCm: 17.8,
    heightCm: 25.4,
    description: "Para manuales técnicos, libros con código, diagramas, ejercicios.",
    fitsKinds: ["tecnico", "manual", "academico"],
    pageMin: 150,
    pageSweetMin: 220,
    pageSweetMax: 500,
    pageMax: 800,
    wordsPerPage: 400,
  },
  {
    id: "letter-8.5x11",
    label: "Carta 8.5×11",
    widthIn: 8.5,
    heightIn: 11,
    widthMm: 216,
    heightMm: 279,
    widthCm: 21.6,
    heightCm: 27.9,
    description: "Tamaño carta. Para libros de texto, workbooks, fotografía.",
    fitsKinds: ["academico", "tecnico", "manual", "infantil"],
    pageMin: 60,
    pageSweetMin: 100,
    pageSweetMax: 300,
    pageMax: 500,
    wordsPerPage: 450,
  },
  {
    id: "square-8x8",
    label: "Cuadrado 8×8",
    widthIn: 8,
    heightIn: 8,
    widthMm: 203,
    heightMm: 203,
    widthCm: 20.3,
    heightCm: 20.3,
    description: "Para libros infantiles ilustrados y fotografía.",
    fitsKinds: ["infantil"],
    pageMin: 16,
    pageSweetMin: 24,
    pageSweetMax: 48,
    pageMax: 80,
    wordsPerPage: 80,
  },
];

export function defaultFormatFor(kindDetail: string | null | undefined): string {
  if (!kindDetail) return "trade-6x9";
  const match = BOOK_FORMATS.find((f) => f.fitsKinds.includes(kindDetail));
  return match?.id ?? "trade-6x9";
}

export function defaultPagesFor(formatId: string | null | undefined): number {
  const f = getFormat(formatId);
  if (!f) return 250;
  return Math.round((f.pageSweetMin + f.pageSweetMax) / 2);
}

export function getFormat(id: string | null | undefined): BookFormat | null {
  if (!id) return null;
  return BOOK_FORMATS.find((f) => f.id === id) ?? null;
}

export type PagesValidation =
  | { ok: true }
  | {
      ok: false;
      severity: "warning" | "error";
      message: string;
    };

export function validatePages(
  formatId: string | null | undefined,
  pages: number | null | undefined
): PagesValidation {
  const f = getFormat(formatId);
  if (!f || !pages || pages <= 0) return { ok: true };
  if (pages < f.pageMin) {
    return {
      ok: false,
      severity: "error",
      message: `${pages} páginas es muy poco para ${f.label}. Mínimo recomendado: ${f.pageMin}.`,
    };
  }
  if (pages > f.pageMax) {
    return {
      ok: false,
      severity: "error",
      message: `${pages} páginas es desproporcional para ${f.label}. Máximo recomendado: ${f.pageMax}. Considera un formato más grande.`,
    };
  }
  if (pages < f.pageSweetMin || pages > f.pageSweetMax) {
    return {
      ok: false,
      severity: "warning",
      message: `Funcional pero fuera del rango ideal (${f.pageSweetMin}-${f.pageSweetMax} páginas).`,
    };
  }
  return { ok: true };
}

export function estimatedTotalWords(
  formatId: string | null | undefined,
  pages: number | null | undefined
): number | null {
  const f = getFormat(formatId);
  if (!f || !pages) return null;
  return f.wordsPerPage * pages;
}
