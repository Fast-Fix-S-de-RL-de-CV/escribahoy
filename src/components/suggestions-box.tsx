"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LightbulbIcon,
  SparklesIcon,
  XIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { CircularSpinner } from "@/components/circular-spinner";
import { formatRelative } from "@/lib/utils";
import type { Suggestion } from "@/lib/schema";

export function SuggestionsBox({
  projectId,
  nodeId,
  autoSuggest,
  aiBusy,
  setAiBusy,
  suggestions,
  onApplied,
  onDismissed,
}: {
  projectId: string;
  nodeId?: string;
  autoSuggest?: boolean;
  aiBusy?: string | null;
  setAiBusy?: (key: string | null) => void;
  suggestions: Suggestion[];
  onApplied: (
    suggestionId: string,
    summary: string,
    mode: "chapter" | "section"
  ) => void;
  onDismissed: (suggestionId: string) => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const autoGenAttemptedFor = useRef<Set<string>>(new Set());

  const pending = suggestions.filter((s) => s.status === "pending");
  const applied = suggestions.filter((s) => s.status === "applied");
  const dismissed = suggestions.filter((s) => s.status === "dismissed");

  // Auto-genera una sugerencia al entrar a una sección sin sugerencias.
  // No dispara si ya hay otra operación de IA corriendo.
  useEffect(() => {
    if (!autoSuggest || !nodeId) return;
    if (autoGenAttemptedFor.current.has(nodeId)) return;
    if (
      pending.length > 0 ||
      applied.length > 0 ||
      dismissed.length > 0 ||
      autoGenerating
    )
      return;
    if (aiBusy && aiBusy !== "auto-suggest") return;
    autoGenAttemptedFor.current.add(nodeId);
    setAutoGenerating(true);
    setAiBusy?.("auto-suggest");
    fetch("/api/ai/auto-suggest-section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(j.error ?? "no se pudo generar");
        }
        router.refresh();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "error");
      })
      .finally(() => {
        setAutoGenerating(false);
        setAiBusy?.(null);
      });
  }, [
    autoSuggest,
    nodeId,
    pending.length,
    applied.length,
    dismissed.length,
    autoGenerating,
    aiBusy,
    setAiBusy,
    router,
  ]);

  if (
    pending.length === 0 &&
    applied.length === 0 &&
    !autoGenerating
  )
    return null;

  async function executeSuggestion(s: Suggestion) {
    if (aiBusy && aiBusy !== "apply-suggestion") return;
    setRunning(s.id);
    setError(null);
    setLastSummary(null);
    setAiBusy?.("apply-suggestion");
    try {
      const res = await fetch("/api/ai/apply-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: s.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "no se pudo ejecutar");
      }
      const data = (await res.json()) as {
        summary?: string;
        mode?: "chapter" | "section";
      };
      onApplied(s.id, data.summary ?? "", data.mode ?? "section");
      setLastSummary(data.summary ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setRunning(null);
      setAiBusy?.(null);
    }
  }

  async function dismissSuggestion(s: Suggestion) {
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, status: "dismissed" }),
      });
      // Solo actualizamos el cliente si el server confirmó; antes un res.ok
      // false dejaba la sugerencia 'descartada' en cliente y 'pending' en
      // servidor (estado divergente).
      if (!res.ok) throw new Error("no se pudo descartar");
      onDismissed(s.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "no se pudo descartar");
    }
  }

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent-soft)] to-transparent overflow-hidden">
      <div
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="h-6 w-6 rounded-md bg-[var(--color-accent)] grid place-items-center text-white">
            <LightbulbIcon className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-[var(--color-accent)]">
            Sugerencias de Escribahoy
          </span>
          {pending.length > 0 && (
            <span className="text-xs bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 font-semibold">
              {pending.length}
            </span>
          )}
          {autoGenerating && pending.length === 0 && (
            <span className="text-xs text-[var(--color-fg-muted)] flex items-center gap-1">
              <CircularSpinner size={10} className="text-[var(--color-accent)]" />
              preparando...
            </span>
          )}
          {applied.length > 0 && (
            <span className="text-xs text-[var(--color-fg-subtle)]">
              · {applied.length} aplicada{applied.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <button className="text-[var(--color-fg-muted)] p-1">
          {collapsed ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronUpIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {autoGenerating && pending.length === 0 && (
            <div className="bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border)] p-3 flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
              <CircularSpinner
                size={14}
                className="text-[var(--color-accent)]"
              />
              <span>
                Escribahoy está preparando una sugerencia para esta sección...
              </span>
            </div>
          )}
          {pending.map((s) => (
            <div
              key={s.id}
              className="bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border)] p-3"
            >
              <div className="text-xs text-[var(--color-fg-subtle)] mb-1.5 flex items-center gap-2">
                <SparklesIcon className="h-3 w-3 text-[var(--color-accent)]" />
                <span>Idea pendiente · {formatRelative(s.createdAt)}</span>
              </div>
              <div className="text-sm text-[var(--color-fg)] whitespace-pre-wrap leading-relaxed">
                {s.content}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => executeSuggestion(s)}
                  disabled={
                    running !== null ||
                    (!!aiBusy && aiBusy !== "apply-suggestion")
                  }
                  title={
                    aiBusy && aiBusy !== "apply-suggestion"
                      ? "Espera a que termine la otra acción de IA"
                      : ""
                  }
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running === s.id ? (
                    <>
                      <CircularSpinner size={12} className="text-white" />
                      Desarrollando capítulo...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-3 w-3" />
                      Ejecutar sugerencia con IA
                    </>
                  )}
                </button>
                <button
                  onClick={() => dismissSuggestion(s)}
                  disabled={running !== null || !!aiBusy}
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] px-2 h-8 rounded-md hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
                >
                  <XIcon className="h-3 w-3" />
                  Descartar
                </button>
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {lastSummary && (
            <div className="text-sm bg-green-50 border border-green-200 text-green-900 rounded-md px-3 py-2 flex items-start gap-2">
              <CheckCircle2Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Sugerencia ejecutada</div>
                <div className="text-xs mt-0.5">{lastSummary}</div>
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] py-1">
                Ver {applied.length} idea{applied.length === 1 ? "" : "s"}{" "}
                aplicada{applied.length === 1 ? "" : "s"}
              </summary>
              <div className="space-y-1.5 mt-1">
                {applied.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[var(--color-bg-muted)]/50 rounded-md border border-[var(--color-border)] p-2.5 flex items-start gap-2"
                  >
                    <CheckCircle2Icon className="h-3.5 w-3.5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-success)]">
                        Idea aplicada
                      </div>
                      <div className="text-xs text-[var(--color-fg-muted)] line-clamp-2 mt-0.5">
                        {s.content}
                      </div>
                      <div className="text-[10px] text-[var(--color-fg-subtle)] mt-1">
                        {s.appliedAt
                          ? formatRelative(s.appliedAt)
                          : formatRelative(s.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
