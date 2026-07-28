/**
 * Cuotas de uso por plan.
 *
 * Los límites viven en src/lib/plans.ts (fuente única de verdad). Este módulo
 * solo cuenta y decide. Cada acción de IA cuesta dinero real: medido con la API
 * de conteo de Anthropic sobre el contexto de producción, un mensaje de chat
 * son 21,552 tokens de entrada. Sin este archivo, un solo usuario intensivo
 * cuesta más que su mensualidad.
 *
 * ── ATOMICIDAD (lo importante de aquí) ──────────────────────────────────────
 * Leer el contador y luego escribirlo en dos pasos es una condición de carrera:
 * entre el `await` de la lectura y el de la escritura, Node atiende otra
 * petición del mismo usuario, ambas leen "59 de 60" y ambas escriben 60. Con
 * dos pestañas abiertas la cuota se rebasa gratis.
 *
 * La solución es que el incremento y su condición ocurran en UNA sola sentencia
 * SQL: un upsert con `ON CONFLICT ... DO UPDATE ... WHERE cantidad + n <=
 * limite`. SQLite evalúa la condición sobre la fila real dentro de la misma
 * sentencia, así que si otra petición ya llenó la cuota, el UPDATE no aplica y
 * `changes` vuelve en 0. Ese 0 ES el "no cabe".
 *
 * ¿Por qué basta con eso y no hace falta un lock? Porque better-sqlite3 es
 * SÍNCRONO y el server corre en PM2 modo fork (un solo proceso Node): la
 * sentencia se ejecuta completa sin ceder el event loop, y no hay un segundo
 * proceso escribiendo. Si algún día esto pasa a cluster o a varias máquinas, el
 * upsert condicional SIGUE siendo correcto (es atómico a nivel de SQLite, no de
 * Node), lo que habría que revisar es el WAL y los reintentos por SQLITE_BUSY.
 */

import { db } from "./db";
import { projects, usageCounters } from "./schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  ETIQUETA_ACCION,
  ORDEN_PLANES,
  PLANES,
  cuotaDe,
  planPorId,
  type AccionIA,
  type Plan,
} from "./plans";
import { esSuperAdmin, suscripcionDe } from "./subscription";

export type ResultadoCuota =
  | { ok: true; usado: number; limite: number }
  | { ok: false; usado: number; limite: number; mensaje: string };

/** Todas las acciones con cuota (las llaves de ETIQUETA_ACCION son AccionIA). */
const ACCIONES = Object.keys(ETIQUETA_ACCION) as AccionIA[];

/**
 * Zona horaria del negocio. El periodo de cuota es el mes CALENDARIO MEXICANO,
 * no el mes UTC: un usuario en Los Cabos que escribe el 31 a las 11 de la noche
 * espera que su cuota siga siendo la del mes que está viviendo, y que se
 * reinicie el día 1 a medianoche de su reloj. Con UTC, en horario de verano de
 * Ciudad de México el mes cambiaría a las 6 o 7 de la tarde del día 31: el
 * usuario vería su cuota reiniciarse (o agotarse) un día antes.
 */
const ZONA_MX = "America/Mexico_City";

const FORMATO_PERIODO = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_MX,
  year: "numeric",
  month: "2-digit",
});

const FORMATO_NUMERO = new Intl.NumberFormat("es-MX");

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Periodo de cuota: "YYYY-MM" en hora de México.
 *
 * Se arma con formatToParts en vez de concatenar el string formateado para no
 * depender del orden que use el locale (es-MX da "07/2026").
 */
export function periodoActual(fecha: Date = new Date()): string {
  const partes = FORMATO_PERIODO.formatToParts(fecha);
  const anio = partes.find((p) => p.type === "year")?.value ?? "";
  const mes = partes.find((p) => p.type === "month")?.value ?? "";
  // Cinturón y tirantes: si Intl fallara, no devolvemos un periodo vacío que
  // metiera todo el uso histórico en la misma fila.
  if (anio.length !== 4 || mes.length !== 2) {
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${anio}-${mes}`;
}

/** "el 1 de agosto" / "el 1 de enero de 2027": cuándo se reinicia la cuota. */
function textoReinicio(periodo: string): string {
  const [anioStr, mesStr] = periodo.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return "el día 1 del próximo mes";
  }
  const esDiciembre = mes === 12;
  const nombre = MESES[esDiciembre ? 0 : mes];
  return esDiciembre ? `el 1 de ${nombre} de ${anio + 1}` : `el 1 de ${nombre}`;
}

function num(n: number): string {
  return FORMATO_NUMERO.format(n);
}

/** Cómo nombramos el plan dentro de una frase ("tu plan gratis", "tu plan Autor"). */
function etiquetaPlan(plan: Plan): string {
  return plan.id === "gratis" ? "gratis" : plan.nombre;
}

/** Primer plan más caro que el actual con MÁS cuota de esta acción. */
function planQueAlcanza(plan: Plan, accion: AccionIA): Plan | null {
  const limiteActual = cuotaDe(plan, accion);
  const desde = ORDEN_PLANES.indexOf(plan.id) + 1;
  for (let i = Math.max(desde, 0); i < ORDEN_PLANES.length; i++) {
    const candidato = PLANES[ORDEN_PLANES[i]];
    if (cuotaDe(candidato, accion) > limiteActual) return candidato;
  }
  return null;
}

/**
 * Mensaje de "no cabe", en español y sin jerga. Nunca decimos "tokens" ni
 * "créditos": el usuario entiende temarios, mensajes y palabras dictadas.
 */
function mensajeLimite(
  plan: Plan,
  accion: AccionIA,
  usado: number,
  limite: number,
  cantidad: number,
  periodo: string
): string {
  const que = ETIQUETA_ACCION[accion];
  const arriba = planQueAlcanza(plan, accion);
  const reinicio = textoReinicio(periodo);

  // Caso 1: el plan simplemente no incluye la función (cuota 0).
  if (limite <= 0) {
    if (!arriba) {
      return `Los ${que} no están disponibles en tu plan ${etiquetaPlan(plan)}.`;
    }
    return `Los ${que} no vienen en tu plan ${etiquetaPlan(plan)}. Están en el plan ${arriba.nombre}, con ${num(
      cuotaDe(arriba, accion)
    )} al mes.`;
  }

  const restante = Math.max(0, limite - usado);

  // Caso 2: queda cuota, pero no la suficiente para lo que se pidió (pasa
  // sobre todo en dictado, donde una sola grabación son cientos de palabras).
  if (restante > 0 && cantidad > 1) {
    const base = `Te quedan ${num(restante)} de tus ${num(limite)} ${que} de este mes y esto necesita ${num(
      cantidad
    )}. Tu cuota se reinicia ${reinicio}.`;
    return arriba
      ? `${base} El plan ${arriba.nombre} te da ${num(cuotaDe(arriba, accion))} al mes.`
      : base;
  }

  // Caso 3: cuota agotada.
  const base = `Ya usaste los ${num(limite)} ${que} que incluye tu plan ${etiquetaPlan(
    plan
  )} este mes. Tu cuota se reinicia ${reinicio}.`;
  if (!arriba) {
    return `${base} Es el tope más alto que tenemos; escríbenos y lo vemos contigo.`;
  }
  return `${base} Si quieres seguir hoy, el plan ${arriba.nombre} te da ${num(
    cuotaDe(arriba, accion)
  )} al mes.`;
}

/** Cuánto lleva usado el usuario de una acción en un periodo. 0 si no hay fila. */
async function usadoDe(
  userId: string,
  periodo: string,
  accion: AccionIA
): Promise<number> {
  const rows = await db
    .select({ cantidad: usageCounters.cantidad })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.periodo, periodo),
        eq(usageCounters.accion, accion)
      )
    )
    .limit(1);
  return rows[0]?.cantidad ?? 0;
}

/**
 * Incremento ATÓMICO con tope. Devuelve true si aplicó, false si no cabía.
 *
 * Una sola sentencia hace las dos cosas:
 *   · `WHERE ${cant} <= ${tope}` protege la rama INSERT (fila nueva: el
 *     consumo por sí solo no puede rebasar el límite). Si es falso, SQLite no
 *     inserta nada y `changes` = 0.
 *   · `ON CONFLICT ... DO UPDATE ... WHERE cantidad + ${cant} <= ${tope}`
 *     protege la rama UPDATE contra la fila que ya existe.
 *
 * El INSERT usa `SELECT ... WHERE` (no `VALUES`) porque es la única forma de
 * condicionar la inserción. SQLite exige que ese SELECT traiga WHERE cuando hay
 * ON CONFLICT, si no el parser no sabe a quién pertenece la cláusula; aquí el
 * WHERE es justo el que necesitábamos.
 *
 * `tope = null` significa sin límite (super admin): se usa MAX_SAFE_INTEGER
 * para que las condiciones siempre pasen sin cambiar la forma de la sentencia.
 *
 * `updated_at` se escribe en SEGUNDOS porque el resto del esquema usa
 * `integer({ mode: "timestamp" })` de drizzle, que son segundos y no ms.
 */
function incrementoAtomico(
  userId: string,
  periodo: string,
  accion: AccionIA,
  cantidad: number,
  tope: number | null
): boolean {
  const limite = tope === null ? Number.MAX_SAFE_INTEGER : tope;
  const ahora = Math.floor(Date.now() / 1000);
  const id = nanoid(21);

  const res = db.run(sql`
    INSERT INTO usage_counters (id, user_id, periodo, accion, cantidad, updated_at)
    SELECT ${id}, ${userId}, ${periodo}, ${accion}, ${cantidad}, ${ahora}
    WHERE ${cantidad} <= ${limite}
    ON CONFLICT(user_id, periodo, accion) DO UPDATE
      SET cantidad = cantidad + ${cantidad},
          updated_at = ${ahora}
      WHERE cantidad + ${cantidad} <= ${limite}
  `);

  return res.changes > 0;
}

/**
 * Consume cuota de una acción. Es la puerta que TODA llamada a la IA debe
 * cruzar ANTES de gastar tokens.
 *
 * @param cantidad unidades a consumir. 1 para acciones sueltas (un temario, un
 *                 mensaje); para dictado son PALABRAS, así que llega en cientos.
 *
 * SUPER ADMIN: nunca se le bloquea, pero su consumo SÍ se cuenta, para que el
 * panel muestre el costo real de lo que gasta la casa. En ese caso `limite` es
 * el del plan que tenga y `usado` puede rebasarlo: los llamadores deben mirar
 * `ok`, no comparar los dos números.
 */
export async function consumirCuota(
  userId: string,
  accion: AccionIA,
  cantidad: number = 1
): Promise<ResultadoCuota> {
  const periodo = periodoActual();
  const suscripcion = await suscripcionDe(userId);
  const plan = planPorId(suscripcion.plan);
  const limite = cuotaDe(plan, accion);

  const cant = Math.floor(Number(cantidad));

  // Nada que consumir (p. ej. un dictado que no transcribió ni una palabra):
  // no tocamos el contador ni cobramos una unidad que no se usó.
  if (!Number.isFinite(cant) || cant <= 0) {
    return { ok: true, usado: await usadoDe(userId, periodo, accion), limite };
  }

  if (await esSuperAdmin(userId)) {
    const antes = await usadoDe(userId, periodo, accion);
    incrementoAtomico(userId, periodo, accion, cant, null);
    return { ok: true, usado: antes + cant, limite };
  }

  const usado = await usadoDe(userId, periodo, accion);

  // Rechazo temprano: sirve para dar el mensaje bueno (necesita saber cuánto
  // quedaba). El upsert de abajo es el que de verdad garantiza el tope.
  if (limite <= 0 || usado + cant > limite) {
    return {
      ok: false,
      usado,
      limite,
      mensaje: mensajeLimite(plan, accion, usado, limite, cant, periodo),
    };
  }

  if (!incrementoAtomico(userId, periodo, accion, cant, limite)) {
    // Llegamos aquí solo si otra petición del mismo usuario consumió la cuota
    // entre la lectura y la escritura. Releemos para que el mensaje diga la
    // verdad de este instante.
    const ahora = await usadoDe(userId, periodo, accion);
    return {
      ok: false,
      usado: ahora,
      limite,
      mensaje: mensajeLimite(plan, accion, ahora, limite, cant, periodo),
    };
  }

  return { ok: true, usado: usado + cant, limite };
}

/**
 * Uso del periodo vigente, acción por acción. Siempre trae TODAS las acciones
 * (0 donde no hay fila) para que el panel no tenga que defenderse de llaves
 * ausentes.
 */
export async function usoDelPeriodo(
  userId: string
): Promise<Record<AccionIA, number>> {
  const base = Object.fromEntries(ACCIONES.map((a) => [a, 0])) as Record<
    AccionIA,
    number
  >;
  if (!userId) return base;

  const periodo = periodoActual();
  const rows = await db
    .select({
      accion: usageCounters.accion,
      cantidad: usageCounters.cantidad,
    })
    .from(usageCounters)
    .where(
      and(eq(usageCounters.userId, userId), eq(usageCounters.periodo, periodo))
    );

  for (const row of rows) {
    // Ignoramos acciones que ya no existen en plans.ts (filas históricas de una
    // función retirada) en lugar de meter llaves desconocidas al mapa.
    if (row.accion in base) {
      base[row.accion as AccionIA] = row.cantidad ?? 0;
    }
  }
  return base;
}

/**
 * ¿Puede crear otro proyecto? Los proyectos NO son cuota mensual: es un cupo de
 * simultáneos. Se cuentan los no archivados (borradores incluidos: un borrador
 * ocupa lugar en el tablero y consume base de conocimiento). Archivar libera
 * lugar sin borrar nada.
 */
export async function puedeCrearProyecto(
  userId: string
): Promise<ResultadoCuota> {
  const suscripcion = await suscripcionDe(userId);
  const plan = planPorId(suscripcion.plan);
  const limite = plan.cuotas.proyectos;

  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.userId, userId), ne(projects.status, "archived")));
  const activos = Number(rows[0]?.n ?? 0);

  if (await esSuperAdmin(userId)) {
    return { ok: true, usado: activos, limite };
  }

  if (activos + 1 > limite) {
    const arriba = ORDEN_PLANES.slice(ORDEN_PLANES.indexOf(plan.id) + 1)
      .map((id) => PLANES[id])
      .find((p) => p.cuotas.proyectos > limite);
    const base =
      limite === 1
        ? `Tu plan ${etiquetaPlan(plan)} permite un proyecto a la vez. Archiva el que tienes para empezar otro`
        : `Tu plan ${etiquetaPlan(plan)} permite ${num(limite)} proyectos a la vez. Archiva uno para empezar otro`;
    return {
      ok: false,
      usado: activos,
      limite,
      mensaje: arriba
        ? `${base}, o sube al plan ${arriba.nombre} y lleva ${num(arriba.cuotas.proyectos)} en paralelo.`
        : `${base}.`,
    };
  }

  return { ok: true, usado: activos, limite };
}
