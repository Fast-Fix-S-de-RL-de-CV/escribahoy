"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  Loader2Icon,
  SparklesIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import {
  updateProject,
  generateOutlineForProject,
} from "@/lib/actions/project";
import { BOOK_KINDS, COURSE_KINDS } from "@/lib/project-kinds";
import type { Project } from "@/lib/schema";

const TONES = ["directo", "narrativo", "academico", "conversacional"];
const PERSPECTIVES = [
  { id: "primera-singular", label: "1ª persona (yo)" },
  { id: "primera-plural", label: "1ª persona plural (nosotros)" },
  { id: "segunda", label: "2ª persona (tú/usted al lector)" },
  { id: "tercera", label: "3ª persona (él/ella/objetiva)" },
];
const FORMALITIES = [
  { id: "tu", label: "Tú (informal)" },
  { id: "usted", label: "Usted (formal)" },
  { id: "vos", label: "Vos (rioplatense)" },
];
const LANGUAGES = [
  { id: "es", label: "Español neutro" },
  { id: "es-MX", label: "Español de México" },
  { id: "es-ES", label: "Español de España" },
  { id: "es-AR", label: "Español de Argentina" },
  { id: "es-CO", label: "Español de Colombia" },
];

export function ProjectSettings({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegenWarning, setShowRegenWarning] = useState(false);

  const [form, setForm] = useState({
    title: project.title,
    subtitle: project.subtitle ?? "",
    description: project.description ?? "",
    kindDetail: project.kindDetail ?? "",
    audience: project.audience ?? "",
    tone: project.tone ?? "",
    goal: project.goal ?? "",
    language: project.language ?? "es",
    perspective: project.perspective ?? "",
    formality: project.formality ?? "",
    styleNotes: project.styleNotes ?? "",
    glossary: project.glossary ?? "",
    avoidTerms: project.avoidTerms ?? "",
  });

  const isBook = project.type === "book";
  const KINDS = isBook ? BOOK_KINDS : COURSE_KINDS;

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateProject({
          id: project.id,
          title: form.title || undefined,
          subtitle: form.subtitle || null,
          description: form.description || null,
          kindDetail: form.kindDetail || undefined,
          audience: form.audience || null,
          tone: form.tone || null,
          goal: form.goal || null,
          language: form.language || undefined,
          perspective: form.perspective || null,
          formality: form.formality || null,
          styleNotes: form.styleNotes || null,
          glossary: form.glossary || null,
          avoidTerms: form.avoidTerms || null,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "no se pudo guardar");
      }
    });
  }

  async function handleRegenerate() {
    setError(null);
    setRegenerating(true);
    try {
      // Save first so the new context applies.
      await updateProject({
        id: project.id,
        title: form.title || undefined,
        subtitle: form.subtitle || null,
        description: form.description || null,
        kindDetail: form.kindDetail || undefined,
        audience: form.audience || null,
        tone: form.tone || null,
        goal: form.goal || null,
        language: form.language || undefined,
        perspective: form.perspective || null,
        formality: form.formality || null,
        styleNotes: form.styleNotes || null,
        glossary: form.glossary || null,
        avoidTerms: form.avoidTerms || null,
      });
      await generateOutlineForProject(project.id);
      router.refresh();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "no se pudo regenerar el outline"
      );
    } finally {
      setRegenerating(false);
      setShowRegenWarning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] flex flex-col animate-fade-in">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="font-semibold">Configuración del proyecto</div>
            <div className="text-xs text-[var(--color-fg-subtle)]">
              {isBook ? "Libro" : "Curso"} ·{" "}
              {KINDS.find((k) => k.id === form.kindDetail)?.label ?? "sin tipo"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-bg-muted)] rounded-md"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Section title="Esencial">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>
            <div>
              <Label>Subtítulo (opcional)</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => update("subtitle", e.target.value)}
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          </Section>

          <Section
            title={`Tipo de ${isBook ? "libro" : "curso"}`}
            help="Pasa el cursor sobre cada opción para ver la descripción y autores famosos del género."
          >
            <div className="space-y-2">
              {KINDS.map((k) => {
                const selected = form.kindDetail === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => update("kindDetail", k.id)}
                    title={`${k.desc}\n\n${k.examples}`}
                    className={`w-full text-left rounded-md border p-3 transition-all ${
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <div
                      className={`text-sm font-medium flex items-center gap-2 ${
                        selected ? "text-[var(--color-accent)]" : ""
                      }`}
                    >
                      {selected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                      )}
                      {k.label}
                    </div>
                    {selected ? (
                      <>
                        <div className="text-xs text-[var(--color-fg-muted)] mt-1 leading-relaxed">
                          {k.desc}
                        </div>
                        <div className="text-[11px] text-[var(--color-fg-subtle)] mt-1 italic">
                          {k.examples}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-[var(--color-fg-subtle)] mt-1 line-clamp-1">
                        {k.examples}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {form.kindDetail !== (project.kindDetail ?? "") && (
              <p className="text-xs text-[var(--color-warning)] mt-2 flex items-start gap-1.5">
                <AlertTriangleIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                Cambiaste el tipo. Considera regenerar el outline para que la
                estructura coincida con el nuevo formato.
              </p>
            )}
          </Section>

          <Section title="Audiencia y tono">
            <div>
              <Label>Audiencia</Label>
              <Input
                value={form.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="Ej: Estudiantes universitarios de marketing"
              />
            </div>
            <div>
              <Label>Tono</Label>
              <select
                value={form.tone}
                onChange={(e) => update("tone", e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
              >
                <option value="">— elegir —</option>
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Meta del proyecto</Label>
              <Input
                value={form.goal}
                onChange={(e) => update("goal", e.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Estilo avanzado"
            help="Opciones para escritores experimentados. Todo es opcional."
          >
            <div>
              <Label>Variante del español</Label>
              <select
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Persona / punto de vista</Label>
              <select
                value={form.perspective}
                onChange={(e) => update("perspective", e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
              >
                <option value="">— sin preferencia —</option>
                {PERSPECTIVES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Trato al lector</Label>
              <select
                value={form.formality}
                onChange={(e) => update("formality", e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
              >
                <option value="">— sin preferencia —</option>
                {FORMALITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notas de estilo libre</Label>
              <Textarea
                rows={3}
                value={form.styleNotes}
                onChange={(e) => update("styleNotes", e.target.value)}
                placeholder="Ej: Frases cortas. Sin clichés corporativos. Usar metáforas náuticas."
              />
            </div>
            <div>
              <Label>Glosario obligatorio</Label>
              <Textarea
                rows={3}
                value={form.glossary}
                onChange={(e) => update("glossary", e.target.value)}
                placeholder="Términos exactos y su forma correcta. Ej: Lighthouse (no faro), funnel (no embudo), CAC siempre en mayúsculas."
              />
            </div>
            <div>
              <Label>Términos a evitar</Label>
              <Textarea
                rows={2}
                value={form.avoidTerms}
                onChange={(e) => update("avoidTerms", e.target.value)}
                placeholder="Ej: AIDA, PAS, lead magnet, upsell, sinergia, holístico, disruptivo."
              />
            </div>
          </Section>

          <Section title="Outline">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Si modificaste el tipo, audiencia, tono o glosario y quieres que
              el outline refleje esos cambios, regéneralo.
            </p>
            <div className="bg-amber-50 text-amber-800 rounded-md p-3 text-xs flex items-start gap-2">
              <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Cuidado:</strong> regenerar el outline reemplaza todos
                los capítulos y sus secciones. <strong>Se borra el contenido
                escrito</strong> en cada sección. Asegúrate de tener respaldo si
                ya escribiste mucho.
              </span>
            </div>
            {!showRegenWarning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenWarning(true)}
                disabled={regenerating}
              >
                <SparklesIcon className="h-4 w-4" /> Regenerar outline
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <>
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                      Regenerando...
                    </>
                  ) : (
                    "Sí, regenerar y borrar lo escrito"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRegenWarning(false)}
                  disabled={regenerating}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </Section>
        </div>

        <div className="border-t border-[var(--color-border)] px-5 py-3 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          ) : (
            <Badge variant="muted">Cambios guardados al confirmar</Badge>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              {pending ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] mb-3">
        {title}
      </div>
      {help && (
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">{help}</p>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
