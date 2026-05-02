"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  GraduationCapIcon,
  PlusIcon,
  PenLineIcon,
  ListChecksIcon,
  SparklesIcon,
  SendHorizontalIcon,
  PaperclipIcon,
  Trash2Icon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  RotateCcwIcon,
  UploadCloudIcon,
  Settings2Icon,
  HistoryIcon,
  MicIcon,
  MicOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/card";
import { ProjectSettings } from "@/components/project-settings";
import { HistoryDrawer } from "@/components/history-drawer";
import { CircularSpinner } from "@/components/circular-spinner";
import { useDictation } from "@/lib/use-dictation";
import { logoutAction } from "@/lib/actions/auth";
import {
  addNode,
  clearAIHistory,
  deleteNode,
  generateScriptForLesson,
  updateNode,
} from "@/lib/actions/project";
import type {
  OutlineNode,
  Project,
  AIMessage,
  User,
  Suggestion,
} from "@/lib/schema";
import { cn, formatRelative, plural, wordCount } from "@/lib/utils";
import { RichEditor } from "@/components/rich-editor";
import { computeNumbering } from "@/lib/numbering";
import { SuggestionsBox } from "@/components/suggestions-box";
import { getMissingCoreSettings } from "@/lib/project-validation";
import {
  getFormat,
  validatePages,
  estimatedTotalWords,
} from "@/lib/book-formats";
import { CanvasPreview } from "@/components/canvas-preview";
import { AlertTriangleIcon } from "lucide-react";

type KbItem = { id: string; name: string; sizeBytes: number; chars: number };

export function ProjectWorkspace({
  user,
  project,
  nodes: initialNodes,
  kb: initialKb,
  messages: initialMessages,
  suggestions: initialSuggestions,
  initialNodeId,
}: {
  user: User;
  project: Project;
  nodes: OutlineNode[];
  kb: KbItem[];
  messages: AIMessage[];
  suggestions: Suggestion[];
  initialNodeId: string | null;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  const [kb, setKb] = useState(initialKb);
  const [messages, setMessages] = useState(initialMessages);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(initialNodeId);
  const [showKb, setShowKb] = useState(false);

  // Numeración jerárquica calculada — se reajusta cuando cambia el outline.
  const numbering = useMemo(() => computeNumbering(nodes), [nodes]);
  // Sync from server (router.refresh) for suggestions too.
  useEffect(() => setSuggestions(initialSuggestions), [initialSuggestions]);
  // Conteo de sugerencias pendientes por nodo, para mostrar indicador en sidebar.
  const pendingSuggestionsByNode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of suggestions) {
      if (s.status !== "pending") continue;
      map[s.nodeId] = (map[s.nodeId] ?? 0) + 1;
    }
    return map;
  }, [suggestions]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Lock global de operaciones IA — solo una a la vez.
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  // Sync server-side updates back into local state when they come via router.refresh().
  useEffect(() => setNodes(initialNodes), [initialNodes]);

  const missingCore = useMemo(
    () => getMissingCoreSettings(project),
    [project]
  );

  const pagesValidation = useMemo(
    () => validatePages(project.format, project.targetPages),
    [project.format, project.targetPages]
  );
  const pagesWarning =
    !pagesValidation.ok && pagesValidation.severity === "error"
      ? pagesValidation.message
      : null;

  const activeNode = useMemo(
    () => nodes.find((n) => n.id === activeNodeId) ?? null,
    [nodes, activeNodeId]
  );

  // Local KPIs
  const kpis = useMemo(() => {
    const leaves = nodes.filter(
      (n) => n.kind === "section" || n.kind === "lesson"
    );
    const total = leaves.length;
    const completed = leaves.filter((n) => n.status === "complete").length;
    const totalWords = leaves.reduce((s, n) => s + (n.wordCount ?? 0), 0);
    return {
      total,
      completed,
      progress: total ? (completed / total) * 100 : 0,
      words: totalWords,
    };
  }, [nodes]);

  function applyNodeUpdate(id: string, patch: Partial<OutlineNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      <Topbar
        project={project}
        user={user}
        kpis={kpis}
        onOpenKb={() => setShowKb(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
      />
      {pagesWarning && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 text-sm text-red-900 min-w-0">
            <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Formato y páginas incoherentes.</strong> {pagesWarning}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            variant="danger"
          >
            Ajustar
          </Button>
        </div>
      )}
      {missingCore.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 text-sm text-amber-900 min-w-0">
            <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Configura tu proyecto antes de que la IA escriba.</strong>{" "}
              Faltan: {missingCore.join(", ")}.{" "}
              <span className="text-amber-800">
                Sin estos datos, la IA no podrá agregar contenido coherente a
                tus capítulos.
              </span>
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Settings2Icon className="h-3.5 w-3.5" />
            Configurar ahora
          </Button>
        </div>
      )}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr_360px] min-h-0">
        <OutlinePanel
          project={project}
          nodes={nodes}
          numbering={numbering}
          pendingSuggestionsByNode={pendingSuggestionsByNode}
          activeNodeId={activeNodeId}
          onSelect={setActiveNodeId}
          onAddNode={async (parentId, kind) => {
            const titles: Record<string, string> = {
              chapter: "Nuevo capítulo",
              module: "Nuevo módulo",
              section: "Nueva sección",
              lesson: "Nueva lección",
              frontmatter: "Nueva página preliminar",
              backmatter: "Nueva página final",
            };
            const title = titles[kind] ?? "Nuevo nodo";
            const { id } = await addNode({
              projectId: project.id,
              parentId,
              kind,
              title,
            });
            const now = new Date();
            const created: OutlineNode = {
              id,
              projectId: project.id,
              parentId,
              kind,
              title,
              summary: null,
              position: 999,
              status: "empty",
              content: "",
              closingContent: "",
              scriptContent: "",
              wordCount: 0,
              targetWords: kind === "section" ? 800 : kind === "lesson" ? 400 : 0,
              createdAt: now,
              updatedAt: now,
            };
            setNodes((ns) => [...ns, created]);
            if (
              kind === "section" ||
              kind === "lesson" ||
              kind === "frontmatter" ||
              kind === "backmatter"
            )
              setActiveNodeId(id);
          }}
          onDelete={async (id) => {
            await deleteNode({ projectId: project.id, nodeId: id });
            setNodes((ns) => ns.filter((n) => n.id !== id && n.parentId !== id));
            if (activeNodeId === id) setActiveNodeId(null);
          }}
          onRename={async (id, title) => {
            await updateNode({ projectId: project.id, nodeId: id, title });
            applyNodeUpdate(id, { title });
          }}
        />
        <SectionEditor
          project={project}
          node={activeNode}
          allNodes={nodes}
          numbering={numbering}
          suggestions={suggestions}
          aiBusy={aiBusy}
          setAiBusy={setAiBusy}
          onUpdate={(patch) => activeNode && applyNodeUpdate(activeNode.id, patch)}
          onSuggestionsChange={setSuggestions}
          onSelectNode={setActiveNodeId}
        />
        <AIPanel
          project={project}
          activeNode={activeNode}
          messages={messages}
          aiBusy={aiBusy}
          setAiBusy={setAiBusy}
          onMessages={setMessages}
          onOutlineChanged={() => router.refresh()}
        />
      </div>
      {showKb && (
        <KbDrawer
          project={project}
          kb={kb}
          onClose={() => setShowKb(false)}
          onChange={setKb}
        />
      )}
      {showSettings && (
        <ProjectSettings
          project={project}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showHistory && (
        <HistoryDrawer
          projectId={project.id}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

function Topbar({
  project,
  user,
  kpis,
  onOpenKb,
  onOpenSettings,
  onOpenHistory,
}: {
  project: Project;
  user: User;
  kpis: { total: number; completed: number; progress: number; words: number };
  onOpenKb: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="p-2 rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]"
          title="Volver al dashboard"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <span className="h-8 w-8 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)] flex-shrink-0">
          {project.type === "book" ? (
            <BookOpenIcon className="h-4 w-4" />
          ) : (
            <GraduationCapIcon className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <div className="font-semibold leading-tight truncate">
            {project.title}
          </div>
          <div className="text-xs text-[var(--color-fg-subtle)]">
            {project.type === "book" ? "Libro" : "Curso"}
            {(() => {
              const fmt = getFormat(project.format);
              if (!fmt) return null;
              const tw = estimatedTotalWords(project.format, project.targetPages);
              return (
                <>
                  {" · "}
                  <span title={fmt.description}>
                    {fmt.label} · {fmt.widthCm}×{fmt.heightCm}cm
                  </span>
                  {project.targetPages ? (
                    <>
                      {" · "}
                      <span title={tw ? `~${tw.toLocaleString("es-MX")} palabras totales` : ""}>
                        {project.targetPages} pp
                      </span>
                    </>
                  ) : null}
                </>
              );
            })()}
            {" · actualizado "}
            {formatRelative(project.updatedAt)}
          </div>
        </div>
        {(() => {
          const fmt = getFormat(project.format);
          return fmt ? (
            <CanvasPreview
              widthIn={fmt.widthIn}
              heightIn={fmt.heightIn}
              previewHeight={28}
              selected
            />
          ) : null;
        })()}
      </div>
      <div className="hidden lg:flex items-center gap-5 text-sm">
        <KpiInline
          icon={<ListChecksIcon className="h-3.5 w-3.5" />}
          label={`${kpis.completed}/${kpis.total} completas`}
        />
        <KpiInline
          icon={<PenLineIcon className="h-3.5 w-3.5" />}
          label={plural(kpis.words, "palabra", "palabras")}
        />
        <div className="w-32">
          <Progress value={kpis.progress} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenHistory} title="Historial">
          <HistoryIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenKb}>
          <PaperclipIcon className="h-4 w-4" />
          Knowledge base
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenSettings}>
          <Settings2Icon className="h-4 w-4" />
          Configurar
        </Button>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] px-2"
            title={user.email}
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}

function KpiInline({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function OutlinePanel({
  project,
  nodes,
  numbering,
  pendingSuggestionsByNode,
  activeNodeId,
  onSelect,
  onAddNode,
  onDelete,
  onRename,
}: {
  project: Project;
  nodes: OutlineNode[];
  numbering: Record<string, string | null>;
  pendingSuggestionsByNode: Record<string, number>;
  activeNodeId: string | null;
  onSelect: (id: string) => void;
  onAddNode: (
    parentId: string | null,
    kind: "chapter" | "section" | "module" | "lesson" | "frontmatter" | "backmatter"
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
}) {
  const isBook = project.type === "book";
  const parentKind: "chapter" | "module" = isBook ? "chapter" : "module";
  const childKind: "section" | "lesson" = isBook ? "section" : "lesson";

  const front = nodes
    .filter((n) => !n.parentId && n.kind === "frontmatter")
    .sort((a, b) => a.position - b.position);
  const roots = nodes
    .filter((n) => !n.parentId && n.kind === parentKind)
    .sort((a, b) => a.position - b.position);
  const back = nodes
    .filter((n) => !n.parentId && n.kind === "backmatter")
    .sort((a, b) => a.position - b.position);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-y-auto">
      {(front.length > 0 || roots.length === 0) && (
        <>
          <SidebarHeader
            title={isBook ? "Preliminares" : "Introducción"}
            onAdd={() => onAddNode(null, "frontmatter")}
          />
          <div className="px-2 py-1.5 space-y-0.5">
            {front.map((n, i) => (
              <OutlineRow
                key={n.id}
                node={n}
                index={i + 1}
                number={null}
                hasPendingSuggestion={pendingSuggestionsByNode[n.id]}
                isLeaf
                active={activeNodeId === n.id}
                onClick={() => onSelect(n.id)}
                onDelete={() => onDelete(n.id)}
                onRename={(t) => onRename(n.id, t)}
              />
            ))}
          </div>
        </>
      )}

      <SidebarHeader
        title={isBook ? "Capítulos" : "Módulos"}
        onAdd={() => onAddNode(null, parentKind)}
      />
      <div className="p-2 space-y-0.5">
        {roots.length === 0 && (
          <div className="text-sm text-[var(--color-fg-subtle)] p-3 text-center">
            Aún no hay outline. Generalo desde el wizard.
          </div>
        )}
        {roots.map((parent, i) => {
          const kids = nodes
            .filter((n) => n.parentId === parent.id)
            .sort((a, b) => a.position - b.position);
          const isCollapsed = collapsed[parent.id];
          return (
            <div key={parent.id}>
              <OutlineRow
                node={parent}
                index={i + 1}
                number={numbering[parent.id]}
                hasPendingSuggestion={pendingSuggestionsByNode[parent.id]}
                active={activeNodeId === parent.id}
                onClick={() => {
                  onSelect(parent.id);
                  setCollapsed((c) => ({ ...c, [parent.id]: false }));
                }}
                onDelete={() => onDelete(parent.id)}
                onRename={(t) => onRename(parent.id, t)}
                expandable
                collapsed={isCollapsed}
              />
              {!isCollapsed && (
                <div className="ml-4 border-l border-[var(--color-border)] pl-2 mt-0.5 space-y-0.5">
                  {kids.map((kid, ki) => (
                    <OutlineRow
                      key={kid.id}
                      node={kid}
                      index={ki + 1}
                      number={numbering[kid.id]}
                      hasPendingSuggestion={pendingSuggestionsByNode[kid.id]}
                      isLeaf
                      active={activeNodeId === kid.id}
                      onClick={() => onSelect(kid.id)}
                      onDelete={() => onDelete(kid.id)}
                      onRename={(t) => onRename(kid.id, t)}
                    />
                  ))}
                  <button
                    onClick={() => onAddNode(parent.id, childKind)}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] px-2 py-1.5 w-full"
                  >
                    <PlusIcon className="h-3 w-3" />
                    Nueva {childKind === "section" ? "sección" : "lección"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {back.length > 0 && (
        <>
          <SidebarHeader
            title={isBook ? "Cierre" : "Cierre"}
            onAdd={() => onAddNode(null, "backmatter")}
          />
          <div className="px-2 py-1.5 space-y-0.5 mb-3">
            {back.map((n, i) => (
              <OutlineRow
                key={n.id}
                node={n}
                index={i + 1}
                number={null}
                hasPendingSuggestion={pendingSuggestionsByNode[n.id]}
                isLeaf
                active={activeNodeId === n.id}
                onClick={() => onSelect(n.id)}
                onDelete={() => onDelete(n.id)}
                onRename={(t) => onRename(n.id, t)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

function SidebarHeader({
  title,
  onAdd,
}: {
  title: string;
  onAdd?: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-muted)]/40">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {title}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] p-1"
          title="Agregar"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function OutlineRow({
  node,
  index,
  number,
  hasPendingSuggestion,
  active,
  isLeaf,
  expandable,
  collapsed,
  onClick,
  onDelete,
  onRename,
}: {
  node: OutlineNode;
  index: number;
  number?: string | null;
  hasPendingSuggestion?: number;
  active?: boolean;
  isLeaf?: boolean;
  expandable?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  useEffect(() => setDraftTitle(node.title), [node.title]);

  const dot = STATUS_COLORS[node.status] ?? "bg-[var(--color-border-strong)]";

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "hover:bg-[var(--color-bg-muted)]"
      )}
      onClick={(e) => {
        if (editing) return;
        if ((e.target as HTMLElement).closest("[data-no-click]")) return;
        onClick();
      }}
    >
      {expandable ? (
        collapsed ? (
          <ChevronRightIcon className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] flex-shrink-0" />
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] flex-shrink-0" />
        )
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />
      )}
      {editing ? (
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              onRename(draftTitle.trim() || node.title);
            } else if (e.key === "Escape") {
              setDraftTitle(node.title);
              setEditing(false);
            }
          }}
          onBlur={() => {
            setEditing(false);
            if (draftTitle.trim() && draftTitle !== node.title)
              onRename(draftTitle.trim());
          }}
          className="flex-1 bg-transparent border-b border-[var(--color-accent)] outline-none text-sm"
          data-no-click
        />
      ) : (
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
          <span className="text-[var(--color-fg-subtle)] text-xs flex-shrink-0 font-mono">
            {number ?? `${index}.`}
          </span>
          <span
            className={cn(
              "truncate",
              isLeaf ? "font-normal" : "font-medium"
            )}
          >
            {node.title}
          </span>
          {hasPendingSuggestion ? (
            <span
              className="flex-shrink-0 h-4 min-w-4 px-1 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold grid place-items-center"
              title={`${hasPendingSuggestion} sugerencia${hasPendingSuggestion === 1 ? "" : "s"} pendiente${hasPendingSuggestion === 1 ? "" : "s"}`}
            >
              {hasPendingSuggestion}
            </span>
          ) : null}
        </div>
      )}
      {isLeaf && node.wordCount > 0 && (
        <span className="text-xs text-[var(--color-fg-subtle)] flex-shrink-0">
          {node.wordCount}
        </span>
      )}
      <div
        className="opacity-0 group-hover:opacity-100 flex items-center"
        data-no-click
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="p-1 hover:text-[var(--color-fg)] text-[var(--color-fg-subtle)]"
          title="Renombrar"
        >
          <PenLineIcon className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar "${node.title}"?`)) onDelete();
          }}
          className="p-1 hover:text-[var(--color-danger)] text-[var(--color-fg-subtle)]"
          title="Eliminar"
        >
          <Trash2Icon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  empty: "bg-[var(--color-border-strong)]",
  draft: "bg-amber-400",
  in_progress: "bg-[var(--color-accent)]",
  complete: "bg-[var(--color-success)]",
};

function SectionEditor({
  project,
  node,
  allNodes,
  numbering,
  suggestions,
  aiBusy,
  setAiBusy,
  onUpdate,
  onSuggestionsChange,
  onSelectNode,
}: {
  project: Project;
  node: OutlineNode | null;
  allNodes: OutlineNode[];
  numbering: Record<string, string | null>;
  suggestions: Suggestion[];
  aiBusy: string | null;
  setAiBusy: (key: string | null) => void;
  onUpdate: (patch: Partial<OutlineNode>) => void;
  onSuggestionsChange: (next: Suggestion[]) => void;
  onSelectNode: (id: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [redistributing, setRedistributing] = useState(false);
  const [redistributeError, setRedistributeError] = useState<string | null>(null);
  const [showClosing, setShowClosing] = useState(false);
  const isLesson = node?.kind === "lesson";
  const isContainer = node?.kind === "chapter" || node?.kind === "module";
  // Tipos de libro donde el capítulo NO se divide en secciones (todo el
  // contenido va en el cuerpo del cap.).
  const NO_SECTIONS_KINDS = new Set(["novela", "cuentos", "poesia"]);
  const chapterHasNoSections =
    isContainer &&
    project.type === "book" &&
    !!project.kindDetail &&
    NO_SECTIONS_KINDS.has(project.kindDetail);
  // Vista "tipo libro" para capítulos con sub-secciones.
  const isStructuredChapter = isContainer && !chapterHasNoSections;
  const childSections = isStructuredChapter && node
    ? allNodes
        .filter((n) => n.parentId === node.id)
        .sort((a, b) => a.position - b.position)
    : [];
  // Heurística: en un capítulo estructurado con secciones, > 300 palabras en
  // el cuerpo del cap. es síntoma del bug viejo (todo el contenido se metió
  // en el cap. en lugar de distribuirse en las secciones). En novela/cuentos
  // esto NO aplica porque ahí sí va todo en el cuerpo.
  const needsRedistribute =
    isStructuredChapter && node && node.wordCount > 300;

  useEffect(() => {
    setShowClosing(!!node?.closingContent && node.closingContent.trim().length > 0);
  }, [node?.id, node?.closingContent]);

  async function redistributeChapter() {
    if (!node) return;
    if (aiBusy && aiBusy !== "redistribute") return;
    setRedistributing(true);
    setRedistributeError(null);
    setAiBusy("redistribute");
    try {
      const res = await fetch("/api/ai/redistribute-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "no se pudo redistribuir");
      }
      router.refresh();
    } catch (e) {
      setRedistributeError(e instanceof Error ? e.message : "error");
    } finally {
      setRedistributing(false);
      setAiBusy(null);
    }
  }

  function scheduleSave(content: string) {
    if (!node) return;
    onUpdate({ content, wordCount: wordCount(content) });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      startTransition(async () => {
        try {
          await updateNode({
            projectId: project.id,
            nodeId: node.id,
            content,
          });
          setSavedAt(new Date());
        } finally {
          setSaving(false);
        }
      });
    }, 1000);
  }

  function scheduleSaveClosing(closing: string) {
    if (!node) return;
    onUpdate({ closingContent: closing });
    if (closingSaveTimer.current) clearTimeout(closingSaveTimer.current);
    closingSaveTimer.current = setTimeout(() => {
      setSaving(true);
      startTransition(async () => {
        try {
          await updateNode({
            projectId: project.id,
            nodeId: node.id,
            closingContent: closing,
          });
          setSavedAt(new Date());
        } finally {
          setSaving(false);
        }
      });
    }, 1000);
  }

  async function markStatus(status: OutlineNode["status"]) {
    if (!node) return;
    onUpdate({ status });
    await updateNode({
      projectId: project.id,
      nodeId: node.id,
      status,
    });
  }

  async function handleGenerateScript() {
    if (!node) return;
    if (aiBusy && aiBusy !== "script") return;
    setGeneratingScript(true);
    setAiBusy("script");
    try {
      const { script } = await generateScriptForLesson({
        projectId: project.id,
        nodeId: node.id,
      });
      onUpdate({ scriptContent: script });
    } catch (e) {
      alert(e instanceof Error ? e.message : "no se pudo generar el guión");
    } finally {
      setGeneratingScript(false);
      setAiBusy(null);
    }
  }

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-[var(--color-bg)]">
        <div className="h-14 w-14 rounded-full bg-[var(--color-bg-muted)] grid place-items-center text-[var(--color-fg-subtle)] mb-4">
          <BookOpenIcon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold">Selecciona una sección</h3>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-xs">
          Elige una {project.type === "book" ? "sección" : "lección"} del outline
          para empezar a escribir.
        </p>
      </div>
    );
  }

  const targetWords = node.targetWords || (isLesson ? 400 : 800);
  const progressPct = Math.min(100, (node.wordCount / targetWords) * 100);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg)]">
      <div className="px-8 pt-6 pb-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Badge variant="muted">
              {numbering[node.id] && (
                <span className="font-mono mr-1.5">
                  {numbering[node.id]}
                </span>
              )}
              {node.kind === "section"
                ? "Sección"
                : node.kind === "lesson"
                  ? "Lección"
                  : node.kind === "chapter"
                    ? "Capítulo"
                    : node.kind === "module"
                      ? "Módulo"
                      : node.kind === "frontmatter"
                        ? "Preliminar"
                        : "Cierre"}
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight mt-2">
              {node.title}
            </h2>
            {node.summary && (
              <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-xl">
                {node.summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusToggle
              current={node.status}
              onChange={markStatus}
            />
            {isLesson && (
              <Link
                href={`/project/${project.id}/teleprompter/${node.id}`}
                className="inline-flex"
              >
                <Button size="sm" variant="outline">
                  <PlayIcon className="h-3.5 w-3.5" />
                  Teleprompter
                </Button>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-[var(--color-fg-muted)]">
          <div className="flex items-center gap-3">
            <span>
              {node.wordCount} / {targetWords} palabras
            </span>
            <div className="w-32">
              <Progress value={progressPct} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {saving ? (
              <>
                <Loader2Icon className="h-3 w-3 animate-spin" />
                Guardando...
              </>
            ) : savedAt ? (
              <>
                <CheckIcon className="h-3 w-3 text-[var(--color-success)]" />
                Guardado {formatRelative(savedAt)}
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
        {needsRedistribute && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2 text-sm text-amber-900">
              <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">
                  Este capítulo tiene contenido en su cuerpo
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  Un capítulo normalmente solo lleva una intro corta. El
                  contenido largo va en sus secciones ({node.wordCount}{" "}
                  palabras detectadas aquí). Puedo redistribuir tu texto entre
                  las secciones existentes y crear nuevas si hace falta — sin
                  inventar contenido nuevo.
                </p>
                {redistributeError && (
                  <p className="text-xs text-[var(--color-danger)] mt-2">
                    {redistributeError}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={redistributeChapter}
                    disabled={
                      redistributing || (!!aiBusy && aiBusy !== "redistribute")
                    }
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    title={
                      aiBusy && aiBusy !== "redistribute"
                        ? "Espera a que termine la otra acción de IA"
                        : ""
                    }
                  >
                    {redistributing ? (
                      <>
                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                        Redistribuyendo...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-3.5 w-3.5" />
                        Redistribuir en secciones con IA
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <SuggestionsBox
          projectId={project.id}
          nodeId={node.id}
          aiBusy={aiBusy}
          setAiBusy={setAiBusy}
          autoSuggest={
            node.kind === "section" || node.kind === "lesson"
          }
          suggestions={suggestions.filter((s) => s.nodeId === node.id)}
          onApplied={(id) => {
            onSuggestionsChange(
              suggestions.map((s) =>
                s.id === id
                  ? { ...s, status: "applied", appliedAt: new Date() }
                  : s
              )
            );
          }}
          onDismissed={(id) => {
            onSuggestionsChange(
              suggestions.map((s) =>
                s.id === id ? { ...s, status: "dismissed" } : s
              )
            );
          }}
        />

        {isStructuredChapter ? (
          <ChapterStructuredView
            project={project}
            node={node}
            childSections={childSections}
            numbering={numbering}
            showClosing={showClosing}
            onSelectNode={onSelectNode}
            onChangeOpening={scheduleSave}
            onChangeClosing={scheduleSaveClosing}
            onShowClosing={() => setShowClosing(true)}
          />
        ) : (
          <RichEditor
            key={node.id}
            initialHtml={node.content}
            placeholder={
              chapterHasNoSections
                ? `Empieza a escribir tu ${node.kind === "chapter" ? "capítulo" : "módulo"}...`
                : `Empieza a escribir tu ${isLesson ? "lección" : "sección"}... o pídele a Escribahoy que te dé un esqueleto.`
            }
            onChange={scheduleSave}
            aiContext={{ projectId: project.id, nodeId: node.id }}
          />
        )}
      </div>
      {isLesson && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Guión para teleprompter</div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateScript}
              disabled={
                generatingScript ||
                node.wordCount === 0 ||
                (!!aiBusy && aiBusy !== "script")
              }
              title={
                aiBusy && aiBusy !== "script"
                  ? "Espera a que termine la otra acción de IA"
                  : node.wordCount === 0
                    ? "Escribe contenido primero"
                    : ""
              }
            >
              {generatingScript ? (
                <>
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <RotateCcwIcon className="h-3.5 w-3.5" />
                  {node.scriptContent ? "Regenerar" : "Generar"} guión
                </>
              )}
            </Button>
          </div>
          {node.scriptContent ? (
            <pre className="text-sm font-serif whitespace-pre-wrap bg-[var(--color-bg)] rounded-md p-3 max-h-40 overflow-y-auto">
              {node.scriptContent}
            </pre>
          ) : (
            <p className="text-sm text-[var(--color-fg-subtle)]">
              Genera el guión cuando tengas contenido escrito en la lección.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ChapterStructuredView({
  project,
  node,
  childSections,
  numbering,
  showClosing,
  onSelectNode,
  onChangeOpening,
  onChangeClosing,
  onShowClosing,
}: {
  project: Project;
  node: OutlineNode;
  childSections: OutlineNode[];
  numbering: Record<string, string | null>;
  showClosing: boolean;
  onSelectNode: (id: string) => void;
  onChangeOpening: (html: string) => void;
  onChangeClosing: (html: string) => void;
  onShowClosing: () => void;
}) {
  const childKind = node.kind === "chapter" ? "section" : "lesson";
  const totalChildWords = childSections.reduce(
    (s, n) => s + (n.wordCount ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <BookSection
        label="Apertura del capítulo"
        hint="1-3 párrafos para enmarcar el capítulo: un gancho, una historia, una pregunta o un dato. NO el contenido completo."
      >
        <RichEditor
          key={`opening-${node.id}`}
          initialHtml={node.content}
          placeholder="Una idea provocadora que abra el capítulo. Por ejemplo: una historia personal, un dato impactante, una pregunta directa al lector..."
          onChange={onChangeOpening}
          aiContext={{ projectId: project.id, nodeId: node.id }}
        />
      </BookSection>

      <BookSection
        label={`${childKind === "section" ? "Secciones" : "Lecciones"} del capítulo`}
        hint={`Aquí va el desarrollo principal. Cada ${childKind === "section" ? "sección" : "lección"} se edita por separado al hacer click.`}
        right={
          <span className="text-xs text-[var(--color-fg-muted)]">
            {childSections.length} ·{" "}
            {totalChildWords.toLocaleString("es-MX")} palabras
          </span>
        }
      >
        {childSections.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border-strong)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
            Este capítulo aún no tiene{" "}
            {childKind === "section" ? "secciones" : "lecciones"}. Pídele a la
            IA que te genere un esqueleto, o agrégalas desde el sidebar.
          </div>
        ) : (
          <div className="space-y-2">
            {childSections.map((s) => {
              const num = numbering[s.id] ?? "";
              const status = s.status;
              const dot =
                status === "complete"
                  ? "bg-[var(--color-success)]"
                  : status === "in_progress"
                    ? "bg-[var(--color-accent)]"
                    : status === "draft"
                      ? "bg-amber-400"
                      : "bg-[var(--color-border-strong)]";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectNode(s.id)}
                  className="w-full text-left rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-accent)] hover:shadow-sm transition-all p-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--color-fg-subtle)] mb-1">
                        <span className={cn("h-2 w-2 rounded-full", dot)} />
                        <span className="font-mono font-semibold">
                          {num}
                        </span>
                        <span>·</span>
                        <span>{s.wordCount} palabras</span>
                        {s.targetWords > 0 && (
                          <span className="text-[var(--color-fg-subtle)]">
                            / {s.targetWords}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-base leading-tight group-hover:text-[var(--color-accent)]">
                        {s.title}
                      </div>
                      {s.summary && (
                        <p className="text-sm text-[var(--color-fg-muted)] mt-1 line-clamp-2">
                          {s.summary}
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-[var(--color-fg-subtle)] flex-shrink-0 mt-1 group-hover:text-[var(--color-accent)]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </BookSection>

      {showClosing ? (
        <BookSection
          label="Cierre del capítulo"
          hint="1-2 párrafos opcionales de síntesis. Resume los puntos clave o transiciona al próximo capítulo."
        >
          <RichEditor
            key={`closing-${node.id}`}
            initialHtml={node.closingContent ?? ""}
            placeholder="Cierre del capítulo: síntesis y transición al próximo..."
            onChange={onChangeClosing}
            aiContext={{ projectId: project.id, nodeId: node.id }}
          />
        </BookSection>
      ) : (
        <button
          type="button"
          onClick={onShowClosing}
          className="w-full rounded-md border border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] px-4 py-3 text-sm text-[var(--color-fg-muted)] flex items-center justify-center gap-2"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Agregar cierre del capítulo (opcional)
        </button>
      )}
    </div>
  );
}

function BookSection({
  label,
  hint,
  right,
  children,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 pb-2 mb-3 border-b border-[var(--color-border)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            {label}
          </div>
          {hint && (
            <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5 leading-relaxed">
              {hint}
            </p>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const STATUSES: { id: OutlineNode["status"]; label: string }[] = [
  { id: "empty", label: "Vacío" },
  { id: "draft", label: "Borrador" },
  { id: "in_progress", label: "En progreso" },
  { id: "complete", label: "Completo" },
];

function StatusToggle({
  current,
  onChange,
}: {
  current: OutlineNode["status"];
  onChange: (s: OutlineNode["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = STATUSES.find((s) => s.id === current) ?? STATUSES[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]"
      >
        <span
          className={cn("h-2 w-2 rounded-full", STATUS_COLORS[current])}
        />
        {cur.label}
        <ChevronDownIcon className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-md z-10"
          onMouseLeave={() => setOpen(false)}
        >
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--color-bg-muted)] flex items-center gap-2"
            >
              <span
                className={cn("h-2 w-2 rounded-full", STATUS_COLORS[s.id])}
              />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ToolEvent = {
  name: string;
  input?: unknown;
  status: "running" | "ok" | "error";
  error?: string;
};

const TOOL_LABELS: Record<string, string> = {
  rename_node: "Renombrando",
  update_node_summary: "Actualizando resumen",
  add_node: "Agregando al outline",
  delete_node: "Eliminando del outline",
  move_node: "Reordenando",
  append_to_section: "Agregando contenido",
  replace_section_content: "Reemplazando contenido",
  insert_decoration: "Insertando accesorio",
  leave_suggestion: "Dejando idea en el capítulo",
};

function AIPanel({
  project,
  activeNode,
  messages,
  aiBusy,
  setAiBusy,
  onMessages,
  onOutlineChanged,
}: {
  project: Project;
  activeNode: OutlineNode | null;
  messages: AIMessage[];
  aiBusy: string | null;
  setAiBusy: (key: string | null) => void;
  onMessages: (m: AIMessage[]) => void;
  onOutlineChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamTools, setStreamTools] = useState<ToolEvent[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [doneToast, setDoneToast] = useState<string | null>(null);
  const [scope, setScope] = useState<"section" | "global">(
    activeNode ? "section" : "global"
  );
  const dictationBaseRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mapea el language del proyecto al BCP-47 que usa Web Speech API.
  const dictationLang = (() => {
    const lang = project.language ?? "es";
    if (lang === "es") return "es-MX";
    if (lang.includes("-")) return lang;
    return `${lang}-MX`;
  })();

  const dictation = useDictation({
    lang: dictationLang,
    onTranscript: (finalText, interimText) => {
      // Combinamos lo que el usuario YA tenía escrito antes de empezar a
      // dictar (dictationBaseRef) + el final acumulado del dictado + el
      // interim (lo que la IA está oyendo en este momento).
      const sep =
        dictationBaseRef.current && !/\s$/.test(dictationBaseRef.current)
          ? " "
          : "";
      const combined =
        dictationBaseRef.current +
        sep +
        finalText +
        (interimText ? (finalText ? " " : "") + interimText : "");
      setInput(combined);
    },
  });

  // Si el usuario navega a un estado SIN sección activa y estaba en
  // "section", forzar a "global" porque no aplica. Pero NO resetear
  // automáticamente cuando solo cambia de un nodo a otro — respetamos
  // la elección manual del usuario.
  useEffect(() => {
    if (!activeNode && scope === "section") {
      setScope("global");
    }
  }, [activeNode, scope]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText, streamTools]);

  // Tick del timer mientras la IA trabaja.
  useEffect(() => {
    if (!streaming) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [streaming]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!doneToast) return;
    const id = setTimeout(() => setDoneToast(null), 2400);
    return () => clearTimeout(id);
  }, [doneToast]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    if (aiBusy && aiBusy !== "chat") return;
    if (dictation.isListening) dictation.stop();
    setInput("");
    dictationBaseRef.current = "";
    setAiBusy("chat");
    const tempUser: AIMessage = {
      id: "tmp-u-" + Date.now(),
      projectId: project.id,
      nodeId: activeNode?.id ?? null,
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    onMessages([...messages, tempUser]);
    setStreaming(true);
    setStreamText("");
    setStreamTools([]);
    let outlineChanged = false;
    let assistantText = "";
    const toolsLog: ToolEvent[] = [];
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          nodeId: scope === "section" ? activeNode?.id ?? null : null,
          scope,
          message: text,
        }),
      });
      if (!res.ok || !res.body) throw new Error("error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (evt.type === "delta") {
            assistantText += String(evt.text ?? "");
            setStreamText(assistantText);
          } else if (evt.type === "tool") {
            const ev = {
              name: String(evt.name ?? ""),
              input: evt.input,
              status: (evt.status as ToolEvent["status"]) ?? "running",
              error: evt.error ? String(evt.error) : undefined,
            };
            // If a "running" entry exists for the same tool/input, replace; else append.
            const idx = toolsLog.findIndex(
              (t) => t.name === ev.name && t.status === "running"
            );
            if (idx >= 0 && ev.status !== "running") {
              toolsLog[idx] = ev;
            } else {
              toolsLog.push(ev);
            }
            setStreamTools([...toolsLog]);
          } else if (evt.type === "end") {
            outlineChanged = Boolean(evt.outlineChanged);
          } else if (evt.type === "error") {
            assistantText +=
              (assistantText ? "\n\n" : "") +
              `❌ ${evt.error ?? "error en el stream"}`;
            setStreamText(assistantText);
          }
        }
      }
      const finalContent =
        assistantText +
        (toolsLog.length
          ? "\n\n" +
            toolsLog
              .map((t) => {
                const label = TOOL_LABELS[t.name] ?? t.name;
                const status =
                  t.status === "ok" ? "✓" : t.status === "error" ? "✗" : "…";
                return `${status} ${label}${t.error ? ` — ${t.error}` : ""}`;
              })
              .join("\n")
          : "");
      const tempAi: AIMessage = {
        id: "tmp-a-" + Date.now(),
        projectId: project.id,
        nodeId: activeNode?.id ?? null,
        role: "assistant",
        content: finalContent.trim() || "(sin respuesta)",
        createdAt: new Date(),
      };
      onMessages([...messages, tempUser, tempAi]);
      setStreamText("");
      setStreamTools([]);
      const toolsCount = toolsLog.filter((t) => t.status === "ok").length;
      setDoneToast(
        toolsCount > 0
          ? `Listo · ${toolsCount} ${toolsCount === 1 ? "cambio aplicado" : "cambios aplicados"}`
          : `Listo · ${elapsedSeconds}s`
      );
      if (outlineChanged) onOutlineChanged();
    } catch {
      const tempErr: AIMessage = {
        id: "tmp-e-" + Date.now(),
        projectId: project.id,
        nodeId: activeNode?.id ?? null,
        role: "assistant",
        content:
          "❌ No pude responder. Verifica que ANTHROPIC_API_KEY esté configurada en .env.production.",
        createdAt: new Date(),
      };
      onMessages([...messages, tempUser, tempErr]);
    } finally {
      setStreaming(false);
      setAiBusy(null);
    }
  }

  async function handleClear() {
    if (!confirm("¿Borrar todo el historial de chat?")) return;
    await clearAIHistory(project.id);
    onMessages([]);
  }

  const suggestions = activeNode
    ? [
        `Dame un esqueleto de 4 puntos para esta ${
          activeNode.kind === "lesson" ? "lección" : "sección"
        }`,
        "Sugiéreme un gancho de apertura",
        "¿Qué del knowledge base aplica aquí?",
      ]
    : [
        "Dame ideas para el siguiente capítulo",
        "Resume el progreso del proyecto",
        "Genera un glosario inicial",
      ];

  return (
    <aside className="border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)]">
            <SparklesIcon className="h-3.5 w-3.5" />
          </span>
          <div className="text-sm font-semibold">Escribahoy</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] p-1"
            title="Borrar historial"
          >
            <Trash2Icon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streamText && (
          <div className="text-sm text-[var(--color-fg-muted)] space-y-3">
            <p>
              Cuéntame ideas sueltas, pregúntame por el outline o dime en qué
              te ayudo. No escribo capítulos enteros — te ayudo a construirlos.
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md bg-[var(--color-bg-muted)] hover:bg-[var(--color-bg-subtle)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {streaming && !streamText && streamTools.length === 0 && (
          <div className="rounded-lg px-3 py-2.5 animate-fade-in bg-[var(--color-accent-soft)] mr-6">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mb-1">
              Escribahoy
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
              <span className="thinking-dots">
                Pensando<span>.</span><span>.</span><span>.</span>
              </span>
              <span className="text-xs text-[var(--color-fg-subtle)] ml-auto">
                {elapsedSeconds}s
              </span>
            </div>
          </div>
        )}
        {(streamText || streamTools.length > 0) && (
          <div className="rounded-lg px-3 py-2.5 text-sm leading-relaxed animate-fade-in bg-[var(--color-accent-soft)] mr-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
                Escribahoy
              </span>
              {streaming && (
                <span className="text-[10px] text-[var(--color-fg-subtle)] flex items-center gap-1">
                  <CircularSpinner size={10} strokeWidth={3} />
                  {elapsedSeconds}s
                </span>
              )}
            </div>
            {streamText && (
              <div className="whitespace-pre-wrap">
                {streamText}
                {streaming && !streamTools.length && (
                  <span className="inline-block h-3 w-0.5 bg-[var(--color-accent)] ml-0.5 animate-pulse-soft align-middle" />
                )}
              </div>
            )}
            {streamTools.length > 0 && (
              <div className="mt-2 space-y-1">
                {streamTools.map((t, i) => {
                  const label = TOOL_LABELS[t.name] ?? t.name;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]"
                    >
                      {t.status === "running" ? (
                        <CircularSpinner size={12} strokeWidth={3} />
                      ) : t.status === "ok" ? (
                        <CheckIcon className="h-3 w-3 text-[var(--color-success)]" />
                      ) : (
                        <XIcon className="h-3 w-3 text-[var(--color-danger)]" />
                      )}
                      <span>{label}</span>
                      {t.error && (
                        <span className="text-[var(--color-danger)]">
                          — {t.error}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-[var(--color-border)] relative">
        {doneToast && (
          <div
            className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[var(--color-fg)] text-[var(--color-bg)] text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 animate-pop-fade pointer-events-none whitespace-nowrap z-10"
            role="status"
          >
            <CheckIcon className="h-3 w-3" />
            {doneToast}
          </div>
        )}

        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]/30">
          <div className="flex rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-0.5 text-[11px] flex-shrink-0">
            <button
              type="button"
              onClick={() => activeNode && setScope("section")}
              disabled={!activeNode}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                scope === "section"
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              } ${!activeNode ? "opacity-40 cursor-not-allowed" : ""}`}
              title={
                activeNode
                  ? "Las instrucciones solo afectan esta sección"
                  : "Selecciona una sección primero"
              }
            >
              <PenLineIcon className="h-2.5 w-2.5" />
              Esta sección
            </button>
            <button
              type="button"
              onClick={() => setScope("global")}
              className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                scope === "global"
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
              title="La IA puede tocar cualquier parte del proyecto"
            >
              <BookOpenIcon className="h-2.5 w-2.5" />
              Todo el proyecto
            </button>
          </div>
          <div className="text-[11px] text-[var(--color-fg-muted)] truncate min-w-0 flex-1">
            {scope === "section" && activeNode ? (
              <>
                <span className="text-[var(--color-fg-subtle)]">trabajando en:</span>{" "}
                <span className="font-medium text-[var(--color-fg)]">
                  {activeNode.title}
                </span>
              </>
            ) : (
              <span className="text-[var(--color-fg-subtle)]">
                la IA puede editar cualquier capítulo, sección u outline
              </span>
            )}
          </div>
        </div>

        <div className="p-3">
        {dictation.isListening && (
          <div className="mb-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-900">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="font-medium">Escuchando...</span>
            <span className="font-mono text-red-700">
              {dictation.elapsedSeconds}s
            </span>
            <span className="text-red-700/70 ml-auto">
              Habla con calma · click al mic para terminar
            </span>
          </div>
        )}
        {dictation.errorMsg && (
          <div className="mb-2 px-3 py-1.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-900">
            🎤 {dictation.errorMsg}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Si el usuario edita manualmente mientras NO está dictando,
              // actualizamos la base para futuras dictadas.
              if (!dictation.isListening) {
                dictationBaseRef.current = e.target.value;
              }
            }}
            placeholder={
              dictation.isListening
                ? "🎤 Escuchando... habla y voy escribiendo"
                : streaming
                  ? "Generando... puedes ir escribiendo lo siguiente"
                  : "Pregunta o cuéntame una idea..."
            }
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          {dictation.isSupported && (
            <Button
              type="button"
              size="icon"
              variant={dictation.isListening ? "danger" : "outline"}
              onClick={() => {
                if (dictation.isListening) {
                  dictation.stop();
                } else {
                  // Snapshot del input actual como base — el dictado se va
                  // agregando a lo que ya estaba escrito.
                  dictationBaseRef.current = input;
                  dictation.start();
                }
              }}
              disabled={streaming || (!!aiBusy && aiBusy !== "chat")}
              title={
                dictation.isListening
                  ? "Terminar dictado"
                  : "Dictar por voz"
              }
              className={dictation.isListening ? "animate-pulse-soft" : ""}
            >
              {dictation.isListening ? (
                <MicOffIcon className="h-4 w-4" />
              ) : (
                <MicIcon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={
              !input.trim() ||
              streaming ||
              (!!aiBusy && aiBusy !== "chat")
            }
            title={
              streaming
                ? `Escribahoy está trabajando... ${elapsedSeconds}s`
                : aiBusy && aiBusy !== "chat"
                  ? "Espera a que termine la otra acción de IA"
                  : "Enviar"
            }
            className={streaming || aiBusy ? "cursor-wait" : ""}
          >
            {streaming ? (
              <CircularSpinner size={16} className="text-white" />
            ) : (
              <SendHorizontalIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-[var(--color-fg-subtle)] mt-1.5 flex items-center justify-between">
          <span>Enter para enviar · Shift+Enter para nueva línea</span>
          {streaming && (
            <span className="text-[var(--color-accent)] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse-soft" />
              IA trabajando · {elapsedSeconds}s
            </span>
          )}
        </p>
        </div>
      </div>
    </aside>
  );
}

function Message({
  message,
  streaming,
}: {
  message: AIMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm leading-relaxed animate-fade-in",
        isUser
          ? "bg-[var(--color-bg-muted)] ml-6"
          : "bg-[var(--color-accent-soft)] mr-6"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mb-1">
        {isUser ? "Tú" : "Escribahoy"}
      </div>
      <div className="whitespace-pre-wrap">
        {message.content}
        {streaming && (
          <span className="inline-block h-3 w-0.5 bg-[var(--color-accent)] ml-0.5 animate-pulse-soft align-middle" />
        )}
      </div>
    </div>
  );
}

function KbDrawer({
  project,
  kb,
  onClose,
  onChange,
}: {
  project: Project;
  kb: KbItem[];
  onClose: () => void;
  onChange: (kb: KbItem[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("projectId", project.id);
      fd.append("file", file);
      const res = await fetch("/api/kb/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "no se pudo subir");
      }
      const data = (await res.json()) as KbItem;
      onChange([...kb, data]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(id: string) {
    await fetch("/api/kb/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, projectId: project.id }),
    });
    onChange(kb.filter((f) => f.id !== id));
  }

  return (
    <div className="fixed inset-0 z-30 flex">
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      <div className="w-full max-w-md bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] flex flex-col animate-fade-in">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="font-semibold">Knowledge base</div>
            <div className="text-xs text-[var(--color-fg-subtle)]">
              Materiales de referencia para Escribahoy
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-muted)] rounded-md">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <label className="block rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-strong)] hover:border-[var(--color-accent)] cursor-pointer transition-all p-6 text-center">
            <input
              type="file"
              accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.currentTarget.value = "";
              }}
              disabled={uploading}
            />
            <UploadCloudIcon className="h-7 w-7 mx-auto text-[var(--color-fg-subtle)]" />
            <div className="mt-2 font-medium text-sm">
              {uploading ? "Procesando..." : "Subir archivo"}
            </div>
            <div className="text-xs text-[var(--color-fg-subtle)] mt-1">
              PDF · TXT · MD
            </div>
          </label>
          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}
          {kb.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-subtle)] text-center py-6">
              Sin archivos aún.
            </p>
          ) : (
            kb.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-[var(--color-fg-subtle)]">
                    {(f.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                    {(f.chars / 1000).toFixed(1)}k caracteres
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] p-1.5"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
