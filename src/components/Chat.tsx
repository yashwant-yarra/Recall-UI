"use client";

import { useCallback, useEffect, useState } from "react";
import { api, stream } from "@/lib/api";
import type { ChatSummary, Source, StoredMessage } from "@/lib/types";
import { docName, useFiles } from "@/lib/useFiles";
import { LANGUAGES } from "@/lib/languages";
import { useReveal } from "@/lib/useReveal";
import { MicButton } from "./MicButton";
import { Preview } from "./Preview";
import { SpeakButton } from "./SpeakButton";
import { Spinner } from "./Spinner";

const LANG_KEY = "recall.answerLanguage";

type Message = { role: "user" | "assistant"; text: string; sources?: Source[]; error?: string; live?: boolean };

// Older saved citations have no `kind`; a missing page means a voice note.
const where = (s: Source) => ((s.kind ?? (s.page === null ? "audio" : "doc")) === "audio" ? "voice note" : `p. ${s.page}`);
const label = (s: Source) => (s.name ? `${s.name}, ${where(s)}` : where(s));

/** Renders the model's **bold** as bold (the only markdown it uses much); the rest stays plain text. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*\n]+\*\*)/g).map((s, i) =>
        s.startsWith("**") && s.endsWith("**") && s.length > 4 ? <strong key={i}>{s.slice(2, -2)}</strong> : <span key={i}>{s}</span>,
      )}
    </>
  );
}

/** Turns "[1]" and "[1, 3]" in an answer into small citation markers that name their source. */
function Cited({ text, sources, onCite }: { text: string; sources: Source[]; onCite: (s: Source) => void }) {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(.+)\]$/);
        if (!match) return <Bold key={i} text={part} />;
        return match[1].split(",").map((n) => {
          const src = sources.find((s) => s.n === Number(n.trim()));
          return (
            <sup key={`${i}-${n}`}>
              <button type="button" title={src ? `Open ${label(src)}` : undefined} disabled={!src}
                      onClick={() => src && onCite(src)}
                      className="mx-0.5 rounded bg-accent-soft px-1 text-[0.85em] font-medium text-accent hover:underline">
                {n.trim()}
              </button>
            </sup>
          );
        });
      })}
    </>
  );
}

function Answer({ m, streaming, onCite }: { m: Message; streaming: boolean; onCite: (s: Source) => void }) {
  const shown = useReveal(m.text, !!m.live);
  const done = !streaming && shown.length === m.text.length;
  return (
    <div className="card max-w-[95%] px-4 py-3 text-sm">
      <p className="whitespace-pre-wrap leading-relaxed">
        {m.text ? <Cited text={shown} sources={m.sources ?? []} onCite={onCite} /> : !m.error && <span className="inline-flex items-center gap-2 text-muted"><Spinner /> Thinking…</span>}
      </p>
      {m.error && <p role="alert" className="mt-2 text-danger">{m.error}</p>}
      {done && m.text && !m.error && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
          <SpeakButton text={m.text} />
          {(m.sources ?? []).map((s) => (
            <button key={s.n} type="button" onClick={() => onCite(s)} title="Open the source"
                    className="pill bg-bg text-muted transition hover:text-accent">
              [{s.n}] {label(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Chat({ initialFileId, refreshKey }: { initialFileId: string | null; refreshKey: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(initialFileId); // null = all documents
  const [mode, setMode] = useState<"explain" | "answer">("explain");
  // "" = answer in the question's language. Remembered in this browser only (a convenience).
  const [language, setLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem(LANG_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const docs = useFiles(refreshKey).filter((f) => f.status === "ready");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ fileId: string; page: number | null } | null>(null);

  const loadChats = useCallback(
    () => api<{ chats: ChatSummary[] }>("/api/v1/chats").then((r) => setChats(r.chats)).catch(() => {}),
    [],
  );

  useEffect(() => {
    let live = true;
    api<{ chats: ChatSummary[] }>("/api/v1/chats").then((r) => live && setChats(r.chats)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function open(c: ChatSummary) {
    if (busy) return;
    setError(null);
    try {
      const { messages: stored } = await api<{ messages: StoredMessage[] }>(`/api/v1/chats/${c.chat_id}/messages`);
      setMessages(stored.map((s) => ({ role: s.role, text: s.content, sources: s.citations })));
      setChatId(c.chat_id);
      setFileId(c.file_id); // a chat stays on the document it started with
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Updates the last message (the assistant reply being streamed).
  const patchLast = (patch: (m: Message) => Message) =>
    setMessages((ms) => [...ms.slice(0, -1), patch(ms[ms.length - 1])]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);
    setError(null);
    setMessages((ms) => [...ms, { role: "user", text: q }, { role: "assistant", text: "", live: true }]);
    try {
      // The document only matters when starting a chat; an existing chat keeps its own.
      await stream("/api/v1/ask", { question: q, chat_id: chatId, file_id: chatId ? null : fileId, mode, language: language || null }, ({ event, data }) => {
        if (event === "chat") setChatId((data as { chat_id: string }).chat_id);
        else if (event === "sources") patchLast((m) => ({ ...m, sources: data as Source[] }));
        else if (event === "token") patchLast((m) => ({ ...m, text: m.text + (data as string) }));
        else if (event === "error") patchLast((m) => ({ ...m, error: data as string }));
      });
    } catch (err) {
      patchLast((m) => ({ ...m, error: (err as Error).message }));
    } finally {
      setBusy(false);
      void loadChats(); // a new chat now appears in the history
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <aside className="space-y-2">
        <button className="btn w-full" disabled={busy || (!chatId && messages.length === 0)}
                onClick={() => { setMessages([]); setChatId(null); setError(null); }}>
          New chat
        </button>
        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">History</h3>
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
          {chats.map((c) => (
            <li key={c.chat_id}>
              <button onClick={() => void open(c)} disabled={busy}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface ${
                        c.chat_id === chatId ? "bg-surface font-medium" : "text-muted"}`}>
                <span className="line-clamp-1">{c.title}</span>
                <span className="line-clamp-1 text-xs text-muted">
                  {c.file_name ?? "All documents"} · {new Date(c.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
          {chats.length === 0 && <li className="text-xs text-muted">No chats yet.</li>}
        </ul>
      </aside>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={fileId ?? ""} onChange={(e) => setFileId(e.target.value || null)}
                  disabled={busy || chatId !== null} aria-label="Document" className="field w-auto max-w-xs">
            <option value="">All documents</option>
            {docs.map((d) => <option key={d.file_id} value={d.file_id}>{docName(d)}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Answer style">
            {(["explain", "answer"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                      className={`rounded-md px-3 py-1 text-sm transition ${mode === m ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
                {m === "explain" ? "Explain" : "Quick answer"}
              </button>
            ))}
          </div>
          <select value={language} aria-label="Answer language" className="field w-auto"
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    try {
                      localStorage.setItem(LANG_KEY, e.target.value);
                    } catch {
                      // private mode or blocked storage: the choice just isn't remembered
                    }
                  }}>
            <option value="">Answer in: same as question</option>
            {LANGUAGES.map((l) => <option key={l} value={l}>Answer in: {l}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted">
          {mode === "explain"
            ? "Explain: step by step in simple words, with examples, based on your document and citing its pages."
            : "Quick answer: only facts stated in your document, with page citations."}
          {chatId && fileId && " This chat stays on its document; start a new chat to change it."}
        </p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="space-y-4">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-xl bg-accent px-4 py-2 text-sm text-accent-fg">{m.text}</div>
            ) : (
              <Answer key={i} m={m} streaming={busy && i === messages.length - 1}
                      onCite={(src) => setPreview({ fileId: src.file_id, page: src.page })} />
            ),
          )}
        </div>
        <form onSubmit={ask} className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000}
                 placeholder={fileId ? "Ask a doubt about this document, in any language…" : "Ask a doubt about your documents, in any language…"} className="field" aria-label="Question" />
          <MicButton disabled={busy} onText={(t) => setQuestion((q) => (q.trim() ? `${q.trim()} ${t}` : t))} />
          <button type="submit" disabled={busy || !question.trim()} className="btn-primary shrink-0">
            {busy ? <Spinner label="Answering" /> : "Ask"}
          </button>
        </form>
      </div>
      {preview && <Preview fileId={preview.fileId} page={preview.page} onClose={() => setPreview(null)} />}
    </section>
  );
}
