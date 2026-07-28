/**
 * GET /api/admin/metricas — las cinco cifras que deciden si el negocio funciona.
 *
 * Este archivo es a la vez el ENDPOINT (para que el dueño lo consulte desde el
 * celular o un script) y el MOTOR de cálculo que consume el panel
 * `/admin`. Vive junto porque tener dos implementaciones del mismo número es la
 * forma más rápida de que el panel y la API se contradigan y ninguno sea
 * creíble.
 *
 * ── POR QUÉ P50 Y P90 Y NUNCA EL PROMEDIO ──────────────────────────────────
 * El costo de IA por usuario NO se distribuye normal: es de cola larga. La
 * inmensa mayoría escribe un rato y gasta centavos; unos pocos exprimen la
 * cuota completa. En productos de IA el usuario del percentil 90 cuesta entre
 * 10 y 40 veces lo que el mediano, así que el PROMEDIO no describe a nadie: lo
 * inflan los pocos caros y hace ver sano un plan que pierde dinero justo con
 * los usuarios que más lo usan. La pregunta correcta no es "¿cuánto me cuesta
 * el usuario promedio?" sino "¿aguanto al usuario del percentil 90?".
 *
 * ── SQLITE NO TIENE percentile() ───────────────────────────────────────────
 * No hay función de percentil ni extensión cargada, así que se calcula con
 * RANGO MÁS CERCANO (nearest-rank), que es el método clásico y no interpola:
 *   1. Se ordenan los usuarios del grupo por costo ascendente y se numeran con
 *      ROW_NUMBER() OVER (PARTITION BY grupo ORDER BY costo, user_id).
 *   2. COUNT(*) OVER (PARTITION BY grupo) da n en cada fila.
 *   3. El índice del percentil p es ceil(p·n/100), que aquí se escribe como la
 *      división ENTERA `(n*p + 99)/100` — SQLite divide enteros truncando, y
 *      sumar 99 antes de dividir entre 100 es exactamente el techo. Se evita
 *      ceil() a propósito: las funciones matemáticas de SQLite son opcionales
 *      en tiempo de compilación y no se puede dar por hecho que estén.
 *   4. Se extrae la fila de ese índice con MAX(CASE WHEN rn = idx THEN v END),
 *      que sobre un solo renglón coincidente devuelve ese renglón.
 * El desempate por user_id hace el resultado determinista entre consultas.
 *
 * Con n=1 el "percentil 90" es simplemente el único usuario, y con n=4 es el
 * cuarto: un número real pero que no describe una cola. Por eso se devuelve
 * `usuarios` junto a cada percentil y las banderas `p50Confiable`/`p90Confiable`
 * — el panel muestra "aún no hay datos suficientes" en vez de un cero o una
 * cifra que invite a decidir con aire.
 */

import { NextResponse } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { esSuperAdmin } from "@/lib/subscription";
import { periodoActual } from "@/lib/quotas";
import {
  ORDEN_PLANES,
  PLANES,
  PLANES_PAGADOS,
  netoSinIva,
  planPorId,
  type Ciclo,
  type PlanId,
} from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TIPO DE CAMBIO. Anthropic cobra en dólares y los planes se cobran en pesos,
 * así que todo margen es una resta entre dos monedas y necesita una tasa.
 *
 * 18 MXN/USD es un valor CONSERVADOR fijado a mano (el peso ha rondado 17–18.5
 * en el último año): sobreestimar el costo de la IA es el error barato, porque
 * lleva a decidir con menos margen del real. Es un supuesto, no un dato de
 * mercado: no se conecta a una API de tipo de cambio a propósito — un panel de
 * finanzas que cambia de números solo, sin que nadie haya tocado nada, no se
 * puede auditar. Para actualizarlo se edita AQUÍ, que es el único lugar donde
 * vive, y el panel lo muestra siempre junto a las cifras que lo usan.
 */
export const TIPO_CAMBIO_MXN_POR_USD = 18;

/**
 * Comisión efectiva de Stripe en México. La tarifa de lista es 3.6% + $3 MXN
 * por cargo, más IVA sobre la comisión; sobre un cargo típico de este producto
 * (249–999 MXN) eso da alrededor de 5.7%. Es una estimación redondeada hacia
 * arriba, no la comisión exacta de cada cargo.
 */
export const COMISION_STRIPE = 0.057;

/** Debajo de esto una "mediana" es anécdota, no estadística. */
export const MIN_USUARIOS_P50 = 3;
/** Debajo de esto el "percentil 90" es solo el usuario más caro del grupo. */
export const MIN_USUARIOS_P90 = 10;

/** Cuántas llamadas de IA recientes se listan para depurar fugas. */
const ULTIMAS_LLAMADAS = 50;
/** Cuántos usuarios caros se listan. */
const TOP_USUARIOS = 20;
/** Umbral de alarma: costo de IA como fracción de lo que paga el usuario. */
export const UMBRAL_ALARMA = 0.5;

/* ────────────────────────────── TIPOS ────────────────────────────────────── */

export type IngresoMensual = { brutoMxn: number; netoMxn: number };

export type MargenGrupo = {
  /** PlanId, o "todos" para el agregado de los planes de pago. */
  grupo: PlanId | "todos";
  etiqueta: string;
  usuarios: number;
  ingresoNetoMxn: number;
  costoIaMxn: number;
  margenMxn: number;
  costoP50Mxn: number | null;
  margenP50Mxn: number | null;
  costoP90Mxn: number | null;
  margenP90Mxn: number | null;
  p50Confiable: boolean;
  p90Confiable: boolean;
};

export type UsuarioCaro = {
  email: string;
  plan: PlanId;
  ciclo: Ciclo | null;
  llamadas: number;
  costoUsd: number;
  costoMxn: number;
  /** Lo que paga al mes (precio de lista con IVA, anual prorrateado). */
  pagoMensualMxn: number;
  /** Costo de IA como % de lo que paga. null en el plan gratis (no paga). */
  pctDelPago: number | null;
  /** Cuenta de la casa (super admin): su gasto es costo interno, no fuga. */
  esCasa: boolean;
  alarma: boolean;
};

export type Mrr = {
  suscriptores: number;
  brutoMxn: number;
  netoMxn: number;
  netoUsd: number;
  /** % del ingreso mensual que entra por suscripciones anuales. */
  pctAnual: number | null;
  porPlan: Array<{
    plan: PlanId;
    etiqueta: string;
    mensuales: number;
    anuales: number;
    brutoMxn: number;
    netoMxn: number;
  }>;
};

export type Activacion = {
  registrados: number;
  conTemario: number;
  activados: number;
  pctConTemario: number | null;
  pctActivados: number | null;
};

export type Produccion = {
  proyectos: number;
  terminados: number;
  enProgreso: number;
  sinEmpezar: number;
  archivados: number;
  libros: number;
  cursos: number;
  palabras: number;
};

export type SuscripcionActiva = {
  email: string;
  plan: PlanId;
  ciclo: Ciclo | null;
  estado: string;
  periodoFin: string | null;
  cancelaAlFin: boolean;
};

export type LlamadaIA = {
  fecha: string;
  email: string;
  accion: string;
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costoUsd: number;
  costoMxn: number;
};

export type Metricas = {
  periodo: string;
  generadoEn: string;
  tipoCambio: number;
  comisionStripe: number;
  totales: {
    usuarios: number;
    llamadasIa: number;
    costoIaUsd: number;
    costoIaMxn: number;
  };
  margen: MargenGrupo[];
  topUsuarios: UsuarioCaro[];
  mrr: Mrr;
  activacion: Activacion;
  produccion: Produccion;
  suscripciones: SuscripcionActiva[];
  ultimasLlamadas: LlamadaIA[];
};

/* ───────────────────────────── PRECIOS ───────────────────────────────────── */

/**
 * Ingreso MENSUAL de un plan+ciclo. El anual se prorratea entre 12 porque el
 * costo de IA con el que se compara es de un mes: mezclar un cobro anual
 * completo con un mes de costo haría ver todos los anuales como rentabilísimos.
 *
 * `netoMxn` quita las dos cosas que nunca fueron ingreso:
 *   · el IVA (16%), que es del SAT y solo pasa por la cuenta, y
 *   · la comisión de Stripe, que se calcula sobre el TOTAL cobrado (con IVA),
 *     porque es sobre ese monto que la cobra la pasarela.
 */
export function ingresoMensualDe(plan: PlanId, ciclo: Ciclo): IngresoMensual {
  const p = PLANES[plan];
  const brutoMxn = ciclo === "anual" ? p.precioAnual / 12 : p.precioMensual;
  const netoMxn = netoSinIva(brutoMxn) - brutoMxn * COMISION_STRIPE;
  return { brutoMxn, netoMxn };
}

/** Ciclos válidos, para iterar sin repetir el literal por todos lados. */
const CICLOS: Ciclo[] = ["mes", "anual"];

/* ─────────────────────── FRAGMENTOS SQL COMPARTIDOS ──────────────────────── */

/**
 * Suscripción vigente del usuario: la ÚLTIMA que tocó Stripe. Es el mismo
 * criterio que `suscripcionDe()` en src/lib/subscription.ts (orden por
 * updated_at desc, limit 1), para que el panel no muestre un plan distinto al
 * que el usuario tiene de verdad.
 */
const JOIN_SUB_VIGENTE: SQL = sql`
  LEFT JOIN subscriptions s ON s.id = (
    SELECT s2.id FROM subscriptions s2
    WHERE s2.user_id = u.id
    ORDER BY s2.updated_at DESC
    LIMIT 1
  )`;

/**
 * Plan EFECTIVO (el que da acceso), replicando `daAcceso()` de
 * src/lib/subscription.ts: active y trialing dan acceso; past_due lo da solo
 * mientras el periodo pagado siga vigente; cualquier otro estado cae a gratis.
 * Se compara con lower(trim(...)) porque el estado viene tal cual de Stripe.
 */
function planEfectivo(ahoraSeg: number): SQL {
  return sql`CASE
    WHEN s.plan IS NULL THEN 'gratis'
    WHEN lower(trim(coalesce(s.estado,''))) IN ('active','trialing') THEN s.plan
    WHEN lower(trim(coalesce(s.estado,''))) = 'past_due'
         AND s.periodo_fin IS NOT NULL
         AND s.periodo_fin > ${ahoraSeg} THEN s.plan
    ELSE 'gratis'
  END`;
}

/**
 * Inicio del periodo de cuota en segundos epoch. El periodo es el mes
 * calendario MEXICANO (ver periodoActual() en quotas.ts), no el mes UTC: si el
 * panel cortara en UTC, el día 1 mostraría como "de este mes" el gasto de las
 * últimas horas del mes pasado y el margen del primer día saldría mal.
 */
function inicioDePeriodoSeg(periodo: string): number {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
    // Periodo ilegible: se cae a "últimos 30 días" en vez de traer todo el
    // historial y hacer ver el costo del mes 10 veces más grande.
    return Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
  }
  const tentativo = Date.UTC(anio, mes - 1, 1, 0, 0, 0);
  // Desfase real de la zona en esa fecha (México ya no cambia de horario, pero
  // no se codifica -6 a mano: se le pregunta a Intl).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const partes = fmt.formatToParts(new Date(tentativo));
  const val = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const comoUtc = Date.UTC(
    val("year"),
    val("month") - 1,
    val("day"),
    val("hour") % 24,
    val("minute"),
    val("second")
  );
  const desfaseMs = comoUtc - tentativo;
  return Math.floor((tentativo - desfaseMs) / 1000);
}

/* ─────────────────────────── CÁLCULO ─────────────────────────────────────── */

type FilaMargen = {
  grupo: string;
  usuarios: number;
  ingreso_total: number | null;
  costo_total: number | null;
  costo_p50: number | null;
  margen_p50: number | null;
  costo_p90: number | null;
  margen_p90: number | null;
};

type FilaTop = {
  id: string;
  email: string;
  plan: string;
  ciclo: string | null;
  llamadas: number;
  costo_usd: number;
};

type FilaMrr = { plan: string; ciclo: string | null; usuarios: number };

type FilaActivacion = {
  registrados: number;
  con_temario: number;
  activados: number;
};

type FilaProduccion = {
  proyectos: number;
  terminados: number;
  en_progreso: number;
  sin_empezar: number;
  archivados: number;
  libros: number;
  cursos: number;
  palabras: number | null;
};

type FilaSuscripcion = {
  email: string;
  plan: string;
  ciclo: string | null;
  estado: string;
  periodo_fin: number | null;
  cancela_al_fin: number;
};

type FilaLlamada = {
  created_at: number;
  email: string;
  accion: string;
  modelo: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  costo_usd: number;
};

type FilaTotales = {
  usuarios: number;
  llamadas: number;
  costo_usd: number | null;
};

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function cicloValido(v: string | null): Ciclo | null {
  return v === "mes" || v === "anual" ? v : null;
}

function isoDeSegundos(seg: number | null): string | null {
  if (seg === null || !Number.isFinite(seg)) return null;
  return new Date(seg * 1000).toISOString();
}

/**
 * Todas las métricas del panel. Es la ÚNICA función que hace SQL de negocio:
 * el panel y el endpoint la comparten, así que no pueden divergir.
 */
export async function calcularMetricas(): Promise<Metricas> {
  const periodo = periodoActual();
  const desdeSeg = inicioDePeriodoSeg(periodo);
  const ahoraSeg = Math.floor(Date.now() / 1000);
  const tc = TIPO_CAMBIO_MXN_POR_USD;
  const efectivo = planEfectivo(ahoraSeg);

  // ── Tabla de precios como CTE ────────────────────────────────────────────
  // Se construye desde plans.ts (fuente única de verdad) en vez de escribir los
  // números en SQL: cambiar un precio no debe requerir tocar este archivo.
  const filasPrecio = PLANES_PAGADOS.flatMap((plan) =>
    CICLOS.map((ciclo) => {
      const { brutoMxn, netoMxn } = ingresoMensualDe(plan, ciclo);
      return sql`(${plan}, ${ciclo}, ${brutoMxn}, ${netoMxn})`;
    })
  );
  const precios = sql`precios(plan, ciclo, bruto_mxn, neto_mxn) AS (
    VALUES ${sql.join(filasPrecio, sql`, `)}
  )`;

  /* a) MARGEN DE CONTRIBUCIÓN con P50 y P90 ──────────────────────────────────
   *
   * `margenes` deja una fila POR USUARIO DE PAGO con su ingreso mensual neto y
   * su costo real de IA del periodo. El JOIN con `precios` es INNER a
   * propósito: quien está en plan gratis no tiene precio, así que no entra en
   * la distribución de margen (su costo aparece en el top de usuarios caros,
   * que es donde importa).
   *
   * `etiquetados` duplica cada usuario en dos grupos —su plan y "todos"— para
   * calcular los percentiles de ambos en una sola pasada. Es válido porque los
   * percentiles se calculan por partición, y ningún PlanId se llama "todos".
   */
  const filasMargen = db.all<FilaMargen>(sql`
    WITH ${precios},
    sub AS (
      SELECT u.id AS user_id, ${efectivo} AS plan, coalesce(s.ciclo, 'mes') AS ciclo
      FROM users u ${JOIN_SUB_VIGENTE}
    ),
    costos AS (
      SELECT user_id, SUM(costo_usd) AS costo_usd
      FROM ai_usage
      WHERE created_at >= ${desdeSeg}
      GROUP BY user_id
    ),
    margenes AS (
      SELECT
        sub.user_id                                  AS user_id,
        sub.plan                                     AS plan,
        p.neto_mxn                                   AS ingreso_mxn,
        coalesce(c.costo_usd, 0) * ${tc}             AS costo_mxn,
        p.neto_mxn - coalesce(c.costo_usd, 0) * ${tc} AS margen_mxn
      FROM sub
      JOIN precios p ON p.plan = sub.plan AND p.ciclo = sub.ciclo
      LEFT JOIN costos c ON c.user_id = sub.user_id
    ),
    etiquetados AS (
      SELECT plan AS grupo, user_id, ingreso_mxn, costo_mxn, margen_mxn FROM margenes
      UNION ALL
      SELECT 'todos' AS grupo, user_id, ingreso_mxn, costo_mxn, margen_mxn FROM margenes
    ),
    ordenado AS (
      SELECT
        grupo, ingreso_mxn, costo_mxn, margen_mxn,
        ROW_NUMBER() OVER (PARTITION BY grupo ORDER BY costo_mxn, user_id) AS rn,
        COUNT(*)     OVER (PARTITION BY grupo)                             AS n
      FROM etiquetados
    )
    SELECT
      grupo                                                              AS grupo,
      MAX(n)                                                             AS usuarios,
      SUM(ingreso_mxn)                                                   AS ingreso_total,
      SUM(costo_mxn)                                                     AS costo_total,
      MAX(CASE WHEN rn = (n * 50 + 99) / 100 THEN costo_mxn  END)        AS costo_p50,
      MAX(CASE WHEN rn = (n * 50 + 99) / 100 THEN margen_mxn END)        AS margen_p50,
      MAX(CASE WHEN rn = (n * 90 + 99) / 100 THEN costo_mxn  END)        AS costo_p90,
      MAX(CASE WHEN rn = (n * 90 + 99) / 100 THEN margen_mxn END)        AS margen_p90
    FROM ordenado
    GROUP BY grupo
  `);

  const porGrupo = new Map(filasMargen.map((f) => [f.grupo, f]));
  const margen: MargenGrupo[] = [...PLANES_PAGADOS, "todos" as const].map(
    (grupo) => {
      const f = porGrupo.get(grupo);
      const usuarios = n(f?.usuarios);
      return {
        grupo,
        etiqueta:
          grupo === "todos" ? "Todos los de pago" : PLANES[grupo].nombre,
        usuarios,
        ingresoNetoMxn: n(f?.ingreso_total),
        costoIaMxn: n(f?.costo_total),
        margenMxn: n(f?.ingreso_total) - n(f?.costo_total),
        costoP50Mxn: f?.costo_p50 ?? null,
        margenP50Mxn: f?.margen_p50 ?? null,
        costoP90Mxn: f?.costo_p90 ?? null,
        margenP90Mxn: f?.margen_p90 ?? null,
        p50Confiable: usuarios >= MIN_USUARIOS_P50,
        p90Confiable: usuarios >= MIN_USUARIOS_P90,
      };
    }
  );

  /* b) TOP de usuarios por costo de IA del periodo ────────────────────────── */
  const filasTop = db.all<FilaTop>(sql`
    SELECT
      u.id                          AS id,
      u.email                       AS email,
      ${efectivo}                   AS plan,
      s.ciclo                       AS ciclo,
      COUNT(a.id)                   AS llamadas,
      coalesce(SUM(a.costo_usd), 0) AS costo_usd
    FROM users u
    ${JOIN_SUB_VIGENTE}
    JOIN ai_usage a ON a.user_id = u.id AND a.created_at >= ${desdeSeg}
    GROUP BY u.id
    ORDER BY costo_usd DESC
    LIMIT ${TOP_USUARIOS}
  `);

  const topUsuarios: UsuarioCaro[] = [];
  for (const f of filasTop) {
    const plan = planPorId(f.plan).id;
    const ciclo = cicloValido(f.ciclo) ?? "mes";
    const costoMxn = n(f.costo_usd) * tc;
    const pagoMensualMxn =
      plan === "gratis" ? 0 : ingresoMensualDe(plan, ciclo).brutoMxn;
    const pctDelPago =
      pagoMensualMxn > 0 ? (costoMxn / pagoMensualMxn) * 100 : null;
    // Se pregunta con la misma función que autoriza el panel (rol en DB O
    // correo en SUPERADMIN_EMAILS) en vez de mirar solo la columna `role`:
    // así una cuenta que es admin únicamente por el entorno tampoco se
    // confunde con un cliente. Son máximo 20 consultas por índice primario.
    const esCasa = await esSuperAdmin(f.id);
    topUsuarios.push({
      email: f.email,
      plan,
      ciclo: plan === "gratis" ? null : ciclo,
      llamadas: n(f.llamadas),
      costoUsd: n(f.costo_usd),
      costoMxn,
      pagoMensualMxn,
      pctDelPago,
      esCasa,
      // La casa no dispara alarma: su gasto es costo interno, no una fuga de
      // margen. En el plan gratis no hay pago contra el cual comparar, así que
      // cualquier costo es pérdida y la alarma se enciende con el primer peso.
      alarma: esCasa
        ? false
        : pctDelPago === null
          ? costoMxn > 0
          : pctDelPago > UMBRAL_ALARMA * 100,
    });
  }

  /* c) MRR y mezcla anual vs mensual ──────────────────────────────────────── */
  const filasMrr = db.all<FilaMrr>(sql`
    SELECT plan, ciclo, COUNT(*) AS usuarios
    FROM (
      SELECT ${efectivo} AS plan, coalesce(s.ciclo, 'mes') AS ciclo
      FROM users u ${JOIN_SUB_VIGENTE}
    )
    WHERE plan <> 'gratis'
    GROUP BY plan, ciclo
  `);

  let mrrBruto = 0;
  let mrrNeto = 0;
  let mrrAnualBruto = 0;
  let suscriptores = 0;
  const acumPlan = new Map<
    PlanId,
    { mensuales: number; anuales: number; brutoMxn: number; netoMxn: number }
  >();
  for (const f of filasMrr) {
    const plan = planPorId(f.plan).id;
    if (plan === "gratis") continue;
    const ciclo = cicloValido(f.ciclo) ?? "mes";
    const usuarios = n(f.usuarios);
    const { brutoMxn, netoMxn } = ingresoMensualDe(plan, ciclo);
    const bruto = brutoMxn * usuarios;
    const neto = netoMxn * usuarios;
    mrrBruto += bruto;
    mrrNeto += neto;
    suscriptores += usuarios;
    if (ciclo === "anual") mrrAnualBruto += bruto;
    const acc = acumPlan.get(plan) ?? {
      mensuales: 0,
      anuales: 0,
      brutoMxn: 0,
      netoMxn: 0,
    };
    if (ciclo === "anual") acc.anuales += usuarios;
    else acc.mensuales += usuarios;
    acc.brutoMxn += bruto;
    acc.netoMxn += neto;
    acumPlan.set(plan, acc);
  }

  const mrr: Mrr = {
    suscriptores,
    brutoMxn: mrrBruto,
    netoMxn: mrrNeto,
    netoUsd: mrrNeto / tc,
    pctAnual: mrrBruto > 0 ? (mrrAnualBruto / mrrBruto) * 100 : null,
    porPlan: ORDEN_PLANES.filter((p): p is PlanId => p !== "gratis").map(
      (plan) => {
        const acc = acumPlan.get(plan);
        return {
          plan,
          etiqueta: PLANES[plan].nombre,
          mensuales: acc?.mensuales ?? 0,
          anuales: acc?.anuales ?? 0,
          brutoMxn: acc?.brutoMxn ?? 0,
          netoMxn: acc?.netoMxn ?? 0,
        };
      }
    ),
  };

  /* d) Activación ─────────────────────────────────────────────────────────────
   * "Activado" = temario generado Y al menos una sección o lección con
   * contenido. El temario solo es curiosidad; la primera sección escrita es la
   * señal de que la persona de verdad está escribiendo su libro.
   */
  const activacionRows = db.all<FilaActivacion>(sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS registrados,
      (SELECT COUNT(DISTINCT p.user_id) FROM projects p
        WHERE p.outline_generated = 1) AS con_temario,
      (SELECT COUNT(DISTINCT p.user_id) FROM projects p
        WHERE p.outline_generated = 1
          AND EXISTS (
            SELECT 1 FROM outline_nodes nn
            WHERE nn.project_id = p.id
              AND nn.kind IN ('section', 'lesson')
              AND nn.word_count > 0
          )) AS activados
  `);
  const act = activacionRows[0];
  const registrados = n(act?.registrados);
  const activacion: Activacion = {
    registrados,
    conTemario: n(act?.con_temario),
    activados: n(act?.activados),
    pctConTemario:
      registrados > 0 ? (n(act?.con_temario) / registrados) * 100 : null,
    pctActivados:
      registrados > 0 ? (n(act?.activados) / registrados) * 100 : null,
  };

  /* e) Producción: proyectos por estado y palabras ────────────────────────────
   * "Terminado" no es un estado de la tabla `projects` (solo hay draft/active/
   * archived): se deriva de las hojas del temario — un proyecto está terminado
   * cuando TODAS sus secciones o lecciones están en 'complete' y tiene al menos
   * una. Es la única definición que no se puede falsear sin escribir el libro.
   */
  const produccionRows = db.all<FilaProduccion>(sql`
    WITH hojas AS (
      SELECT
        p.id     AS id,
        p.type   AS type,
        p.status AS status,
        SUM(CASE WHEN nn.kind IN ('section','lesson') THEN 1 ELSE 0 END) AS hojas,
        SUM(CASE WHEN nn.kind IN ('section','lesson')
                  AND nn.status = 'complete' THEN 1 ELSE 0 END)          AS completas,
        coalesce(SUM(nn.word_count), 0)                                  AS palabras
      FROM projects p
      LEFT JOIN outline_nodes nn ON nn.project_id = p.id
      GROUP BY p.id
    )
    SELECT
      COUNT(*)                                                      AS proyectos,
      SUM(CASE WHEN hojas > 0 AND completas = hojas THEN 1 ELSE 0 END) AS terminados,
      SUM(CASE WHEN palabras > 0 AND NOT (hojas > 0 AND completas = hojas)
               THEN 1 ELSE 0 END)                                    AS en_progreso,
      SUM(CASE WHEN palabras = 0 THEN 1 ELSE 0 END)                  AS sin_empezar,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END)           AS archivados,
      SUM(CASE WHEN type = 'book' THEN 1 ELSE 0 END)                 AS libros,
      SUM(CASE WHEN type = 'course' THEN 1 ELSE 0 END)               AS cursos,
      SUM(palabras)                                                  AS palabras
    FROM hojas
  `);
  const pr = produccionRows[0];
  const produccion: Produccion = {
    proyectos: n(pr?.proyectos),
    terminados: n(pr?.terminados),
    enProgreso: n(pr?.en_progreso),
    sinEmpezar: n(pr?.sin_empezar),
    archivados: n(pr?.archivados),
    libros: n(pr?.libros),
    cursos: n(pr?.cursos),
    palabras: n(pr?.palabras),
  };

  /* Suscripciones vigentes ───────────────────────────────────────────────── */
  const filasSus = db.all<FilaSuscripcion>(sql`
    SELECT
      u.email                     AS email,
      ${efectivo}                 AS plan,
      s.ciclo                     AS ciclo,
      coalesce(s.estado,'ninguna') AS estado,
      s.periodo_fin               AS periodo_fin,
      s.cancela_al_fin            AS cancela_al_fin
    FROM users u
    ${JOIN_SUB_VIGENTE}
    WHERE s.id IS NOT NULL AND ${efectivo} <> 'gratis'
    ORDER BY s.periodo_fin ASC
  `);
  const suscripciones: SuscripcionActiva[] = filasSus.map((f) => ({
    email: f.email,
    plan: planPorId(f.plan).id,
    ciclo: cicloValido(f.ciclo),
    estado: f.estado,
    periodoFin: isoDeSegundos(f.periodo_fin),
    cancelaAlFin: Boolean(f.cancela_al_fin),
  }));

  /* Últimas llamadas de IA (para depurar fugas) ──────────────────────────── */
  const filasLlamadas = db.all<FilaLlamada>(sql`
    SELECT
      a.created_at         AS created_at,
      u.email              AS email,
      a.accion             AS accion,
      a.modelo             AS modelo,
      a.input_tokens       AS input_tokens,
      a.output_tokens      AS output_tokens,
      a.cache_read_tokens  AS cache_read_tokens,
      a.cache_write_tokens AS cache_write_tokens,
      a.costo_usd          AS costo_usd
    FROM ai_usage a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ${ULTIMAS_LLAMADAS}
  `);
  const ultimasLlamadas: LlamadaIA[] = filasLlamadas.map((f) => ({
    fecha: isoDeSegundos(f.created_at) ?? "",
    email: f.email,
    accion: f.accion,
    modelo: f.modelo,
    inputTokens: n(f.input_tokens),
    outputTokens: n(f.output_tokens),
    cacheReadTokens: n(f.cache_read_tokens),
    cacheWriteTokens: n(f.cache_write_tokens),
    costoUsd: n(f.costo_usd),
    costoMxn: n(f.costo_usd) * tc,
  }));

  /* Totales del periodo ──────────────────────────────────────────────────── */
  const totalesRows = db.all<FilaTotales>(sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS usuarios,
      (SELECT COUNT(*) FROM ai_usage WHERE created_at >= ${desdeSeg}) AS llamadas,
      (SELECT coalesce(SUM(costo_usd), 0) FROM ai_usage
        WHERE created_at >= ${desdeSeg}) AS costo_usd
  `);
  const tot = totalesRows[0];

  return {
    periodo,
    generadoEn: new Date().toISOString(),
    tipoCambio: tc,
    comisionStripe: COMISION_STRIPE,
    totales: {
      usuarios: n(tot?.usuarios),
      llamadasIa: n(tot?.llamadas),
      costoIaUsd: n(tot?.costo_usd),
      costoIaMxn: n(tot?.costo_usd) * tc,
    },
    margen,
    topUsuarios,
    mrr,
    activacion,
    produccion,
    suscripciones,
    ultimasLlamadas,
  };
}

/* ──────────────────────────── ENDPOINT ───────────────────────────────────── */

/**
 * GET. Solo super admin.
 *
 * Quien no lo sea recibe 404, no 403: un 403 confirmaría que la ruta existe y
 * que hay algo detrás. El panel hace lo mismo redirigiendo al dashboard.
 *
 * Lo que sale de aquí sobre OTROS usuarios se limita a correo + plan + costo
 * agregado. Nada de títulos de proyectos, contenido, ni prompts: el dueño
 * necesita saber cuánto le cuesta cada cuenta, no qué está escribiendo.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await esSuperAdmin(user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const metricas = await calcularMetricas();
    return NextResponse.json(metricas, {
      // Cifras de dinero: nunca cacheadas, ni por el navegador ni por un proxy.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[admin/metricas] falló el cálculo:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error calculando" },
      { status: 500 }
    );
  }
}
