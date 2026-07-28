/**
 * Estado de suscripción y rol de super admin.
 *
 * Stripe es la verdad del COBRO; la tabla `subscriptions` es la verdad del
 * ACCESO. Se lee de la DB local y nunca se llama a la API de Stripe aquí: esto
 * corre en cada request que toca IA, y una llamada de red por request sería
 * lenta y frágil (si Stripe se cae, la app no debe caerse con él).
 */

import { db } from "./db";
import { subscriptions, users } from "./schema";
import { desc, eq, sql } from "drizzle-orm";
import { planPorId, type Ciclo, type PlanId } from "./plans";

export type Suscripcion = {
  plan: PlanId;
  ciclo: Ciclo | null;
  estado: string;
  periodoFin: Date | null;
  cancelaAlFin: boolean;
};

/** Lo que devuelve quien no tiene fila o cuya suscripción ya no da acceso. */
const SIN_SUSCRIPCION: Suscripcion = {
  plan: "gratis",
  ciclo: null,
  estado: "ninguna",
  periodoFin: null,
  cancelaAlFin: false,
};

/**
 * Estados de Stripe que dan acceso de inmediato.
 * - `active`: pagado y corriente.
 * - `trialing`: periodo de prueba vigente (aún no cobra, pero ya prometimos
 *   el acceso).
 */
const ESTADOS_ACTIVOS = new Set(["active", "trialing"]);

/**
 * DECISIÓN DE NEGOCIO: `past_due` NO corta el servicio mientras el periodo
 * pagado siga vigente.
 *
 * En México el cobro recurrente con tarjeta de débito falla seguido por saldo
 * insuficiente, por 3-D Secure o porque el banco marca el cargo recurrente
 * como sospechoso. Stripe pasa la suscripción a `past_due` y reintenta
 * (dunning) durante días; la mayoría de esos cobros terminan pasando. Si
 * cortáramos el acceso en el primer reintento fallido, el usuario perdería su
 * libro a medias por un problema de su banco, escribiría a soporte enojado y
 * muchos cancelarían: churn que nos causamos nosotros.
 *
 * Por eso `past_due` cuenta como activo SOLO mientras `periodoFin` esté en el
 * futuro — que es exactamente la ventana de reintentos de Stripe. Cuando
 * Stripe agota los reintentos manda `canceled` o `unpaid` y ahí sí cae a
 * gratis. Si `periodoFin` viene en NULL (dato incompleto), fallamos cerrado:
 * sin fecha no podemos justificar el acceso.
 *
 * `unpaid`, `canceled`, `incomplete`, `incomplete_expired` y `paused` nunca
 * dan acceso.
 */
const ESTADOS_CON_GRACIA = new Set(["past_due"]);

/**
 * ¿Este par (estado, fin de periodo) da acceso HOY?
 *
 * ── POR QUÉ `active` TAMBIÉN MIRA LA FECHA ────────────────────────────────
 * Esta tabla es un ESPEJO de Stripe que solo se actualiza cuando llega un
 * webhook. Si un webhook se pierde (Stripe reintenta, pero el reintento puede
 * caer mientras el server está caído, o el endpoint puede quedar mal
 * configurado tras un despliegue), la fila se queda colgada en `active` con un
 * `periodoFin` que ya pasó — y ese renglón viejo repartiría plan de paga para
 * siempre. Un periodo vencido es una contradicción con `active`: sin cobro
 * nuevo confirmado, mandamos la fecha.
 *
 * `periodoFin` en NULL SÍ da acceso con estado activo: hay una ventana real
 * entre el checkout y el primer `customer.subscription.*` en la que la fila
 * puede existir sin fecha, y ahí negar el acceso le quitaría el plan a alguien
 * que acaba de pagar. Para `past_due` es al revés (ver abajo): sin fecha no
 * hay ventana de reintentos que justificar, así que falla cerrado.
 */
function daAcceso(estado: string, periodoFin: Date | null): boolean {
  const e = estado.trim().toLowerCase();
  const periodoVigente = periodoFin === null || periodoFin.getTime() > Date.now();
  if (ESTADOS_ACTIVOS.has(e)) return periodoVigente;
  if (ESTADOS_CON_GRACIA.has(e)) {
    return periodoFin !== null && periodoFin.getTime() > Date.now();
  }
  return false;
}

function cicloValido(valor: string | null): Ciclo | null {
  return valor === "mes" || valor === "anual" ? valor : null;
}

/**
 * Suscripción vigente del usuario. Si no hay fila, o el estado ya no da
 * acceso, devuelve el plan gratis: el plan gratis NO caduca, así que nadie se
 * queda sin poder entrar a su proyecto por dejar de pagar.
 *
 * Nota: cuando la fila existe pero ya no da acceso, se devuelve `plan: gratis`
 * a propósito (es el plan efectivo, el que manda para las cuotas). El `estado`
 * sí es el real, para que la UI pueda decir "tu pago falló" en lugar de fingir
 * que nunca hubo suscripción.
 */
export async function suscripcionDe(userId: string): Promise<Suscripcion> {
  if (!userId) return SIN_SUSCRIPCION;

  // Ordenado por updatedAt: si por un webhook duplicado hubiera más de una
  // fila del mismo usuario, manda la última que tocó Stripe.
  const rows = await db
    .select({
      plan: subscriptions.plan,
      ciclo: subscriptions.ciclo,
      estado: subscriptions.estado,
      periodoFin: subscriptions.periodoFin,
      cancelaAlFin: subscriptions.cancelaAlFin,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return SIN_SUSCRIPCION;

  const periodoFin = row.periodoFin ?? null;
  const estado = row.estado ?? "ninguna";

  if (!daAcceso(estado, periodoFin)) {
    return {
      plan: "gratis",
      ciclo: cicloValido(row.ciclo),
      estado,
      periodoFin,
      cancelaAlFin: Boolean(row.cancelaAlFin),
    };
  }

  return {
    // planPorId normaliza: un valor basura en la columna cae a gratis en lugar
    // de regalar cuotas de un plan que no existe.
    plan: planPorId(row.plan).id,
    ciclo: cicloValido(row.ciclo),
    estado,
    periodoFin,
    cancelaAlFin: Boolean(row.cancelaAlFin),
  };
}

/**
 * Correos con super admin desde el entorno. Es la RED DE SEGURIDAD: si la
 * columna `role` se pierde en una migración o alguien la edita por error, el
 * dueño sigue entrando a su propio panel. El repo es público, así que la lista
 * vive en SUPERADMIN_EMAILS y nunca en el código.
 *
 * Se tolera separación por comas, punto y coma o espacios.
 */
function correosSuperAdmin(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * ¿Es super admin? Basta con cumplir UNA de las dos:
 *   1. `users.role === 'superadmin'` en la DB, o
 *   2. su correo está en SUPERADMIN_EMAILS.
 *
 * Los super admins no tienen límites de cuota (ver consumirCuota), pero SÍ se
 * les registra el uso: el panel debe mostrar el costo real en dólares de lo
 * que consume la casa, no esconderlo.
 */
export async function esSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  const rows = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  // `?? "user"` por si alguna DB quedó con la columna nullable: NULL = 'user'.
  if ((row.role ?? "user").trim().toLowerCase() === "superadmin") return true;

  const correos = correosSuperAdmin();
  if (correos.length === 0) return false;
  return correos.includes((row.email ?? "").trim().toLowerCase());
}

/**
 * Promueve a 'superadmin' en la DB a los correos de SUPERADMIN_EMAILS.
 * Idempotente: si ya lo son, no escribe nada.
 *
 * NO se llama en el import a propósito — un efecto secundario al cargar el
 * módulo se ejecutaría en cada cold start y en cada build. Que la llame quien
 * deba (un endpoint de administración, un script de arranque).
 *
 * OJO: esta función solo PROMUEVE. Quitar un correo del entorno no degrada a
 * nadie, porque el rol en DB es el permiso durable y una degradación
 * automática por un typo en la variable dejaría al dueño fuera de su panel.
 * Degradar es manual y explícito.
 */
export async function asegurarSuperAdminsDeEnv(): Promise<void> {
  const correos = correosSuperAdmin();
  if (correos.length === 0) return;

  for (const correo of correos) {
    // lower() en el WHERE: el correo se guarda en minúsculas al registrarse,
    // pero las filas viejas pueden traer mayúsculas.
    await db
      .update(users)
      .set({ role: "superadmin" })
      .where(sql`lower(${users.email}) = ${correo}`);
  }
}
