"use client";

import { useEffect, useState, useCallback } from "react";
import {
  XIcon,
  Loader2Icon,
  HistoryIcon,
  SparklesIcon,
  UserIcon,
  PenLineIcon,
  PlusIcon,
  Trash2Icon,
  MoveIcon,
  FileTextIcon,
  RotateCcwIcon,
  Settings2Icon,
  CheckCircleIcon,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";

type ChangeItem = {
  id: string;
  actor: "user" | "ai";
  kind: string;
  nodeId: string | null;
  description: string;
  createdAt: string | number | Date;
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  rename_node: <PenLineIcon className="h-3.5 w-3.5" />,
  update_summary: <PenLineIcon className="h-3.5 w-3.5" />,
  add_node: <PlusIcon className="h-3.5 w-3.5" />,
  delete_node: <Trash2Icon className="h-3.5 w-3.5" />,
  move_node: <MoveIcon className="h-3.5 w-3.5" />,
  append_content: <FileTextIcon className="h-3.5 w-3.5" />,
  replace_content: <FileTextIcon className="h-3.5 w-3.5" />,
  edit_content: <FileTextIcon className="h-3.5 w-3.5" />,
  insert_decoration: <SparklesIcon className="h-3.5 w-3.5" />,
  generate_outline: <SparklesIcon className="h-3.5 w-3.5" />,
  regenerate_outline: <RotateCcwIcon className="h-3.5 w-3.5" />,
  update_settings: <Settings2Icon className="h-3.5 w-3.5" />,
  update_status: <CheckCircleIcon className="h-3.5 w-3.5" />,
};

export function HistoryDrawer({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/changes/${projectId}`);
      if (res.ok) {
        const data = (await res.json()) as { items: ChangeItem[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = groupByDay(items);

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] flex flex-col animate-fade-in">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            <div>
              <div className="font-semibold">Historial de cambios</div>
              <div className="text-xs text-[var(--color-fg-subtle)]">
                Tú y la IA, en orden cronológico
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-bg-muted)] rounded-md"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-sm text-[var(--color-fg-muted)] flex items-center justify-center gap-2">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--color-fg-muted)]">
              Aún no hay cambios registrados.
            </div>
          )}
          {!loading &&
            grouped.map(([dayLabel, dayItems]) => (
              <div key={dayLabel}>
                <div className="px-5 py-2 sticky top-0 bg-[var(--color-bg-elevated)] text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  {dayLabel}
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {dayItems.map((it) => (
                    <ChangeRow key={it.id} item={it} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ChangeRow({ item }: { item: ChangeItem }) {
  const isAI = item.actor === "ai";
  return (
    <div className="px-5 py-3 hover:bg-[var(--color-bg-muted)] flex items-start gap-3">
      <div
        className={`h-7 w-7 rounded-md flex-shrink-0 grid place-items-center ${
          isAI
            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]"
        }`}
      >
        {isAI ? (
          <SparklesIcon className="h-3.5 w-3.5" />
        ) : (
          <UserIcon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{item.description}</div>
        <div className="text-xs text-[var(--color-fg-subtle)] mt-0.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            {KIND_ICONS[item.kind]}
            {labelKind(item.kind)}
          </span>
          <span>·</span>
          <span>{formatRelative(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function labelKind(kind: string): string {
  const map: Record<string, string> = {
    rename_node: "Renombrar",
    update_summary: "Resumen",
    add_node: "Agregar",
    delete_node: "Eliminar",
    move_node: "Mover",
    append_content: "Agregar contenido",
    replace_content: "Reemplazar contenido",
    edit_content: "Editar",
    insert_decoration: "Accesorio",
    generate_outline: "Outline",
    regenerate_outline: "Regenerar outline",
    update_settings: "Configuración",
    update_status: "Estado",
  };
  return map[kind] ?? kind;
}

function groupByDay(items: ChangeItem[]): [string, ChangeItem[]][] {
  const groups: Record<string, ChangeItem[]> = {};
  for (const it of items) {
    const d = new Date(it.createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itDay = new Date(d);
    itDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (today.getTime() - itDay.getTime()) / 86400000
    );
    let label: string;
    if (diffDays === 0) label = "Hoy";
    else if (diffDays === 1) label = "Ayer";
    else if (diffDays < 7) label = `Hace ${diffDays} días`;
    else
      label = d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    if (!groups[label]) groups[label] = [];
    groups[label].push(it);
  }
  return Object.entries(groups);
}
