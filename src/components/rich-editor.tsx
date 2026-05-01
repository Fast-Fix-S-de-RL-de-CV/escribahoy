"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoldIcon,
  ItalicIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  SparkleIcon,
} from "lucide-react";
import {
  renderDecorationHtml,
  DECORATION_KINDS,
  type DecorationKind,
} from "@/lib/decorations";

type Cmd =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "quote";

const DECORATION_LABELS: Record<DecorationKind, { label: string; hint: string }> = {
  pullquote: {
    label: "Frase destacada",
    hint: "Cita grande resaltada en el flujo del texto",
  },
  epigraph: {
    label: "Epígrafe",
    hint: "Cita atribuida al inicio de un capítulo",
  },
  callout: {
    label: "Tip / Callout",
    hint: "Cuadro amarillo con un consejo o advertencia",
  },
  definition: {
    label: "Definición",
    hint: "Cuadro azul con término y su significado",
  },
  exercise: {
    label: "Ejercicio",
    hint: "Cuadro verde con una acción para el lector",
  },
  recap: {
    label: "Recap del capítulo",
    hint: "Resumen final con los puntos clave",
  },
  stat: {
    label: "Dato impactante",
    hint: "Estadística destacada con fuente",
  },
};

const COMMANDS: { id: Cmd; icon: React.ReactNode; title: string }[] = [
  { id: "h1", icon: <Heading1Icon className="h-4 w-4" />, title: "Título 1" },
  { id: "h2", icon: <Heading2Icon className="h-4 w-4" />, title: "Título 2" },
  { id: "h3", icon: <Heading3Icon className="h-4 w-4" />, title: "Título 3" },
  { id: "bold", icon: <BoldIcon className="h-4 w-4" />, title: "Negrita" },
  { id: "italic", icon: <ItalicIcon className="h-4 w-4" />, title: "Cursiva" },
  { id: "ul", icon: <ListIcon className="h-4 w-4" />, title: "Lista" },
  {
    id: "ol",
    icon: <ListOrderedIcon className="h-4 w-4" />,
    title: "Lista numerada",
  },
  { id: "quote", icon: <QuoteIcon className="h-4 w-4" />, title: "Cita" },
];

export function RichEditor({
  initialHtml,
  onChange,
  placeholder,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!initialHtml || initialHtml === "<p></p>");
  const [showDecoMenu, setShowDecoMenu] = useState(false);
  const [decoModal, setDecoModal] = useState<DecorationKind | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml || "";
    }
  }, [initialHtml]);

  function execute(cmd: Cmd) {
    if (!ref.current) return;
    ref.current.focus();
    const map: Record<Cmd, () => void> = {
      bold: () => document.execCommand("bold"),
      italic: () => document.execCommand("italic"),
      h1: () => document.execCommand("formatBlock", false, "h1"),
      h2: () => document.execCommand("formatBlock", false, "h2"),
      h3: () => document.execCommand("formatBlock", false, "h3"),
      ul: () => document.execCommand("insertUnorderedList"),
      ol: () => document.execCommand("insertOrderedList"),
      quote: () => document.execCommand("formatBlock", false, "blockquote"),
    };
    map[cmd]();
    handleInput();
  }

  function handleInput() {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    const text = ref.current.innerText.trim();
    setEmpty(text.length === 0);
    onChange(html);
  }

  function appendDecoration(
    kind: DecorationKind,
    parts: { text: string; attribution?: string; title?: string }
  ) {
    if (!ref.current) return;
    if (!parts.text.trim()) return;
    const html = renderDecorationHtml(kind, parts);
    // Append at end and a trailing empty <p> so user keeps writing.
    ref.current.innerHTML += html + "<p><br></p>";
    handleInput();
    setDecoModal(null);
  }

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-3 sticky top-0 bg-[var(--color-bg)] py-1 z-10 flex-wrap">
        {COMMANDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => execute(c.id)}
            title={c.title}
            className="h-8 w-8 grid place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
          >
            {c.icon}
          </button>
        ))}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDecoMenu((s) => !s)}
            className="h-8 px-2 grid place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)] flex items-center gap-1.5 text-xs font-medium"
            title="Insertar accesorio"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            Accesorio
          </button>
          {showDecoMenu && (
            <div
              className="absolute top-full left-0 mt-1 w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg z-20 p-1"
              onMouseLeave={() => setShowDecoMenu(false)}
            >
              {DECORATION_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setShowDecoMenu(false);
                    setDecoModal(k);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[var(--color-bg-muted)]"
                >
                  <div className="text-sm font-medium">
                    {DECORATION_LABELS[k].label}
                  </div>
                  <div className="text-xs text-[var(--color-fg-subtle)] leading-tight">
                    {DECORATION_LABELS[k].hint}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        className="prose-editor min-h-[300px] relative"
        data-empty={empty ? "true" : "false"}
        data-placeholder={placeholder ?? "Empieza a escribir..."}
      />
      {decoModal && (
        <DecorationModal
          kind={decoModal}
          onClose={() => setDecoModal(null)}
          onInsert={appendDecoration}
        />
      )}
    </div>
  );
}

function DecorationModal({
  kind,
  onClose,
  onInsert,
}: {
  kind: DecorationKind;
  onClose: () => void;
  onInsert: (
    kind: DecorationKind,
    parts: { text: string; attribution?: string; title?: string }
  ) => void;
}) {
  const [text, setText] = useState("");
  const [attribution, setAttribution] = useState("");
  const [title, setTitle] = useState("");

  const showAttribution = ["pullquote", "epigraph", "stat"].includes(kind);
  const showTitle = ["callout", "definition", "exercise", "recap"].includes(
    kind
  );
  const meta = DECORATION_LABELS[kind];

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 w-full max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold">Insertar {meta.label}</div>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">{meta.hint}</p>
        <div className="space-y-3 mt-4">
          {showTitle && (
            <div>
              <label className="text-xs font-medium text-[var(--color-fg-muted)] block mb-1">
                Título (opcional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 rounded-md border border-[var(--color-border)] px-3 text-sm bg-[var(--color-bg-elevated)]"
                placeholder={
                  kind === "definition"
                    ? "Ej: 'Funnel'"
                    : kind === "exercise"
                      ? "Ej: 'Tu turno'"
                      : ""
                }
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-[var(--color-fg-muted)] block mb-1">
              {kind === "stat" ? "Dato (corto e impactante)" : "Texto"}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={kind === "recap" ? 4 : 3}
              autoFocus
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-elevated)] resize-none"
              placeholder={
                kind === "pullquote"
                  ? "La frase que quieres destacar"
                  : kind === "stat"
                    ? "Ej: '70% de los emprendedores nunca validan su idea.'"
                    : "..."
              }
            />
          </div>
          {showAttribution && (
            <div>
              <label className="text-xs font-medium text-[var(--color-fg-muted)] block mb-1">
                {kind === "stat" ? "Fuente" : "Autor / atribución"} (opcional)
              </label>
              <input
                value={attribution}
                onChange={(e) => setAttribution(e.target.value)}
                className="w-full h-9 rounded-md border border-[var(--color-border)] px-3 text-sm bg-[var(--color-bg-elevated)]"
                placeholder={
                  kind === "stat" ? "Ej: 'CB Insights, 2024'" : "Ej: 'Steve Jobs'"
                }
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-sm rounded-md hover:bg-[var(--color-bg-muted)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onInsert(kind, {
                text: text.trim(),
                attribution: attribution.trim() || undefined,
                title: title.trim() || undefined,
              })
            }
            disabled={!text.trim()}
            className="h-9 px-4 text-sm rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            Insertar
          </button>
        </div>
      </div>
    </div>
  );
}
