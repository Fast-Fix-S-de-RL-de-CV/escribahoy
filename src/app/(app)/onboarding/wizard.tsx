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
import {
  BOOK_FORMATS,
  defaultFormatFor,
  defaultPagesFor,
  validatePages,
  estimatedTotalWords,
  getFormat,
} from "@/lib/book-formats";
import { CanvasPreview } from "@/components/canvas-preview";

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
  const [format, setFormat] = useState<string | null>(null);
  const [targetPages, setTargetPages] = useState<number | null>(null);
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

  // Steps: 0=type, 1=kindDetail, 2=sizeAndPages (book only), 3=titleDesc, 4=audienceTone, 5=kb, 6=generate.
  // For courses, step 2 is skipped automatically.
  const isBookFlow = type === "book";
  const totalSteps = isBookFlow ? 7 : 6;
  const visibleStep = isBookFlow ? step : step >= 2 ? step - 1 : step;
  const progress = ((visibleStep + 1) / totalSteps) * 100;

  function goNext(from: number) {
    if (!isBookFlow && from === 1) setStep(3);
    else setStep(from + 1);
  }
  function goPrev(from: number) {
    if (!isBookFlow && from === 3) setStep(1);
    else setStep(from - 1);
  }

  async function handleCreateAndContinue() {
    if (!type || !title.trim()) return;
    startTransition(async () => {
      try {
        const { id } = await createProject({
          type,
          kindDetail: kindDetail ?? undefined,
          format: format ?? undefined,
          targetPages: targetPages ?? undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          audience: audience.trim() || undefined,
          tone,
          goal: goal.trim() || undefined,
        });
        setProjectId(id);
        // Avanza a KB (step 5 en ambos flujos)
        setStep(5);
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
            onNext={() => goNext(1)}
            nextDisabled={!kindDetail}
          />
        </div>
      )}

      {step === 2 && isBookFlow && (
        <SizeAndPagesStep
          kindDetail={kindDetail}
          format={format}
          targetPages={targetPages}
          setFormat={setFormat}
          setTargetPages={setTargetPages}
          onPrev={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
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
            onPrev={() => goPrev(3)}
            onNext={() => setStep(4)}
            nextDisabled={!title.trim()}
          />
        </div>
      )}

      {step === 4 && (
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
            onPrev={() => setStep(3)}
            onNext={handleCreateAndContinue}
            nextLabel="Continuar"
          />
        </div>
      )}

      {step === 5 && (
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
            onPrev={() => setStep(4)}
            onNext={() => setStep(6)}
            nextLabel={uploads.length ? "Continuar" : "Saltar"}
          />
        </div>
      )}

      {step === 6 && (
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
              {isBookFlow && format && (
                <div>
                  <span className="text-[var(--color-fg-subtle)]">Formato:</span>{" "}
                  {(() => {
                    const f = getFormat(format);
                    return f
                      ? `${f.label} · ${f.widthIn}×${f.heightIn}″ (${f.widthCm}×${f.heightCm}cm)`
                      : format;
                  })()}
                </div>
              )}
              {isBookFlow && targetPages && (
                <div>
                  <span className="text-[var(--color-fg-subtle)]">Extensión:</span>{" "}
                  {targetPages} páginas
                  {(() => {
                    const w = estimatedTotalWords(format, targetPages);
                    return w
                      ? ` · ~${w.toLocaleString("es-MX")} palabras`
                      : "";
                  })()}
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
                onClick={() => setStep(5)}
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

function SizeAndPagesStep({
  kindDetail,
  format,
  targetPages,
  setFormat,
  setTargetPages,
  onPrev,
  onNext,
}: {
  kindDetail: string | null;
  format: string | null;
  targetPages: number | null;
  setFormat: (f: string) => void;
  setTargetPages: (p: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Inicializar con sugerencia automática si está vacío.
  const effectiveFormat = format ?? defaultFormatFor(kindDetail);
  const effectivePages =
    targetPages ?? defaultPagesFor(effectiveFormat);
  const fmt = getFormat(effectiveFormat);
  const validation = validatePages(effectiveFormat, effectivePages);
  const totalWords = estimatedTotalWords(effectiveFormat, effectivePages);

  // Valida si puede continuar: necesita formato y páginas válidas (no error).
  const canContinue =
    !!effectiveFormat &&
    !!effectivePages &&
    (validation.ok || validation.severity !== "error");

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-semibold tracking-tight">
        Tamaño y extensión del libro
      </h1>
      <p className="text-[var(--color-fg-muted)] mt-2">
        Esto es indispensable para que la IA pueda estructurar el libro de forma
        proporcional. Las sugerencias se ajustan al tipo que elegiste.
      </p>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] mb-3">
          Formato físico
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {BOOK_FORMATS.map((f) => {
            const recommended = kindDetail
              ? f.fitsKinds.includes(kindDetail)
              : false;
            const selected = effectiveFormat === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`text-left rounded-md border p-3 transition-all ${
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CanvasPreview
                    widthIn={f.widthIn}
                    heightIn={f.heightIn}
                    previewHeight={44}
                    selected={selected}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{f.label}</div>
                      {recommended && !selected && (
                        <span className="text-[10px] text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 rounded">
                          recomendado
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
                      {f.widthIn}×{f.heightIn}″ · {f.widthCm}×{f.heightCm}cm ·{" "}
                      {f.widthMm}×{f.heightMm}mm
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
                      Ideal: {f.pageSweetMin}–{f.pageSweetMax} páginas
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {fmt && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] mb-3">
            Páginas objetivo
          </div>
          <div className="bg-[var(--color-bg-muted)] rounded-md p-4">
            <p className="text-sm text-[var(--color-fg-muted)] mb-3">
              {fmt.label} acepta entre <strong>{fmt.pageMin}</strong> y{" "}
              <strong>{fmt.pageMax}</strong> páginas. Lo ideal está entre{" "}
              <strong>{fmt.pageSweetMin}</strong> y{" "}
              <strong>{fmt.pageSweetMax}</strong>.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={fmt.pageMin}
                max={fmt.pageMax}
                step={5}
                value={effectivePages}
                onChange={(e) => setTargetPages(Number(e.target.value))}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <input
                type="number"
                min={fmt.pageMin}
                max={fmt.pageMax}
                value={effectivePages}
                onChange={(e) => setTargetPages(Number(e.target.value))}
                className="h-9 w-20 rounded-md border border-[var(--color-border)] px-2 text-sm bg-[var(--color-bg-elevated)] text-center"
              />
              <span className="text-sm text-[var(--color-fg-muted)]">
                páginas
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-[var(--color-fg-subtle)]">
                {fmt.pageMin}
              </span>
              <span className="text-[var(--color-fg-subtle)]">
                {fmt.pageMax}
              </span>
            </div>

            {totalWords && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
                    Total estimado
                  </div>
                  <div className="font-semibold">
                    ~{totalWords.toLocaleString("es-MX")} palabras
                  </div>
                  <div className="text-[11px] text-[var(--color-fg-subtle)]">
                    {fmt.wordsPerPage} palabras/página
                  </div>
                </div>
                <div className="rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
                    Tiempo de escritura
                  </div>
                  <div className="font-semibold">
                    {estimateMonths(totalWords)} meses
                  </div>
                  <div className="text-[11px] text-[var(--color-fg-subtle)]">
                    a 500 palabras/día
                  </div>
                </div>
              </div>
            )}

            {!validation.ok && (
              <div
                className={`mt-3 text-xs rounded-md px-3 py-2 ${
                  validation.severity === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {validation.severity === "error" ? "⚠ " : "ℹ "}
                {validation.message}
              </div>
            )}
          </div>
        </div>
      )}

      <Footer
        onPrev={onPrev}
        onNext={() => {
          // Aplicar defaults al pasar al siguiente paso si nada se tocó.
          if (!format) setFormat(effectiveFormat);
          if (!targetPages) setTargetPages(effectivePages);
          onNext();
        }}
        nextDisabled={!canContinue}
      />
    </div>
  );
}

function estimateMonths(totalWords: number): string {
  const days = totalWords / 500;
  const months = days / 22; // ~22 días hábiles
  if (months < 1) return "<1";
  if (months < 12) return months.toFixed(1).replace(/\.0$/, "");
  return Math.round(months).toString();
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
