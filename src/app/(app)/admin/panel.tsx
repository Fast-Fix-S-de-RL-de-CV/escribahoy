/**
 * Panel financiero del dueño. SOLO presentación: recibe el objeto `Metricas` ya
 * calculado (ver src/app/api/admin/metricas/route.ts) y lo pinta.
 *
 * No lleva "use client" a propósito. No hay estado ni interacción: son cifras
 * que se leen. Como Server Component, los números se calculan y formatean en el
 * servidor, no viajan dos veces (payload RSC + hidratación) y no hay riesgo de
 * que `toLocaleString` del navegador —con otra zona horaria u otro locale—
 * produzca un texto distinto al del servidor.
 *
 * ── REGLA DE HONESTIDAD ────────────────────────────────────────────────────
 * Un panel financiero que muestra 0 cuando en realidad no sabe, miente. Aquí
 * todo lo que no se puede calcular con los datos que hay se dice con palabras
 * ("aún no hay datos suficientes para calcular el P90"), nunca con un cero ni
 * con un guion que se pueda confundir con "cero pesos".
 */

import {
  ActivityIcon,
  BookCheckIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  CoinsIcon,
  GaugeIcon,
  ReceiptIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Badge, Card, CardBody, Progress } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ETIQUETA_ACCION, type AccionIA } from "@/lib/plans";
import {
  MIN_USUARIOS_P50,
  MIN_USUARIOS_P90,
  UMBRAL_ALARMA,
  type MargenGrupo,
  type Metricas,
} from "@/app/api/admin/metricas/route";

/* ─────────────────────────── FORMATO ─────────────────────────────────────── */

const NUM = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD4 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Pesos. Siempre con la moneda escrita: "$" solo es ambiguo con dólares. */
function mxn(v: number, decimales = false): string {
  const abs = decimales ? NUM2.format(Math.abs(v)) : NUM.format(Math.abs(v));
  return `${v < 0 ? "−" : ""}$${abs} MXN`;
}

function usd(v: number): string {
  return `${v < 0 ? "−" : ""}US$${USD4.format(Math.abs(v))}`;
}

function pct(v: number | null, decimales = 1): string {
  if (v === null || !Number.isFinite(v)) return "sin datos";
  return `${v.toFixed(decimales)}%`;
}

function fecha(iso: string | null): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "sin fecha" : FECHA.format(d);
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FECHA_HORA.format(d);
}

function etiquetaAccion(accion: string): string {
  if (accion === "kb") return "base de conocimiento";
  return ETIQUETA_ACCION[accion as AccionIA] ?? accion;
}

/* ─────────────────────────── PIEZAS ──────────────────────────────────────── */

function Seccion({
  icono,
  titulo,
  descripcion,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-start gap-3 mb-4">
        <span className="h-9 w-9 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] flex-shrink-0">
          {icono}
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5 max-w-3xl">
            {descripcion}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Kpi({
  icono,
  etiqueta,
  valor,
  nota,
  tono = "normal",
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: "normal" | "bueno" | "malo";
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
          {icono}
          <span>{etiqueta}</span>
        </div>
        <div
          className={cn(
            "text-3xl font-semibold mt-2 tracking-tight",
            tono === "bueno" && "text-[var(--color-success)]",
            tono === "malo" && "text-[var(--color-danger)]"
          )}
        >
          {valor}
        </div>
        {nota && (
          <div className="text-xs text-[var(--color-fg-subtle)] mt-1 leading-relaxed">
            {nota}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Aviso honesto: se usa donde el dato no existe o no alcanza para concluir. */
function SinDatos({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--color-fg-subtle)] italic leading-relaxed">
      {children}
    </p>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "text-left font-medium text-xs uppercase tracking-wide text-[var(--color-fg-subtle)] px-4 py-2.5",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>
  );
}

function Tabla({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">{children}</table>
      </div>
    </Card>
  );
}

/* ─────────────────────────── PANEL ───────────────────────────────────────── */

export function PanelAdmin({ metricas: m }: { metricas: Metricas }) {
  const baseVacia = m.totales.usuarios === 0;
  const todos = m.margen.find((g) => g.grupo === "todos");
  const margenTotal = todos?.margenMxn ?? 0;
  const conAlarma = m.topUsuarios.filter((u) => u.alarma).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Panel del negocio
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-1">
            Periodo {m.periodo} (mes calendario de México). Actualizado{" "}
            {fechaHora(m.generadoEn)}.
          </p>
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)] text-right leading-relaxed">
          <div>
            Tipo de cambio usado:{" "}
            <span className="font-medium text-[var(--color-fg-muted)]">
              {m.tipoCambio} MXN por USD
            </span>{" "}
            (supuesto fijo)
          </div>
          <div>
            Ingreso neto = precio − IVA ({16}%) − comisión Stripe (
            {(m.comisionStripe * 100).toFixed(1)}%)
          </div>
        </div>
      </header>

      {baseVacia && (
        <Card className="mt-6 border-[var(--color-warning)]">
          <CardBody className="flex items-start gap-3">
            <CircleAlertIcon className="h-5 w-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">La base está vacía</div>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                Todavía no hay usuarios registrados, así que ninguna de estas
                cifras significa nada. No son ceros: son datos que aún no
                existen.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Números grandes ────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Kpi
          icono={<WalletIcon className="h-4 w-4" />}
          etiqueta="MRR neto"
          valor={m.mrr.suscriptores === 0 ? "sin datos" : mxn(m.mrr.netoMxn)}
          nota={
            m.mrr.suscriptores === 0
              ? "Todavía no hay suscripciones activas"
              : `${usd(m.mrr.netoUsd)} · ${m.mrr.suscriptores} suscriptor${
                  m.mrr.suscriptores === 1 ? "" : "es"
                } · bruto ${mxn(m.mrr.brutoMxn)}`
          }
        />
        <Kpi
          icono={<CoinsIcon className="h-4 w-4" />}
          etiqueta="Costo de IA del mes"
          valor={mxn(m.totales.costoIaMxn)}
          nota={`${usd(m.totales.costoIaUsd)} en ${NUM.format(
            m.totales.llamadasIa
          )} llamadas`}
        />
        <Kpi
          icono={
            margenTotal >= 0 ? (
              <TrendingUpIcon className="h-4 w-4" />
            ) : (
              <TrendingDownIcon className="h-4 w-4" />
            )
          }
          etiqueta="Margen de contribución"
          valor={
            m.mrr.suscriptores === 0 ? "sin datos" : mxn(margenTotal)
          }
          tono={
            m.mrr.suscriptores === 0
              ? "normal"
              : margenTotal >= 0
                ? "bueno"
                : "malo"
          }
          nota={
            m.mrr.suscriptores === 0
              ? "Se necesita al menos una suscripción de pago"
              : "Ingreso neto de los planes de pago menos su costo real de IA"
          }
        />
        <Kpi
          icono={<GaugeIcon className="h-4 w-4" />}
          etiqueta="Activación"
          valor={
            m.activacion.registrados === 0
              ? "sin datos"
              : pct(m.activacion.pctActivados)
          }
          nota={
            m.activacion.registrados === 0
              ? "Aún no hay registros"
              : `${m.activacion.activados} de ${m.activacion.registrados} registrados con temario y una sección escrita`
          }
        />
      </div>

      {/* ── a) Margen con P50 / P90 ────────────────────────────────────── */}
      <Seccion
        icono={<TrendingUpIcon className="h-4 w-4" />}
        titulo="Margen de contribución por usuario"
        descripcion="Ingreso mensual neto (sin IVA y sin la comisión de Stripe, con el anual prorrateado a 12) menos el costo real de IA del periodo. Se muestran la mediana (P50) y el percentil 90 —no el promedio— porque el costo de IA es de cola larga: unos pocos usuarios intensivos inflan el promedio y hacen ver rentable un plan que pierde dinero justo con quien más lo usa."
      >
        <div className="grid md:grid-cols-2 gap-4">
          {m.margen.map((g) => (
            <TarjetaMargen key={g.grupo} g={g} />
          ))}
        </div>
      </Seccion>

      {/* ── b) Top usuarios por costo ──────────────────────────────────── */}
      <Seccion
        icono={<ReceiptIcon className="h-4 w-4" />}
        titulo="Los 20 usuarios más caros del mes"
        descripcion={`Costo real de IA contra lo que paga cada quien (precio de lista con IVA, anual prorrateado). En rojo, quien ya rebasó el ${
          UMBRAL_ALARMA * 100
        }% de su pago: el margen real es todavía más apretado, porque de ese pago se van el IVA y la comisión de la pasarela.`}
      >
        {m.topUsuarios.length === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>
                Nadie ha usado la IA en este periodo, así que no hay costo que
                repartir.
              </SinDatos>
            </CardBody>
          </Card>
        ) : (
          <>
            {conAlarma > 0 && (
              <div className="flex items-center gap-2 mb-3 text-sm text-[var(--color-danger)]">
                <CircleAlertIcon className="h-4 w-4" />
                <span>
                  {conAlarma}{" "}
                  {conAlarma === 1
                    ? "usuario supera"
                    : "usuarios superan"}{" "}
                  el umbral de alarma.
                </span>
              </div>
            )}
            <Tabla>
              <thead className="border-b border-[var(--color-border)]">
                <tr>
                  <Th>Usuario</Th>
                  <Th>Plan</Th>
                  <Th className="text-right">Llamadas</Th>
                  <Th className="text-right">Costo IA</Th>
                  <Th className="text-right">Paga al mes</Th>
                  <Th className="text-right">Costo / pago</Th>
                </tr>
              </thead>
              <tbody>
                {m.topUsuarios.map((u) => (
                  <tr
                    key={u.email}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <Td className="font-medium">{u.email}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge
                          variant={u.plan === "gratis" ? "muted" : "accent"}
                        >
                          {u.plan}
                          {u.ciclo === "anual" ? " · anual" : ""}
                        </Badge>
                        {u.esCasa && <Badge variant="warning">casa</Badge>}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {NUM.format(u.llamadas)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      <div>{mxn(u.costoMxn, true)}</div>
                      <div className="text-xs text-[var(--color-fg-subtle)]">
                        {usd(u.costoUsd)}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {u.pagoMensualMxn > 0 ? (
                        mxn(u.pagoMensualMxn)
                      ) : (
                        <span className="text-[var(--color-fg-subtle)]">
                          nada (plan gratis)
                        </span>
                      )}
                    </Td>
                    <Td
                      className={cn(
                        "text-right tabular-nums font-medium",
                        u.alarma && "text-[var(--color-danger)]"
                      )}
                    >
                      {u.pctDelPago === null ? (
                        <span className="inline-flex items-center gap-1 justify-end">
                          {u.alarma && <CircleAlertIcon className="h-3.5 w-3.5" />}
                          {u.esCasa ? "uso interno" : "pérdida pura"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 justify-end">
                          {u.alarma && <CircleAlertIcon className="h-3.5 w-3.5" />}
                          {pct(u.pctDelPago)}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </>
        )}
      </Seccion>

      {/* ── c) MRR y mezcla anual ──────────────────────────────────────── */}
      <Seccion
        icono={<WalletIcon className="h-4 w-4" />}
        titulo="MRR y mezcla anual"
        descripcion="Ingreso recurrente mensual: cada suscripción anual cuenta como su doceava parte. El porcentaje anual importa porque ese dinero ya está cobrado por adelantado (mejor caja, menos rotación) pero su costo de IA se sigue gastando mes con mes."
      >
        {m.mrr.suscriptores === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>
                Todavía no hay suscripciones activas. Cuando entre la primera,
                aquí aparecen el MRR y la mezcla de ciclos.
              </SinDatos>
            </CardBody>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardBody>
                <div className="text-sm text-[var(--color-fg-muted)]">
                  Del ingreso mensual entra como anual
                </div>
                <div className="text-3xl font-semibold mt-2 tracking-tight">
                  {pct(m.mrr.pctAnual)}
                </div>
                <Progress value={m.mrr.pctAnual ?? 0} className="mt-3" />
                <div className="text-xs text-[var(--color-fg-subtle)] mt-2">
                  Bruto {mxn(m.mrr.brutoMxn)} · Neto {mxn(m.mrr.netoMxn)} (
                  {usd(m.mrr.netoUsd)})
                </div>
              </CardBody>
            </Card>
            <div className="md:col-span-2">
              <Tabla>
                <thead className="border-b border-[var(--color-border)]">
                  <tr>
                    <Th>Plan</Th>
                    <Th className="text-right">Mensuales</Th>
                    <Th className="text-right">Anuales</Th>
                    <Th className="text-right">MRR bruto</Th>
                    <Th className="text-right">MRR neto</Th>
                  </tr>
                </thead>
                <tbody>
                  {m.mrr.porPlan.map((p) => (
                    <tr
                      key={p.plan}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <Td className="font-medium">{p.etiqueta}</Td>
                      <Td className="text-right tabular-nums">
                        {NUM.format(p.mensuales)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {NUM.format(p.anuales)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {mxn(p.brutoMxn)}
                      </Td>
                      <Td className="text-right tabular-nums font-medium">
                        {mxn(p.netoMxn)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </div>
          </div>
        )}
      </Seccion>

      {/* ── d) Activación ──────────────────────────────────────────────── */}
      <Seccion
        icono={<ActivityIcon className="h-4 w-4" />}
        titulo="Activación"
        descripcion="Un registro no vale nada; un temario tampoco. La señal real es la primera sección con texto: ahí la persona empezó a escribir su libro de verdad."
      >
        {m.activacion.registrados === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>Aún no hay registros que medir.</SinDatos>
            </CardBody>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <PasoEmbudo
              etiqueta="Registrados"
              valor={m.activacion.registrados}
              porcentaje={100}
              nota="Cuentas creadas"
            />
            <PasoEmbudo
              etiqueta="Con temario generado"
              valor={m.activacion.conTemario}
              porcentaje={m.activacion.pctConTemario}
              nota="Llegaron a ver su libro estructurado"
            />
            <PasoEmbudo
              etiqueta="Activados"
              valor={m.activacion.activados}
              porcentaje={m.activacion.pctActivados}
              nota="Temario + al menos una sección con contenido"
            />
          </div>
        )}
      </Seccion>

      {/* ── e) Producción ──────────────────────────────────────────────── */}
      <Seccion
        icono={<BookCheckIcon className="h-4 w-4" />}
        titulo="Libros y cursos"
        descripcion="Un proyecto cuenta como terminado cuando todas sus secciones o lecciones están marcadas como completas. Es lo único que no se puede fingir sin escribir el libro."
      >
        {m.produccion.proyectos === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>Todavía no se ha creado ningún proyecto.</SinDatos>
            </CardBody>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icono={<BookCheckIcon className="h-4 w-4" />}
              etiqueta="Terminados"
              valor={NUM.format(m.produccion.terminados)}
              nota={`de ${NUM.format(m.produccion.proyectos)} proyectos`}
            />
            <Kpi
              icono={<ActivityIcon className="h-4 w-4" />}
              etiqueta="En progreso"
              valor={NUM.format(m.produccion.enProgreso)}
              nota={`${NUM.format(m.produccion.sinEmpezar)} sin una sola palabra · ${NUM.format(
                m.produccion.archivados
              )} archivados`}
            />
            <Kpi
              icono={<UsersIcon className="h-4 w-4" />}
              etiqueta="Libros / cursos"
              valor={`${NUM.format(m.produccion.libros)} / ${NUM.format(
                m.produccion.cursos
              )}`}
              nota="Reparto por tipo de proyecto"
            />
            <Kpi
              icono={<GaugeIcon className="h-4 w-4" />}
              etiqueta="Palabras escritas"
              valor={NUM.format(m.produccion.palabras)}
              nota="Suma de todo el contenido de todos los proyectos"
            />
          </div>
        )}
      </Seccion>

      {/* ── Suscripciones ──────────────────────────────────────────────── */}
      <Seccion
        icono={<CalendarClockIcon className="h-4 w-4" />}
        titulo="Suscripciones vigentes"
        descripcion="Las que dan acceso hoy. Un cobro fallido (past_due) sigue dando acceso mientras el periodo pagado no venza: es la ventana de reintentos de Stripe, no un regalo."
      >
        {m.suscripciones.length === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>No hay ninguna suscripción vigente.</SinDatos>
            </CardBody>
          </Card>
        ) : (
          <Tabla>
            <thead className="border-b border-[var(--color-border)]">
              <tr>
                <Th>Usuario</Th>
                <Th>Plan</Th>
                <Th>Ciclo</Th>
                <Th>Estado</Th>
                <Th>Fin del periodo</Th>
              </tr>
            </thead>
            <tbody>
              {m.suscripciones.map((s) => (
                <tr
                  key={`${s.email}-${s.periodoFin ?? "s/f"}`}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <Td className="font-medium">{s.email}</Td>
                  <Td>
                    <Badge variant="accent">{s.plan}</Badge>
                  </Td>
                  <Td>{s.ciclo === "anual" ? "anual" : "mensual"}</Td>
                  <Td>
                    <Badge
                      variant={
                        s.estado === "active"
                          ? "success"
                          : s.estado === "trialing"
                            ? "accent"
                            : "warning"
                      }
                    >
                      {s.estado}
                    </Badge>
                  </Td>
                  <Td>
                    {fecha(s.periodoFin)}
                    {s.cancelaAlFin && (
                      <span className="ml-2 text-xs text-[var(--color-danger)]">
                        cancela al terminar
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Seccion>

      {/* ── Últimas llamadas ───────────────────────────────────────────── */}
      <Seccion
        icono={<CoinsIcon className="h-4 w-4" />}
        titulo="Últimas 50 llamadas de IA"
        descripcion="El detalle crudo, para cazar fugas: una acción que dispara más llamadas de las que debería, un prompt que creció sin que nadie lo notara, o caché que dejó de pegar (lectura de caché en 0 cuando debería estar reusando el prefijo)."
      >
        {m.ultimasLlamadas.length === 0 ? (
          <Card>
            <CardBody>
              <SinDatos>
                Sin llamadas registradas todavía. Si la app ya está en uso y esto
                sigue vacío, es que alguna ruta no está llamando a registrarUso().
              </SinDatos>
            </CardBody>
          </Card>
        ) : (
          <Tabla>
            <thead className="border-b border-[var(--color-border)]">
              <tr>
                <Th>Cuándo</Th>
                <Th>Usuario</Th>
                <Th>Acción</Th>
                <Th>Modelo</Th>
                <Th className="text-right">Entrada</Th>
                <Th className="text-right">Caché (lee / escribe)</Th>
                <Th className="text-right">Salida</Th>
                <Th className="text-right">Costo</Th>
              </tr>
            </thead>
            <tbody>
              {m.ultimasLlamadas.map((l, i) => (
                <tr
                  key={`${l.fecha}-${l.email}-${i}`}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <Td className="whitespace-nowrap text-[var(--color-fg-muted)]">
                    {fechaHora(l.fecha)}
                  </Td>
                  <Td>{l.email}</Td>
                  <Td>{etiquetaAccion(l.accion)}</Td>
                  <Td>
                    <Badge variant="muted">{l.modelo}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {NUM.format(l.inputTokens)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {NUM.format(l.cacheReadTokens)} /{" "}
                    {NUM.format(l.cacheWriteTokens)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {NUM.format(l.outputTokens)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    <div>{usd(l.costoUsd)}</div>
                    <div className="text-xs text-[var(--color-fg-subtle)]">
                      {mxn(l.costoMxn, true)}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Seccion>

      <p className="mt-10 text-xs text-[var(--color-fg-subtle)] leading-relaxed max-w-3xl">
        Las cifras en dólares son el costo que cobra Anthropic; las cifras en
        pesos usan {m.tipoCambio} MXN por USD, un supuesto fijo que se edita en
        un solo lugar del código. El mismo JSON de esta página está en{" "}
        <code className="font-mono">/api/admin/metricas</code>.
      </p>
    </div>
  );
}

/* ─────────────────────── SUBCOMPONENTES ──────────────────────────────────── */

function TarjetaMargen({ g }: { g: MargenGrupo }) {
  const negativoP90 = g.margenP90Mxn !== null && g.margenP90Mxn < 0;

  return (
    <Card
      className={
        negativoP90 && g.p90Confiable ? "border-[var(--color-danger)]" : ""
      }
    >
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-lg leading-tight">
              {g.etiqueta}
            </div>
            <div className="text-xs text-[var(--color-fg-subtle)] mt-0.5">
              {g.usuarios === 0
                ? "sin suscriptores"
                : `${g.usuarios} usuario${g.usuarios === 1 ? "" : "s"} de pago`}
            </div>
          </div>
          {g.usuarios > 0 && (
            <Badge variant={g.margenMxn >= 0 ? "success" : "warning"}>
              {g.margenMxn >= 0 ? "margen positivo" : "margen negativo"}
            </Badge>
          )}
        </div>

        {g.usuarios === 0 ? (
          <SinDatos>
            Nadie tiene este plan todavía. No hay margen que calcular.
          </SinDatos>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Punto
                titulo="Usuario mediano (P50)"
                margen={g.margenP50Mxn}
                costo={g.costoP50Mxn}
                confiable={g.p50Confiable}
                aviso={`Con ${g.usuarios} usuario${
                  g.usuarios === 1 ? "" : "s"
                } esto es una anécdota, no una mediana: se necesitan al menos ${MIN_USUARIOS_P50}.`}
              />
              <Punto
                titulo="Usuario intensivo (P90)"
                margen={g.margenP90Mxn}
                costo={g.costoP90Mxn}
                confiable={g.p90Confiable}
                aviso={`Aún no hay datos suficientes para calcular el P90: hacen falta al menos ${MIN_USUARIOS_P90} usuarios de pago y hay ${g.usuarios}.`}
              />
            </div>
            {/* Con decimales para que la resta cuadre a la vista: redondear a
                pesos enteros hacía ver "402 − 6 = 395". */}
            <div className="pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-fg-muted)] leading-relaxed">
              Total del grupo: ingreso neto {mxn(g.ingresoNetoMxn, true)} −
              costo de IA {mxn(g.costoIaMxn, true)} ={" "}
              <span
                className={cn(
                  "font-medium",
                  g.margenMxn >= 0
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                )}
              >
                {mxn(g.margenMxn, true)}
              </span>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Punto({
  titulo,
  margen,
  costo,
  confiable,
  aviso,
}: {
  titulo: string;
  margen: number | null;
  costo: number | null;
  confiable: boolean;
  aviso: string;
}) {
  return (
    <div>
      <div className="text-xs text-[var(--color-fg-muted)]">{titulo}</div>
      {margen === null || costo === null ? (
        <SinDatos>Sin datos.</SinDatos>
      ) : (
        <>
          <div
            className={cn(
              "text-3xl font-semibold mt-1 tracking-tight",
              margen >= 0
                ? "text-[var(--color-fg)]"
                : "text-[var(--color-danger)]"
            )}
          >
            {mxn(margen)}
          </div>
          <div className="text-xs text-[var(--color-fg-subtle)] mt-1">
            le cuesta {mxn(costo, true)} de IA
          </div>
          {!confiable && (
            <div className="text-xs text-[var(--color-warning)] mt-1.5 leading-relaxed">
              {aviso}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PasoEmbudo({
  etiqueta,
  valor,
  porcentaje,
  nota,
}: {
  etiqueta: string;
  valor: number;
  porcentaje: number | null;
  nota: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-[var(--color-fg-muted)]">{etiqueta}</div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-3xl font-semibold tracking-tight">
            {NUM.format(valor)}
          </span>
          <span className="text-sm text-[var(--color-fg-muted)]">
            {pct(porcentaje, 0)}
          </span>
        </div>
        <Progress value={porcentaje ?? 0} className="mt-3" />
        <div className="text-xs text-[var(--color-fg-subtle)] mt-2">{nota}</div>
      </CardBody>
    </Card>
  );
}
