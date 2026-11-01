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
/** Each source number keeps one highlighter colour, in the answer and in the margin. */
const ink = (n: number) => `hl-n${((n - 1) % 5) + 1}`;

const CITE = /(\[\d+(?:,\s*\d+)*\])/g;
const numbers = (cite: string) => cite.slice(1, -1).split(",").map((n) => Number(n.trim()));

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

type Lit = { active: number | null; setActive: (n: number | null) => void };

/**
 * Turns "[1]" and "[1, 3]" into highlighter-coloured numbers. The sentence just before a citation
 * is wrapped too, so lighting a source strokes every line it supports.
 */
function Cited({ text, sources, onCite, active, setActive }: { text: string; sources: Source[]; onCite: (s: Source) => void } & Lit) {
  const parts = text.split(CITE);
  return (
    <>
      {/* split() with a capture group puts the citations at the odd indexes. */}
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return numbers(part).map((n) => {
            const src = sources.find((s) => s.n === n);
            return (
              <sup key={`${i}-${n}`}>
                <button type="button" title={src ? `Open ${label(src)}` : undefined} disabled={!src}
                        onClick={() => src && onCite(src)}
                        onMouseEnter={() => setActive(n)} onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(n)} onBlur={() => setActive(null)}
                        // inline-block + own line-height: <sup> has line-height 0, which would collapse the stroke.
                        className={`hl hl-solid ${ink(n)} mx-px inline-block rounded-[2px] px-1 text-[1.05em] leading-[1.35] font-bold`}>
                  {n}
                </button>
              </sup>
            );
          });
        }
        const next = parts[i + 1];
        if (!next) return <Bold key={i} text={part} />;
        // Split off the last sentence (up to the citation): it starts after ". " (or "।", which ends
        // sentences in Hindi and others) or after a line break.
        // The indent before the sentence stays outside the stroke, so it starts at the first letter.
        const m = part.match(/^([\s\S]*(?:[.!?।]\s+|\n))?(\s*)([\s\S]*)$/)!;
        const cites = numbers(next);
        const lit = active !== null && cites.includes(active);
        return (
          <span key={i}>
            <Bold text={(m[1] ?? "") + m[2]} />
            {/* Stroke in the colour of the source that's lit, so [1, 3] goes pink when 3 is hovered. */}
            <span className={`hl-quiet ${ink(lit ? active : cites[0])}`} data-on={lit}>
              <Bold text={m[3]} />
            </span>
          </span>
        );
      })}
    </>
  );
}

function Answer({ m, streaming, onCite }: { m: Message; streaming: boolean; onCite: (s: Source) => void }) {
  const shown = useReveal(m.text, !!m.live);
  const done = !streaming && shown.length === m.text.length;
  const [active, setActive] = useState<number | null>(null);
  const sources = m.sources ?? [];
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0">
        <p className="max-w-[68ch] whitespace-pre-wrap text-[0.97rem] leading-7">
          {m.text ? (
            <Cited text={shown} sources={sources} onCite={onCite} active={active} setActive={setActive} />
          ) : (
            !m.error && <span className="inline-flex items-center gap-2 text-muted"><Spinner /> Thinking…</span>
          )}
        </p>
        {m.error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{m.error}</p>}
        {done && m.text && !m.error && <div className="mt-3"><SpeakButton text={m.text} /></div>}
      </div>
      {/* The margin: every source this answer used, in its highlighter colour. */}
      {sources.length > 0 && (
        <aside className="border-t border-danger/40 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4" aria-label="Sources">
          <p className="label mb-2">Sources</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 md:block md:space-y-2">
            {sources.map((s) => (
              <li key={s.n}>
                <button type="button" onClick={() => onCite(s)} title="Open the source"
                        onMouseEnter={() => setActive(s.n)} onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(s.n)} onBlur={() => setActive(null)}
                        className={`text-left text-sm leading-snug transition-opacity ${
                          active !== null && active !== s.n ? "opacity-40" : ""}`}>
                  <span className={`hl ${ink(s.n)} box-decoration-clone px-0.5`} data-on={active === s.n}>
                    <b className="mr-1">{s.n}</b>{label(s)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

function History({ chats, chatId, busy, open }: { chats: ChatSummary[]; chatId: string | null; busy: boolean; open: (c: ChatSummary) => void }) {
  return (
    <ul className="max-h-[28rem] space-y-0.5 overflow-y-auto">
      {chats.map((c) => (
        <li key={c.chat_id}>
          <button onClick={() => open(c)} disabled={busy}
                  className={`w-full rounded-[3px] px-2 py-1.5 text-left text-sm transition hover:bg-surface ${
                    c.chat_id === chatId ? "bg-surface font-semibold" : "text-muted"}`}>
            <span className="line-clamp-1">{c.title}</span>
            <span className="line-clamp-1 text-xs font-normal text-muted">
              {c.file_name ?? "All documents"} · {new Date(c.created_at).toLocaleDateString()}
            </span>
          </button>
        </li>
      ))}
      {chats.length === 0 && <li className="px-2 text-xs text-muted">No chats yet.</li>}
    </ul>
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

  const newChat = (
    <button className="btn w-full" disabled={busy || (!chatId && messages.length === 0)}
            onClick={() => { setMessages([]); setChatId(null); setError(null); }}>
      New chat
    </button>
  );

  return (
    <section className="grid gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
      {/* Chapter band: the heading with the chosen document as its running head, ruled beneath. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-fg pb-3 xl:col-span-2">
        <h1 className="chapter">Ask</h1>
        <select value={fileId ?? ""} onChange={(e) => setFileId(e.target.value || null)}
                disabled={busy || chatId !== null} aria-label="Document"
                className="field w-auto max-w-full border-transparent bg-transparent text-right text-base font-bold sm:max-w-[22rem]">
          <option value="">All documents</option>
          {docs.map((d) => <option key={d.file_id} value={d.file_id}>{docName(d)}</option>)}
        </select>
      </div>
      <aside className="hidden space-y-3 xl:block">
        {newChat}
        <h3 className="label px-2 pt-2">History</h3>
        <History chats={chats} chatId={chatId} busy={busy} open={(c) => void open(c)} />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Answer style and language. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex gap-4" role="group" aria-label="Answer style">
            {(["explain", "answer"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                      className={`py-1.5 text-sm font-semibold transition ${
                        mode === m ? "current" : "text-muted hover:text-fg"}`}>
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
          <details className="relative xl:hidden">
            <summary className="btn cursor-pointer list-none">History</summary>
            <div className="sheet absolute z-10 mt-1 w-72 space-y-2 p-2">
              {newChat}
              <History chats={chats} chatId={chatId} busy={busy} open={(c) => void open(c)} />
            </div>
          </details>
        </div>
        <p className="text-xs text-muted">
          {mode === "explain"
            ? "Explain: step by step in simple words, with examples, based on your document and citing its pages."
            : "Quick answer: only facts stated in your document, with page citations."}
          {chatId && fileId && " This chat stays on its document; start a new chat to change it."}
        </p>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

        <div className="sheet flex flex-col">
          <div className="divide-y divide-border">
            {messages.length === 0 && (
              <p className="px-5 py-10 text-sm text-muted sm:px-8">
                Ask a doubt below. Answers cite the page they come from; hover a number to see the line it supports.
              </p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                // The student's own words, in blue ballpoint.
                <p key={i} className="!border-b-0 px-5 pt-6 pb-2 text-[1.05rem] font-semibold whitespace-pre-wrap text-accent sm:px-8">{m.text}</p>
              ) : (
                <div key={i} className="px-5 pb-6 sm:px-8">
                  <Answer m={m} streaming={busy && i === messages.length - 1}
                          onCite={(src) => setPreview({ fileId: src.file_id, page: src.page })} />
                </div>
              ),
            )}
          </div>
          <form onSubmit={ask} className="sticky bottom-14 flex items-end gap-2 border-t border-border bg-surface p-3 lg:bottom-0">
            {/* A one-row textarea that grows with its text (and its placeholder on narrow phones).
                Enter sends, Shift+Enter adds a line. */}
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder={fileId ? "Ask a doubt about this document, in any language…" : "Ask a doubt about your documents, in any language…"}
                      className="field max-h-40 resize-none border-transparent text-[0.97rem] font-medium text-accent [field-sizing:content] focus:border-accent"
                      aria-label="Question" />
            <MicButton disabled={busy} onText={(t) => setQuestion((q) => (q.trim() ? `${q.trim()} ${t}` : t))} />
            <button type="submit" disabled={busy || !question.trim()} className="btn-primary shrink-0">
              {busy ? <Spinner label="Answering" /> : "Ask"}
            </button>
          </form>
        </div>
      </div>
      {preview && <Preview fileId={preview.fileId} page={preview.page} onClose={() => setPreview(null)} />}
    </section>
  );
}
