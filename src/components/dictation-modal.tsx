"use client";

import { useEffect, useRef, useState } from "react";
import {
  XIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  ArrowDownToLineIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircularSpinner } from "@/components/circular-spinner";
import { useDictation } from "@/lib/use-dictation";

export function DictationModal({
  open,
  initialText,
  language,
  onClose,
  onInsert,
}: {
  open: boolean;
  initialText: string;
  language: string;
  onClose: () => void;
  onInsert: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [paused, setPaused] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]); // Para "Deshacer mejora".
  const baseAtStartRef = useRef("");

  const dictation = useDictation({
    lang: language,
    onTranscript: (finalText, interimText) => {
      const sep =
        baseAtStartRef.current && !/\s$/.test(baseAtStartRef.current)
          ? " "
          : "";
      const combined =
        baseAtStartRef.current +
        sep +
        finalText +
        (interimText ? (finalText ? " " : "") + interimText : "");
      setText(combined);
    },
  });

  // Al abrir el modal, arrancar el dictado automáticamente.
  useEffect(() => {
    if (open) {
      setText(initialText);
      baseAtStartRef.current = initialText;
      // Pequeño delay para que el modal se monte completo antes de pedir mic.
      const id = setTimeout(() => {
        if (!paused) dictation.start();
      }, 100);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup al cerrar.
  useEffect(() => {
    if (!open && dictation.isListening) {
      dictation.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function togglePause() {
    if (dictation.isListening) {
      dictation.stop();
      // Hace que el texto actual sea la nueva base, así al reanudar se
      // anexa, no reemplaza.
      baseAtStartRef.current = text;
      setPaused(true);
    } else {
      baseAtStartRef.current = text;
      dictation.start();
      setPaused(false);
    }
  }

  async function improveWithAI() {
    if (!text.trim()) return;
    if (dictation.isListening) {
      dictation.stop();
      setPaused(true);
    }
    setImproving(true);
    setImproveError(null);
    setHistory((h) => [...h, text]);
    try {
      const res = await fetch("/api/ai/clean-dictation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "no se pudo mejorar");
      }
      const data = (await res.json()) as { text: string };
      setText(data.text);
      // Resetear base para que si reanudas dictado se anexe a esta versión.
      baseAtStartRef.current = data.text;
    } catch (e) {
      setImproveError(e instanceof Error ? e.message : "error");
      // Quitar el último snapshot porque no hubo cambio.
      setHistory((h) => h.slice(0, -1));
    } finally {
      setImproving(false);
    }
  }

  function undoImprove() {
    const prev = history[history.length - 1];
    if (prev === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setText(prev);
    baseAtStartRef.current = prev;
  }

  function handleClose() {
    if (dictation.isListening) dictation.stop();
    setText("");
    setPaused(false);
    setHistory([]);
    onClose();
  }

  function handleInsert() {
    if (dictation.isListening) dictation.stop();
    onInsert(text.trim());
    setText("");
    setPaused(false);
    setHistory([]);
  }

  if (!open) return null;

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-[var(--color-bg-elevated)] rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col animate-fade-in">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-md bg-[var(--color-accent-soft)] grid place-items-center text-[var(--color-accent)]">
              <MicIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold">Editor de dictado</div>
              <div className="text-xs text-[var(--color-fg-subtle)] flex items-center gap-1.5">
                {dictation.isListening ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                    <span className="text-red-700 font-medium">
                      Escuchando · {dictation.elapsedSeconds}s
                    </span>
                  </>
                ) : paused ? (
                  <span>En pausa · {wordCount} palabras</span>
                ) : (
                  <span>{wordCount} palabras</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--color-bg-muted)] rounded-md text-[var(--color-fg-muted)]"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {dictation.errorMsg && (
          <div className="mx-6 mt-4 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
            <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{dictation.errorMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-hidden p-6">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!dictation.isListening) {
                baseAtStartRef.current = e.target.value;
              }
            }}
            placeholder="Tu dictado aparecerá aquí. Habla con calma. Puedes pausar y revisar antes de insertar."
            autoFocus={false}
            className="w-full h-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 prose-editor text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            style={{ fontFamily: "var(--font-serif)", lineHeight: 1.7 }}
          />
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant={dictation.isListening ? "danger" : "outline"}
              size="sm"
              onClick={togglePause}
              disabled={!dictation.isSupported}
              className={dictation.isListening ? "" : ""}
            >
              {dictation.isListening ? (
                <>
                  <PauseIcon className="h-3.5 w-3.5" />
                  Pausar
                </>
              ) : (
                <>
                  <PlayIcon className="h-3.5 w-3.5" />
                  {paused || text ? "Reanudar" : "Dictar"}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={improveWithAI}
              disabled={improving || !text.trim()}
              title="Limpia ortografía, puntuación y muletillas. NO cambia tus ideas."
            >
              {improving ? (
                <>
                  <CircularSpinner size={14} />
                  Mejorando...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Mejorar con IA
                </>
              )}
            </Button>
            {history.length > 0 && !improving && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={undoImprove}
                title="Volver a la versión anterior"
              >
                <RotateCcwIcon className="h-3.5 w-3.5" />
                Deshacer mejora
              </Button>
            )}
            {improveError && (
              <span className="text-xs text-[var(--color-danger)]">
                {improveError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleInsert}
              disabled={!text.trim()}
            >
              <ArrowDownToLineIcon className="h-3.5 w-3.5" />
              Listo, insertar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
