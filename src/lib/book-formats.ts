export type BookFormat = {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
  widthMm: number;
  heightMm: number;
  description: string;
  fitsKinds: string[];
};

export const BOOK_FORMATS: BookFormat[] = [
  {
    id: "pocket",
    label: "Bolsillo",
    widthIn: 4.25,
    heightIn: 6.87,
    widthMm: 108,
    heightMm: 175,
    description: "Mass-market paperback. Económico, ideal para lectura casual.",
    fitsKinds: ["novela", "poesia", "cuentos"],
  },
  {
    id: "trade-5x8",
    label: "Trade 5×8",
    widthIn: 5,
    heightIn: 8,
    widthMm: 127,
    heightMm: 203,
    description: "Tamaño clásico para novela y ensayo. Compacto y elegante.",
    fitsKinds: ["novela", "memoria", "ensayo", "no-ficcion", "cuentos", "poesia"],
  },
  {
    id: "trade-5.25x8",
    label: "Trade 5.25×8",
    widthIn: 5.25,
    heightIn: 8,
    widthMm: 133,
    heightMm: 203,
    description: "Trade estándar — equilibrio entre legibilidad y portabilidad.",
    fitsKinds: ["novela", "memoria", "ensayo", "no-ficcion", "auto-ayuda"],
  },
  {
    id: "trade-5.5x8.5",
    label: "Trade 5.5×8.5",
    widthIn: 5.5,
    heightIn: 8.5,
    widthMm: 140,
    heightMm: 216,
    description: "Tamaño popular para no-ficción y libros de negocios.",
    fitsKinds: ["auto-ayuda", "negocios", "no-ficcion", "memoria", "ensayo"],
  },
  {
    id: "trade-6x9",
    label: "Trade 6×9",
    widthIn: 6,
    heightIn: 9,
    widthMm: 152,
    heightMm: 229,
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
  },
  {
    id: "manual-7x10",
    label: "Manual 7×10",
    widthIn: 7,
    heightIn: 10,
    widthMm: 178,
    heightMm: 254,
    description: "Para manuales técnicos, libros con código, diagramas, ejercicios.",
    fitsKinds: ["tecnico", "manual", "academico"],
  },
  {
    id: "letter-8.5x11",
    label: "Carta 8.5×11",
    widthIn: 8.5,
    heightIn: 11,
    widthMm: 216,
    heightMm: 279,
    description: "Tamaño carta. Para libros de texto, workbooks, fotografía.",
    fitsKinds: ["academico", "tecnico", "manual", "infantil"],
  },
  {
    id: "square-8x8",
    label: "Cuadrado 8×8",
    widthIn: 8,
    heightIn: 8,
    widthMm: 203,
    heightMm: 203,
    description: "Para libros infantiles ilustrados y fotografía.",
    fitsKinds: ["infantil"],
  },
];

export function defaultFormatFor(kindDetail: string | null | undefined): string {
  if (!kindDetail) return "trade-6x9";
  const match = BOOK_FORMATS.find((f) => f.fitsKinds.includes(kindDetail));
  return match?.id ?? "trade-6x9";
}

export function getFormat(id: string | null | undefined): BookFormat | null {
  if (!id) return null;
  return BOOK_FORMATS.find((f) => f.id === id) ?? null;
}
