"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { LANGUAGES } from "@/lib/languages";
import { PcmPlayer, startMic } from "@/lib/liveAudio";
import { docName, useFiles } from "@/lib/useFiles";
import { Preview } from "./Preview";
import { Spinner } from "./Spinner";

type Turn = { role: "user" | "tutor"; text: string };
type SourceItem = { file_id: string; name: string | null; page: number | null; kind: "doc" | "audio" };
type Status = "idle" | "connecting" | "live" | "ended";

const WS_URL = `${(process.env.NEXT_PUBLIC_API_URL ?? "").replace(/^http/, "ws")}/api/v1/live`;

/** Talk with the tutor by voice in real time, about one document or all of them. */
export function Talk({ refreshKey }: { refreshKey: number }) {
  const docs = useFiles(refreshKey).filter((f) => f.status === "ready");
  const [fileId, setFileId] = useState("");
  const [language, setLanguage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ fileId: string; page: number | null } | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  // Countdown while live; the server enforces the real limit.
  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Adds caption text to the current turn of that speaker, or starts a new turn.
  const caption = (role: Turn["role"], text: string) =>
    setTurns((ts) => {
      const last = ts.at(-1);
      return last?.role === role ? [...ts.slice(0, -1), { role, text: last.text + text }] : [...ts, { role, text }];
    });

  async function start() {
    setMessage(null);
    setTurns([]);
    setSources([]);
    setStatus("connecting");
    const user = auth.currentUser;
    if (!user) return setStatus("idle");

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    const player = new PcmPlayer(24000);
    let stopMic: (() => void) | null = null;
    const speakingTimer = setInterval(() => setSpeaking(player.speaking), 200);

    const end = (note?: string) => {
      clearInterval(speakingTimer);
      stopMic?.();
      stopMic = null;
      player.close();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stop" }));
        ws.close();
      }
      cleanup.current = null;
      setSpeaking(false);
      setStatus("ended");
      if (note) setMessage(note);
    };
    cleanup.current = () => end();

    ws.onopen = async () => {
      ws.send(JSON.stringify({ type: "start", token: await user.getIdToken(), file_id: fileId || null, language: language || null }));
    };
    ws.onmessage = async (e) => {
      if (e.data instanceof ArrayBuffer) return player.play(e.data); // the tutor's voice
      const m = JSON.parse(e.data as string);
      if (m.type === "ready") {
        setSecondsLeft(m.seconds_left);
        try {
          stopMic = await startMic((pcm) => ws.readyState === WebSocket.OPEN && ws.send(pcm));
          setStatus("live");
        } catch {
          end("Allow microphone access to talk.");
        }
      } else if (m.type === "user_text") caption("user", m.text);
      else if (m.type === "model_text") caption("tutor", m.text);
      else if (m.type === "interrupted") player.stop(); // the student started talking: stop the tutor at once
      else if (m.type === "sources") setSources(m.items as SourceItem[]);
      else if (m.type === "limit") end("Time's up for this session.");
      else if (m.type === "error") end(m.message);
    };
    ws.onerror = () => end("Couldn't connect to the voice service.");
    ws.onclose = () => {
      if (cleanup.current) end();
    };
  }

  const live = status === "live";
  const mins = secondsLeft === null ? "" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <section className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={fileId} onChange={(e) => setFileId(e.target.value)} disabled={status === "connecting" || live}
                aria-label="Document" className="field w-auto max-w-xs">
          <option value="">All documents</option>
          {docs.map((d) => <option key={d.file_id} value={d.file_id}>{docName(d)}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={status === "connecting" || live}
                aria-label="Language" className="field w-auto">
          <option value="">Speak: same as me</option>
          {LANGUAGES.map((l) => <option key={l} value={l}>Speak: {l}</option>)}
        </select>
      </div>

      <div className="sheet flex flex-col items-center gap-4 px-6 py-10 text-center">
        <button
          onClick={() => (live || status === "connecting" ? cleanup.current?.() : void start())}
          aria-label={live ? "End conversation" : "Start talking"}
          title={live ? "End conversation" : "Start talking"}
          className={`flex h-24 w-24 items-center justify-center rounded-full transition ${
            live ? "bg-danger text-white" : "bg-ink text-ink-fg hover:opacity-85"
          } ${live && speaking ? "ring-[10px] ring-[var(--hl-1)]" : live ? "animate-pulse" : ""}`}
        >
          {status === "connecting" ? (
            <Spinner className="h-7 w-7" label="Connecting" />
          ) : live ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {status === "idle" && "Tap to talk with your tutor about your documents. Headphones work best."}
          {status === "connecting" && "Connecting…"}
          {live && (speaking ? "Tutor is speaking — just talk to interrupt" : "Listening…")}
          {status === "ended" && "Conversation ended. Tap to start again."}
          {live && mins && <span className="ml-2 tabular-nums">· {mins} left</span>}
        </p>
        {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="label">Looked at:</span>
          {sources.map((s, i) => (
            <button key={i} type="button" onClick={() => setPreview({ fileId: s.file_id, page: s.page })}
                    title="Open the source" className={`hl hl-n${(i % 5) + 1} font-semibold hover:[background-size:100%_82%,100%_0.3em]`}>
              {s.name ?? "Document"}{s.kind === "audio" ? " · voice note" : s.page ? ` · p. ${s.page}` : ""}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <ol className="sheet divide-y divide-border px-5 sm:px-8" aria-label="Conversation">
          {turns.map((t, i) => (
            <li key={i} className={t.role === "user"
              ? "py-3 text-[0.97rem] font-semibold text-accent"
              : "py-3 text-[0.97rem] leading-7"}>
              {t.text}
            </li>
          ))}
        </ol>
      )}
      {preview && <Preview fileId={preview.fileId} page={preview.page} onClose={() => setPreview(null)} />}
    </section>
  );
}
