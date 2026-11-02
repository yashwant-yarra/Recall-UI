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
    <section className="max-w-4xl space-y-6">
      <div className="border-b-2 border-fg pb-5">
        <h2 className="text-lg font-bold">Talk through your material</h2>
        <p className="mt-1 max-w-[62ch] text-sm leading-6 text-muted">
          Ask questions out loud, work through a tricky idea, or check your understanding with your tutor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-1.5">
          <span className="label">Study material</span>
          <select value={fileId} onChange={(e) => setFileId(e.target.value)} disabled={status === "connecting" || live}
                  className="field">
            <option value="" className="bg-surface text-fg">All documents</option>
            {docs.map((d) => <option key={d.file_id} value={d.file_id} className="bg-surface text-fg">{docName(d)}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="label">Spoken language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={status === "connecting" || live}
                  className="field">
            <option value="" className="bg-surface text-fg">Same as me</option>
            {LANGUAGES.map((l) => <option key={l} value={l} className="bg-surface text-fg">{l}</option>)}
          </select>
        </label>
      </div>

      <div className="sheet flex flex-col items-center gap-4 px-6 py-10 text-center sm:py-12">
        <p className="label">{live ? "Live conversation" : status === "connecting" ? "Getting ready" : "Your voice tutor"}</p>
        <button
          onClick={() => (live || status === "connecting" ? cleanup.current?.() : void start())}
          aria-label={live ? "End conversation" : status === "connecting" ? "Cancel connection" : "Start talking"}
          title={live ? "End conversation" : status === "connecting" ? "Cancel connection" : "Start talking"}
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

      {turns.length === 0 && !live && status !== "connecting" && (
        <div className="sheet ruled grid gap-6 px-5 py-8 pl-[3.6rem] sm:grid-cols-2 sm:gap-10 sm:px-8 sm:pl-[3.6rem]">
          <div>
            <h3 className="label">Get started</h3>
            <ol className="mt-3 space-y-2 text-sm leading-6">
              <li><span className="hl hl-solid hl-n1 mr-2 px-1 font-bold">1</span>Choose a document or use your whole library.</li>
              <li><span className="hl hl-solid hl-n2 mr-2 px-1 font-bold">2</span>Tap the microphone and allow access.</li>
              <li><span className="hl hl-solid hl-n3 mr-2 px-1 font-bold">3</span>Ask your question naturally. You can interrupt the tutor.</li>
            </ol>
          </div>
          <div>
            <h3 className="label">Try asking</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 font-semibold">
              <li><span className="hl hl-n4 box-decoration-clone">“Explain the main idea in simple terms.”</span></li>
              <li><span className="hl hl-n5 box-decoration-clone">“Give me an example of this concept.”</span></li>
              <li><span className="hl hl-n1 box-decoration-clone">“Ask me a question to check my understanding.”</span></li>
            </ul>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="label">Looked at:</span>
          {sources.map((s, i) => (
            <button key={i} type="button" onClick={() => setPreview({ fileId: s.file_id, page: s.page })}
                    title="Open the source" className={`hl hl-n${(i % 5) + 1} min-w-0 text-left font-semibold [overflow-wrap:anywhere] hover:[background-size:100%_82%,100%_0.3em]`}>
              {s.name ?? "Document"}{s.kind === "audio" ? " · voice note" : s.page ? ` · p. ${s.page}` : ""}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 ? (
        <div>
        <h3 className="label mb-2">Conversation</h3>
        <ol className="sheet divide-y divide-border px-5 sm:px-8" aria-label="Conversation">
          {turns.map((t, i) => (
            <li key={i} className={t.role === "user"
              ? "py-3 text-[0.97rem] font-semibold text-accent"
              : "py-3 text-[0.97rem] leading-7"}>
              {t.text}
            </li>
          ))}
        </ol>
        </div>
      ) : (live || status === "connecting") && (
        <div className="border-t border-border pt-4 text-sm text-muted" role="status">
          Conversation captions will appear here as you talk.
        </div>
      )}
      {preview && <Preview fileId={preview.fileId} page={preview.page} onClose={() => setPreview(null)} />}
    </section>
  );
}
