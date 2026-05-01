"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function TeleprompterView({
  projectId,
  title,
  script,
}: {
  projectId: string;
  title: string;
  script: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // px per second
  const [fontSize, setFontSize] = useState(48);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const start = performance.now();
    const startScroll = scrollRef.current.scrollTop;
    const tick = (t: number) => {
      if (!scrollRef.current) return;
      const elapsed = (t - start) / 1000;
      scrollRef.current.scrollTop = startScroll + elapsed * speed;
      const max =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      if (scrollRef.current.scrollTop >= max) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  function reset() {
    setPlaying(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      <header className="px-5 py-3 flex items-center justify-between border-b border-zinc-800">
        <Link
          href={`/project/${projectId}?node=${"".trim()}`}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al editor
        </Link>
        <div className="text-sm font-medium truncate max-w-md text-center">
          {title}
        </div>
        <div className="text-xs text-zinc-500">Modo teleprompter</div>
      </header>

      {!script.trim() ? (
        <div className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <p className="text-zinc-300 text-lg">
              Aún no hay guión para esta lección.
            </p>
            <p className="text-zinc-500 text-sm mt-2">
              Vuelve al editor, escribe contenido y genera el guión con el
              botón{" "}
              <span className="text-zinc-300">"Generar guión"</span>.
            </p>
            <Link
              href={`/project/${projectId}`}
              className="inline-block mt-5"
            >
              <Button>Volver al editor</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-8 py-32 scroll-smooth"
          >
            <div
              className="max-w-3xl mx-auto whitespace-pre-wrap leading-[1.4] tracking-tight"
              style={{ fontSize: `${fontSize}px` }}
            >
              {script}
            </div>
          </div>
          <div className="border-t border-zinc-800 px-5 py-4 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize((f) => Math.max(24, f - 4))}
              className="bg-transparent text-white border-zinc-700"
            >
              <MinusIcon className="h-3.5 w-3.5" /> Texto
            </Button>
            <span className="text-xs text-zinc-500 w-10 text-center">
              {fontSize}px
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize((f) => Math.min(96, f + 4))}
              className="bg-transparent text-white border-zinc-700"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Texto
            </Button>

            <div className="w-px h-6 bg-zinc-800 mx-2" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSpeed((s) => Math.max(10, s - 10))}
              className="bg-transparent text-white border-zinc-700"
            >
              <MinusIcon className="h-3.5 w-3.5" /> Velocidad
            </Button>
            <span className="text-xs text-zinc-500 w-10 text-center">
              {speed}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSpeed((s) => Math.min(200, s + 10))}
              className="bg-transparent text-white border-zinc-700"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Velocidad
            </Button>

            <div className="w-px h-6 bg-zinc-800 mx-2" />

            <Button
              size="lg"
              onClick={() => setPlaying((p) => !p)}
              className="px-6"
            >
              {playing ? (
                <>
                  <PauseIcon className="h-4 w-4" />
                  Pausa
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4" />
                  Reproducir
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="bg-transparent text-white border-zinc-700"
            >
              <RotateCcwIcon className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
