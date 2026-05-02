"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Tipos mínimos para Web Speech API (TS no las trae por defecto en strict).
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string; message?: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type DictationStatus = "idle" | "listening" | "error" | "unsupported";

export function useDictation({
  lang = "es-MX",
  onTranscript,
}: {
  lang?: string;
  // Recibe (finalText, interimText). El consumer decide cómo concatenar.
  onTranscript: (finalText: string, interimText: string) => void;
}) {
  const [status, setStatus] = useState<DictationStatus>(() =>
    getSpeechRecognition() ? "idle" : "unsupported"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  // Bandera explícita de "el usuario quiere seguir escuchando" — más
  // confiable que mirar status (que el closure de onend captura estancado
  // en su valor inicial). Crítico para reiniciar el reconocimiento cuando
  // Chrome corta por silencio largo.
  const wantListeningRef = useRef(false);

  // Mantener el callback actualizado sin recrear el recognition.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus("idle");
    setElapsedSeconds(0);
    startedAtRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    setErrorMsg(null);
    finalTranscriptRef.current = "";
    wantListeningRef.current = true;

    const rec = new Ctor();
    rec.continuous = true; // No corta entre frases — clave para conversaciones largas.
    rec.interimResults = true; // Va emitiendo texto en vivo.
    rec.lang = lang;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let newlyFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          newlyFinal += text;
        } else {
          interim += text;
        }
      }
      if (newlyFinal) {
        // Concatenar al final acumulado con espaciado.
        const sep =
          finalTranscriptRef.current && !/\s$/.test(finalTranscriptRef.current)
            ? " "
            : "";
        finalTranscriptRef.current = finalTranscriptRef.current + sep + newlyFinal;
      }
      onTranscriptRef.current(finalTranscriptRef.current.trim(), interim.trim());
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" y "aborted" se disparan seguido durante silencios — no
      // tratarlos como fatal y dejar que onend se encargue del reinicio.
      if (e.error === "no-speech" || e.error === "aborted") return;
      setStatus("error");
      const map: Record<string, string> = {
        "not-allowed": "Permiso de micrófono denegado",
        "service-not-allowed": "Permiso de micrófono denegado",
        network: "Error de red en el reconocimiento",
        "audio-capture": "No se pudo acceder al micrófono",
      };
      setErrorMsg(map[e.error] ?? `Error: ${e.error}`);
      wantListeningRef.current = false;
      stop();
    };

    rec.onend = () => {
      // En continuous, esto se dispara si el navegador corta la sesión por
      // silencio largo (~5-10s en Chrome). Reiniciamos automáticamente
      // mientras el usuario aún quiera escuchar (wantListeningRef).
      if (wantListeningRef.current && recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {
          // Si Chrome se queja porque ya está corriendo, reintentar en un
          // tick. Si falla por permiso, lo manejará onerror.
          setTimeout(() => {
            if (wantListeningRef.current && recognitionRef.current === rec) {
              try {
                rec.start();
              } catch {
                setStatus("idle");
              }
            }
          }, 100);
        }
      } else {
        setStatus("idle");
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
      startedAtRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setElapsedSeconds(
            Math.floor((Date.now() - startedAtRef.current) / 1000)
          );
        }
      }, 200);
    } catch (err) {
      wantListeningRef.current = false;
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "no se pudo iniciar el dictado"
      );
    }
  }, [lang, stop]);

  // Cleanup al desmontar.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    status,
    errorMsg,
    elapsedSeconds,
    start,
    stop,
    isListening: status === "listening",
    isSupported: status !== "unsupported",
  };
}
