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
} from "lucide-react";

type Cmd =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "quote";

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

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-3 sticky top-0 bg-[var(--color-bg)] py-1 z-10">
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
    </div>
  );
}
