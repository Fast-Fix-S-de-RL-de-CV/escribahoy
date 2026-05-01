"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  UploadCloudIcon,
  SparklesIcon,
  CheckCircle2Icon,
  Loader2Icon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardBody, Progress } from "@/components/ui/card";
import {
  createProject,
  generateOutlineForProject,
} from "@/lib/actions/project";
import { BOOK_KINDS, COURSE_KINDS } from "@/lib/project-kinds";

type ProjectType = "book" | "course";
type Tone = "directo" | "narrativo" | "academico" | "conversacional";

type UploadedFile = {
  id: string;
  name: string;
  sizeBytes: number;
  chars: number;
};

const TONES: { id: Tone; label: string; desc: string }[] = [
  { id: "directo", label: "Directo y claro", desc: "Sin rodeos, accionable" },
  { id: "narrativo", label: "Narrativo", desc: "Con historias y ejemplos" },
  { id: "academico", label: "Académico", desc: "Riguroso y citado" },
  {
    id: "conversacional",
    label: "Conversacional",
    desc: "Como charla con el lector",
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ProjectType | null>(null);
  const [kindDetail, setKindDetail] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<Tone>("directo");
  const [goal, setGoal] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;

  async function handleCreateAndContinue() {
    if (!type || !title.trim()) return;
    startTransition(async () => {
      try {
        const { id } = await createProject({
          type,
          kindDetail: kindDetail ?? undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          audience: audience.trim() || undefined,
          tone,
          goal: goal.trim() || undefined,
        });
        setProjectId(id);
        setStep(4);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function handleUpload(file: File) {
    if (!projectId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await fetch("/api/kb/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "no se pudo subir");
      }
      const data = (await res.json()) as UploadedFile;
      setUploads((u) => [...u, data]);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveUpload(id: string) {
    if (!projectId) return;
    await fetch("/api/kb/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, projectId }),
    });
    setUploads((u) => u.filter((f) => f.id !== id));
  }

  async function handleGenerateOutline() {
    if (!projectId) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      await generateOutlineForProject(projectId);
      router.push(`/project/${projectId}`);
    } catch (e) {
      setGenerationError(
        e instanceof Error
          ? e.message
          : "Algo falló generando el outline. Verifica tu API key."
      );
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Progress value={progress} />
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2">
          Paso {step + 1} de {totalSteps}
        </p>
      </div>

      {step === 0 && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">
            ¿Qué vas a crear?
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-2">
            Esto define cómo Escribahoy estructura tu proyecto.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <TypeCard
              icon={<BookOpenIcon className="h-6 w-6" />}
              title="Un libro"
              desc="Capítulos, secciones, glosario"
              selected={type === "book"}
              onClick={() => {
                setType("book");
                setKindDetail(null);
              }}
            />
            <TypeCard
              icon={<GraduationCapIcon className="h-6 w-6" />}
              title="Un curso"
              desc="Módulos, lecciones, guiones para teleprompter"
              selected={type === "course"}
              onClick={() => {
                setType("course");
                setKindDetail(null);
              }}
            />
          </div>
          <Footer
            onNext={() => setStep(1)}
            nextDisabled={!type}
          />
        </div>
      )}

      {step === 1 && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">
            ¿Qué tipo de {type === "book" ? "libro" : "curso"}?
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-2">
            Cada formato tiene su estructura. Esto guía cómo la IA arma tu
            outline.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {(type === "book" ? BOOK_KINDS : COURSE_KINDS).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKindDetail(k.id)}
                className={`text-left rounded-[var(--radius-md)] border p-3 transition-all ${
                  kindDetail === k.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div className="font-medium text-sm">{k.label}</div>
                <div className="text-xs text-[var(--color-fg-muted)] mt-1 leading-relaxed">
                  {k.desc}
                </div>
                <div className="text-[11px] text-[var(--color-fg-subtle)] mt-1.5 italic leading-snug">
                  {k.examples}
                </div>
              </button>
            ))}
          </div>
          <Footer
            onPrev={() => setStep(0)}
            onNext={() => setStep(2)}
            nextDisabled={!kindDetail}
          />
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">
            Cuéntame de tu {type === "book" ? "libro" : "curso"}
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-2">
            Lo básico, después lo refinamos juntos.
          </p>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Título de trabajo</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "book"
                    ? "Ej: El método del 1%"
                    : "Ej: Marketing para fundadores no marketeros"
                }
                autoFocus
              />
            </div>
            <div>
              <Label>De qué trata (1-3 frases)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="La idea central, el problema que resuelve, lo que el lector se llevará."
                rows={4}
              />
            </div>
            <div>
              <Label>Meta del proyecto (opcional)</Label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ej: Publicar en 6 meses, vender 500 copias..."
              />
            </div>
          </div>
          <Footer
            onPrev={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={!title.trim()}
          />
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">
            ¿Para quién y con qué tono?
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-2">
            Esto guía a la IA para sugerir y organizar.
          </p>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Audiencia</Label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: Fundadores en etapa temprana sin experiencia en producto"
              />
            </div>
            <div>
              <Label>Tono</Label>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`text-left rounded-[var(--radius-md)] border p-3 transition-all ${
                      tone === t.id
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Footer
            onPrev={() => setStep(2)}
            onNext={handleCreateAndContinue}
            nextLabel="Continuar"
          />
        </div>
      )}

      {step === 4 && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">
            Knowledge base inicial
          </h1>
          <p className="text-[var(--color-fg-muted)] mt-2">
            Sube PDFs, notas, transcripciones. La IA los usará para sugerirte
            estructura y referencias. Puedes saltarte este paso.
          </p>
          <div className="mt-6">
            <FileDropZone
              onFile={handleUpload}
              uploading={uploading}
            />
            {uploadError && (
              <p className="text-sm text-[var(--color-danger)] mt-2">
                {uploadError}
              </p>
            )}
            <div className="space-y-2 mt-4">
              {uploads.map((f) => (
                <Card key={f.id}>
                  <CardBody className="flex items-center justify-between !py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)]">
                        <CheckCircle2Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {f.name}
                        </div>
                        <div className="text-xs text-[var(--color-fg-subtle)]">
                          {(f.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                          {(f.chars / 1000).toFixed(1)}k caracteres extraídos
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveUpload(f.id)}
                      className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] p-2"
                      type="button"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
          <Footer
            onPrev={() => setStep(3)}
            onNext={() => setStep(5)}
            nextLabel={uploads.length ? "Continuar" : "Saltar"}
          />
        </div>
      )}

      {step === 5 && (
        <div className="animate-fade-in">
          <div className="text-center max-w-xl mx-auto">
            <div className="h-14 w-14 rounded-full bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] mx-auto mb-5">
              <SparklesIcon className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Listos para generar tu outline
            </h1>
            <p className="text-[var(--color-fg-muted)] mt-3">
              Voy a crear todo el temario de tu {type === "book" ? "libro" : "curso"}.
              Después tú vas escribiendo cada parte y yo te ayudo a organizar.
            </p>
            <div className="mt-6 text-left bg-[var(--color-bg-muted)] rounded-[var(--radius-md)] p-4 text-sm space-y-1">
              <div>
                <span className="text-[var(--color-fg-subtle)]">Título:</span>{" "}
                <strong>{title}</strong>
              </div>
              {kindDetail && (
                <div>
                  <span className="text-[var(--color-fg-subtle)]">Tipo:</span>{" "}
                  {(type === "book" ? BOOK_KINDS : COURSE_KINDS).find(
                    (k) => k.id === kindDetail
                  )?.label}
                </div>
              )}
              {audience && (
                <div>
                  <span className="text-[var(--color-fg-subtle)]">Audiencia:</span>{" "}
                  {audience}
                </div>
              )}
              <div>
                <span className="text-[var(--color-fg-subtle)]">Tono:</span> {tone}
              </div>
              <div>
                <span className="text-[var(--color-fg-subtle)]">KB:</span>{" "}
                {uploads.length
                  ? `${uploads.length} archivo(s)`
                  : "ninguno (lo puedes agregar después)"}
              </div>
            </div>
            {generationError && (
              <p className="text-sm text-[var(--color-danger)] mt-4">
                {generationError}
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                disabled={generating}
              >
                <ArrowLeftIcon className="h-4 w-4" /> Atrás
              </Button>
              <Button
                size="lg"
                onClick={handleGenerateOutline}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Generando outline...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generar outline con IA
                  </>
                )}
              </Button>
            </div>
            {generating && (
              <p className="text-xs text-[var(--color-fg-subtle)] mt-3">
                Esto puede tardar 20-40 segundos. No cierres la ventana.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeCard({
  icon,
  title,
  desc,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[var(--radius-lg)] border-2 p-5 transition-all ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      <div
        className={`h-10 w-10 rounded-md grid place-items-center mb-3 ${
          selected
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-bg-muted)] text-[var(--color-fg)]"
        }`}
      >
        {icon}
      </div>
      <div className="font-semibold text-lg">{title}</div>
      <div className="text-sm text-[var(--color-fg-muted)] mt-1">{desc}</div>
    </button>
  );
}

function Footer({
  onPrev,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
}: {
  onPrev?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onPrev ? (
        <Button variant="ghost" onClick={onPrev}>
          <ArrowLeftIcon className="h-4 w-4" /> Atrás
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function FileDropZone({
  onFile,
  uploading,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`block rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-all px-6 py-10 text-center ${
        hover
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]"
      }`}
    >
      <input
        type="file"
        accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
        disabled={uploading}
      />
      <UploadCloudIcon className="h-8 w-8 mx-auto text-[var(--color-fg-subtle)]" />
      <div className="mt-3 font-medium">
        {uploading ? "Procesando..." : "Suelta un archivo o haz clic"}
      </div>
      <div className="text-sm text-[var(--color-fg-subtle)] mt-1">
        PDF, TXT o Markdown · hasta 12 MB
      </div>
    </label>
  );
}
