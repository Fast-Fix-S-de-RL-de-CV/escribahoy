/**
 * FUENTE ÚNICA DE VERDAD del modelo de negocio de EscribaHoy.
 *
 * Para cambiar precios: edita `precioMensual`/`precioAnual` aquí Y crea los
 * precios nuevos en Stripe (los precios de Stripe son inmutables; se archivan
 * y se crean otros). Los IDs viven en variables de entorno, nunca en el repo.
 *
 * ── POR QUÉ ESTOS PRECIOS ────────────────────────────────────────────────
 * El ancla de precio de este nicho NO es el software de $20 USD: es el
 * ghostwriter (15,000–45,000 MXN en México) y la mentoría de libro
 * (1,500–30,000 USD). Ningún competidor tiene interfaz en español ni cobra en
 * MXN, y ninguno tiene modo curso con teleprompter.
 *
 * ⚠️ PRECIOS CON IVA INCLUIDO. El Art. 7 Bis de la Ley Federal de Protección
 * al Consumidor obliga a exhibir el monto TOTAL a pagar con impuestos. Nunca
 * publicar "249 + IVA". El ingreso ANTES de IVA es el 86.2% del precio de
 * lista (249 → 214.66 neto), y así hay que modelarlo en finanzas.
 *
 * ── POR QUÉ LOS LÍMITES SON DUROS ────────────────────────────────────────
 * Cada acción de IA cuesta tokens reales. Medido en este proyecto con la API
 * de conteo de Anthropic sobre el contexto real de producción:
 *   · 1 mensaje de chat  = 21,552 tokens de entrada
 *   · 1 temario completo = 15,430 tokens de entrada + hasta 6,000 de salida
 * Sin cuotas, un solo usuario intensivo cuesta más que su mensualidad. Nunca
 * vender "ilimitado" ni "de por vida": es el error documentado que llevó a
 * Replit de 36% a −14% de margen bruto en dos meses, y el que obligó a
 * ChatPlayground AI a revocar sus licencias vitalicias.
 */

export type PlanId = "gratis" | "borrador" | "autor" | "autoridad";
export type Ciclo = "mes" | "anual";

/** Acciones de IA con cuota. El nombre es el que ve el usuario, no "tokens". */
export type AccionIA =
  | "temario"
  | "redistribuir"
  | "sugerencia"
  | "chat"
  | "dictado"
  | "guion"
  | "decoracion";

export type Cuotas = Record<AccionIA, number> & {
  /** Proyectos activos simultáneos. */
  proyectos: number;
  /** Archivos en la base de conocimiento. */
  archivosKb: number;
  /** Tamaño total de la base de conocimiento, en MB. */
  kbMegas: number;
};

export type Plan = {
  id: PlanId;
  nombre: string;
  /** Una línea: a quién le sirve. */
  paraQuien: string;
  /** Precio de lista CON IVA incluido, en pesos. 0 = gratis. */
  precioMensual: number;
  precioAnual: number;
  /** Bullets de la página de precios. */
  incluye: string[];
  /** Lo que este plan NO trae (evita malentendidos y reclamos). */
  noIncluye: string[];
  cuotas: Cuotas;
  /** Modo curso + guion de teleprompter. */
  modoCurso: boolean;
  destacado?: boolean;
};

/** IVA mexicano vigente. Los precios de lista ya lo incluyen. */
export const IVA = 0.16;

/** Ingreso antes de IVA de un precio de lista. */
export function netoSinIva(precioConIva: number): number {
  return precioConIva / (1 + IVA);
}

export const PLANES: Record<PlanId, Plan> = {
  gratis: {
    id: "gratis",
    nombre: "Tu temario, gratis",
    paraQuien:
      "Para que veas tu libro tomando forma antes de pagar nada. Sin tarjeta y sin fecha de caducidad.",
    precioMensual: 0,
    precioAnual: 0,
    incluye: [
      "1 temario completo generado con IA: capítulos, secciones, glosario y páginas de cortesía",
      "5 secciones con sugerencias de qué escribir",
      "2,000 palabras de dictado por voz, limpiadas y con puntuación",
      "3 archivos en tu base de conocimiento",
      "15 mensajes con la asistente",
      "Exportación a PDF de lo que escribas",
    ],
    noIncluye: [
      "Sin caducidad: no es una prueba de 7 días, es tuyo",
      "No pedimos tarjeta",
    ],
    cuotas: {
      proyectos: 1,
      temario: 1,
      redistribuir: 1,
      sugerencia: 5,
      chat: 15,
      dictado: 2_000,
      guion: 0,
      decoracion: 0,
      archivosKb: 3,
      kbMegas: 15,
    },
    modoCurso: false,
  },

  borrador: {
    id: "borrador",
    nombre: "Borrador",
    paraQuien:
      "Llevas años diciendo que vas a escribir tu libro. Este plan existe para que lo termines.",
    precioMensual: 249,
    precioAnual: 2_490,
    incluye: [
      "Un libro, de principio a fin",
      "Temario completo con IA: capítulos, secciones, glosario y páginas de cortesía",
      "Sugerencias de qué escribir en cada sección",
      "Dictado por voz: hablas y la IA limpia y puntúa (≈3 horas al mes)",
      "Base de conocimiento: sube tus PDFs, apuntes y notas",
      "La asistente ubica cada idea suelta en el capítulo que le toca",
      "Exportación a PDF y DOCX, ilimitada y tuya para siempre",
    ],
    noIncluye: ["Sin modo curso ni teleprompter", "Un solo libro a la vez"],
    cuotas: {
      proyectos: 1,
      temario: 2,
      redistribuir: 3,
      sugerencia: 25,
      chat: 60,
      dictado: 25_000,
      guion: 0,
      decoracion: 3,
      archivosKb: 10,
      kbMegas: 40,
    },
    modoCurso: false,
  },

  autor: {
    id: "autor",
    nombre: "Autor",
    paraQuien:
      "Ya decidiste. Quieres el libro terminado este año y usarlo para tu marca, tus conferencias y tus clientes.",
    precioMensual: 499,
    precioAnual: 4_990,
    incluye: [
      "Todo lo de Borrador",
      "3 proyectos en paralelo (el libro, el segundo, y el que se te ocurrió en la regadera)",
      "Revisión mensual de estructura: la IA audita si tu temario aguanta el libro",
      "Dictado por voz ≈11 horas al mes",
      "Exportación a EPUB además de PDF y DOCX",
      "Portadas y decoraciones generadas con IA",
      "Soporte por WhatsApp, en español, con una persona",
    ],
    noIncluye: ["Sin modo curso ni teleprompter (eso es Autoridad)"],
    cuotas: {
      proyectos: 3,
      temario: 6,
      redistribuir: 10,
      sugerencia: 120,
      chat: 250,
      dictado: 90_000,
      guion: 0,
      decoracion: 20,
      archivosKb: 60,
      kbMegas: 300,
    },
    modoCurso: false,
    destacado: true,
  },

  autoridad: {
    id: "autoridad",
    nombre: "Autoridad",
    paraQuien:
      "Tu libro es el principio: quieres convertirlo en curso y grabarlo leyendo un guion que ya está escrito.",
    precioMensual: 999,
    precioAnual: 9_990,
    incluye: [
      "Todo lo de Autor",
      "MODO CURSO completo: módulos, lecciones y GUION DE TELEPROMPTER por lección",
      "Convierte un libro terminado en curso (y al revés) sin volver a empezar",
      "6 proyectos entre libros y cursos",
      "Dictado por voz ≈30 horas al mes",
      "Tu marca en las exportaciones (logo, colores, tu editorial)",
    ],
    noIncluye: [
      "Una sesión de dictado a la vez (para que no se comparta la cuenta)",
    ],
    cuotas: {
      proyectos: 6,
      temario: 12,
      redistribuir: 25,
      sugerencia: 400,
      chat: 700,
      dictado: 250_000,
      guion: 80,
      decoracion: 60,
      archivosKb: 200,
      kbMegas: 1_000,
    },
    modoCurso: true,
  },
};

export const ORDEN_PLANES: PlanId[] = [
  "gratis",
  "borrador",
  "autor",
  "autoridad",
];

/** Planes que se pueden comprar (excluye el gratuito). */
export const PLANES_PAGADOS: PlanId[] = ["borrador", "autor", "autoridad"];

/**
 * Etiquetas humanas de cada acción con cuota. Se usan en los mensajes de
 * "llegaste a tu límite" y en el panel. Nunca decimos "tokens" ni "créditos":
 * el usuario entiende temarios, secciones y palabras dictadas.
 */
export const ETIQUETA_ACCION: Record<AccionIA, string> = {
  temario: "temarios completos",
  redistribuir: "redistribuciones de capítulo",
  sugerencia: "secciones con sugerencias",
  chat: "mensajes con la asistente",
  dictado: "palabras de dictado",
  guion: "guiones de teleprompter",
  decoracion: "portadas y decoraciones",
};

export function planPorId(id: string | null | undefined): Plan {
  if (id && id in PLANES) return PLANES[id as PlanId];
  return PLANES.gratis;
}

/** Cuota de una acción en un plan. */
export function cuotaDe(plan: Plan, accion: AccionIA): number {
  return plan.cuotas[accion];
}

/**
 * Precio mensual equivalente del plan anual (para el clásico "equivale a
 * $416 al mes"). Redondeado a peso porque es texto de mercadotecnia.
 */
export function mensualEquivalente(plan: Plan): number {
  return Math.round(plan.precioAnual / 12);
}

/** Ahorro del anual frente a 12 mensualidades, en pesos y en porcentaje. */
export function ahorroAnual(plan: Plan): { pesos: number; pct: number } {
  const doceMeses = plan.precioMensual * 12;
  const pesos = doceMeses - plan.precioAnual;
  return { pesos, pct: doceMeses > 0 ? Math.round((pesos / doceMeses) * 100) : 0 };
}

/**
 * ID del precio de Stripe para un plan y ciclo. Vive en el entorno porque el
 * repo es público. Devuelve null si no está configurado (permite que la app
 * arranque sin Stripe en desarrollo).
 */
export function stripePriceId(plan: PlanId, ciclo: Ciclo): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${
    ciclo === "mes" ? "MES" : "ANUAL"
  }`;
  return process.env[key]?.trim() || null;
}

/** Plan al que corresponde un price ID de Stripe (para el webhook). */
export function planDesdePriceId(
  priceId: string
): { plan: PlanId; ciclo: Ciclo } | null {
  for (const plan of PLANES_PAGADOS) {
    for (const ciclo of ["mes", "anual"] as Ciclo[]) {
      if (stripePriceId(plan, ciclo) === priceId) return { plan, ciclo };
    }
  }
  return null;
}
