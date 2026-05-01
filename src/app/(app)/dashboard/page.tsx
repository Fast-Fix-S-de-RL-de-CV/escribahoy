import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, outlineNodes } from "@/lib/schema";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Badge, Progress } from "@/components/ui/card";
import {
  PlusIcon,
  BookOpenIcon,
  GraduationCapIcon,
  FlameIcon,
  PenLineIcon,
  ListChecksIcon,
} from "lucide-react";
import { formatRelative, plural } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  const stats = await Promise.all(
    userProjects.map(async (p) => {
      const nodes = await db
        .select()
        .from(outlineNodes)
        .where(eq(outlineNodes.projectId, p.id));
      const totalWords = nodes.reduce((s, n) => s + (n.wordCount ?? 0), 0);
      const leaves = nodes.filter(
        (n) => n.kind === "section" || n.kind === "lesson"
      );
      const completed = leaves.filter((n) => n.status === "complete").length;
      const total = leaves.length;
      return {
        project: p,
        words: totalWords,
        completed,
        total,
        progress: total > 0 ? (completed / total) * 100 : 0,
      };
    })
  );

  const totalWords = stats.reduce((s, x) => s + x.words, 0);
  const totalSections = stats.reduce((s, x) => s + x.total, 0);
  const totalCompleted = stats.reduce((s, x) => s + x.completed, 0);

  return (
    <AppShell user={user} active="dashboard">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Hola, {user.name.split(" ")[0]}
            </h1>
            <p className="text-[var(--color-fg-muted)] mt-1">
              {userProjects.length === 0
                ? "Empieza tu primer proyecto."
                : "Sigue donde lo dejaste."}
            </p>
          </div>
          <Link href="/onboarding">
            <Button>
              <PlusIcon className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </Link>
        </div>

        {userProjects.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <Kpi
              icon={<PenLineIcon className="h-4 w-4" />}
              label="Palabras escritas"
              value={totalWords.toLocaleString("es-MX")}
              hint={
                userProjects.length > 1
                  ? `en ${userProjects.length} proyectos`
                  : "en este proyecto"
              }
            />
            <Kpi
              icon={<ListChecksIcon className="h-4 w-4" />}
              label="Secciones completadas"
              value={`${totalCompleted}/${totalSections}`}
              hint={
                totalSections
                  ? `${Math.round((totalCompleted / totalSections) * 100)}% del total`
                  : "—"
              }
            />
            <Kpi
              icon={<FlameIcon className="h-4 w-4" />}
              label="Última actividad"
              value={formatRelative(userProjects[0].updatedAt)}
              hint={userProjects[0].title}
            />
          </div>
        )}

        {userProjects.length === 0 ? (
          <Card>
            <CardBody className="text-center py-16">
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] mx-auto mb-4">
                <BookOpenIcon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">Tu primer proyecto te espera</h3>
              <p className="text-[var(--color-fg-muted)] mt-2 max-w-sm mx-auto">
                En menos de 2 minutos vas a tener un outline completo y empezar a
                escribir.
              </p>
              <Link href="/onboarding">
                <Button className="mt-5">
                  <PlusIcon className="h-4 w-4" />
                  Crear proyecto
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {stats.map(({ project, words, completed, total, progress }) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="group"
              >
                <Card className="h-full transition-all group-hover:border-[var(--color-accent)] group-hover:shadow-md">
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-9 w-9 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] flex-shrink-0">
                          {project.type === "book" ? (
                            <BookOpenIcon className="h-4 w-4" />
                          ) : (
                            <GraduationCapIcon className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <Badge variant="muted">
                            {project.type === "book" ? "Libro" : "Curso"}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-xs text-[var(--color-fg-subtle)]">
                        {formatRelative(project.updatedAt)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-lg leading-tight line-clamp-2">
                        {project.title}
                      </div>
                      {project.description && (
                        <p className="text-sm text-[var(--color-fg-muted)] mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-fg-muted)]">
                          {completed}/{total}{" "}
                          {project.type === "book" ? "secciones" : "lecciones"}
                        </span>
                        <span className="font-medium">
                          {plural(words, "palabra", "palabras")}
                        </span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 text-[var(--color-fg-muted)] text-sm">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
        {hint && (
          <div className="text-xs text-[var(--color-fg-subtle)] mt-0.5">
            {hint}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
