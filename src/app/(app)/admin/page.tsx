/**
 * /admin — panel financiero del dueño.
 *
 * ── POR QUÉ REDIRIGE Y NO MUESTRA UN 403 ───────────────────────────────────
 * Quien no es super admin se va al dashboard, sin mensaje. Un "403 no tienes
 * permiso" bien pintado le confirma a cualquier usuario curioso que existe un
 * panel con las finanzas del negocio detrás de esta URL, y eso es justo lo que
 * no queremos regalar. Para quien no debe verlo, /admin simplemente no existe.
 *
 * La autorización se hace SIEMPRE en el servidor con esSuperAdmin(): el `role`
 * que viaja en el objeto del usuario sirve para pintar enlaces, no para
 * decidir permisos.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { esSuperAdmin } from "@/lib/subscription";
import { calcularMetricas } from "@/app/api/admin/metricas/route";
import { AppShell } from "@/components/app-shell";
import { PanelAdmin } from "./panel";

// Son cifras de dinero leídas de la base en cada visita: nada de prerender ni
// de caché. Sin esto, Next podría servir el panel de ayer.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Panel del negocio · Escribahoy",
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await esSuperAdmin(user.id))) redirect("/dashboard");

  const metricas = await calcularMetricas();

  return (
    <AppShell user={user}>
      <PanelAdmin metricas={metricas} />
    </AppShell>
  );
}
