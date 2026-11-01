"use client";

import { useEffect, useRef, useState } from "react";
import { postAudio } from "@/lib/api";
import { FORMATS } from "./Recorder";
import { Spinner } from "./Spinner";

const MAX_SECONDS = 120; // the API accepts about 2 minutes

/** Speak a question: records, sends it to the API to transcribe (any language), returns the text. */
export function MicButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => release(), []);

  // A message hides itself after a few seconds (it can also be closed with ×).
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(id);
  }, [error]);

  function release() {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop()); // turns the mic indicator off
  }

  async function start() {
    setError(null);
    const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    if (!format) return setError("Voice input isn't supported in this browser.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("Allow microphone access to ask by voice.");
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: format });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      release();
      const mime = format.split(";")[0];
      setState("transcribing");
      try {
        const { text } = await postAudio<{ text: string }>("/api/v1/speech/transcribe", new Blob(chunks, { type: mime }), mime);
        if (text.trim()) onText(text.trim());
        else setError("Didn't catch that. Try again a little closer to the mic.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) rec.stop();
        return s + 1;
      });
    }, 1000);
    setState("listening");
  }

  const label = state === "listening" ? `Stop recording (${seconds}s)` : state === "transcribing" ? "Transcribing" : "Ask by voice";
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => (state === "listening" ? recorder.current?.stop() : void start())}
        disabled={disabled || state === "transcribing"}
        aria-label={label}
        title={label}
        aria-pressed={state === "listening"}
        className={`btn shrink-0 px-3 ${state === "listening" ? "border-danger bg-danger/10 text-danger" : ""}`}
      >
        {state === "transcribing" ? (
          <Spinner />
        ) : state === "listening" ? (
          <>
            {/* A solid square: the usual "stop" symbol, pulsing to show it's recording. */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 animate-pulse" aria-hidden>
              <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
            </svg>
            <span className="text-xs tabular-nums">{seconds}s</span>
          </>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        )}
      </button>
      {error && (
        <span role="alert"
              className="absolute bottom-full right-0 z-10 mb-1 flex w-64 items-start gap-2 rounded-lg border border-border bg-surface p-2 text-xs text-danger shadow">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Close message" title="Close"
                  className="-m-1 rounded p-1 leading-none text-muted hover:text-fg">
            ×
          </button>
        </span>
      )}
    </span>
  );
}
