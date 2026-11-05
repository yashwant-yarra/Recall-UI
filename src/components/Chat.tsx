"use client";

import { useCallback, useEffect, useState } from "react";
import katex from "katex";
import { api, stream } from "@/lib/api";
import { isWeb, type ChatSummary, type Source, type StoredMessage, type WebSource } from "@/lib/types";
import { docName, useFiles } from "@/lib/useFiles";
import { useReveal } from "@/lib/useReveal";
import { MicButton } from "./MicButton";
import { Preview } from "./Preview";
import { SpeakButton } from "./SpeakButton";
import { Spinner } from "./Spinner";
import { parseAnswer, type Block as AnswerBlock, type ListBlock } from "@/lib/answerBlocks";

type Message = { role: "user" | "assistant"; text: string; sources?: Source[]; web?: WebSource[]; error?: string; live?: boolean };

// Older saved citations have no `kind`; a missing page means a voice note.
const where = (s: Source) => ((s.kind ?? (s.page === null ? "audio" : "doc")) === "audio" ? "voice note" : `p. ${s.page}`);
const label = (s: Source) => (s.name ? `${s.name}, ${where(s)}` : where(s));
/** Each source number keeps one highlighter colour, in the answer and in the margin. */
const ink = (n: number) => `hl-n${((n - 1) % 5) + 1}`;

const CITE = /(\[\d+(?:,\s*\d+)*\])/g;
const numbers = (cite: string) => cite.slice(1, -1).split(",").map((n) => Number(n.trim()));

/** Render the emphasis and inline code commonly used in answers. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`|\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((s, i) =>
        s.startsWith("**") && s.endsWith("**") && s.length > 4 ? <strong key={i}>{s.slice(2, -2)}</strong> :
        s.startsWith("*") && s.endsWith("*") && s.length > 2 ? <em key={i}>{s.slice(1, -1)}</em> :
        s.startsWith("`") && s.endsWith("`") && s.length > 2 ? <code key={i} className="rounded-sm bg-bg px-1 font-mono text-[0.9em]">{s.slice(1, -1)}</code> :
        s.startsWith("$") && s.endsWith("$") ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(
          s.slice(s.startsWith("$$") ? 2 : 1, s.startsWith("$$") ? -2 : -1),
          { displayMode: s.startsWith("$$"), throwOnError: false, trust: false },
        ) }} /> :
        <span key={i}>{s}</span>,
      )}
    </>
  );
}

type Lit = { active: number | null; setActive: (n: number | null) => void };

/**
 * Turns "[1]" and "[1, 3]" into highlighter-coloured numbers. The sentence just before a citation
 * is wrapped too, so lighting a source strokes every line it supports.
 */
function Cited({ text, sources, onCite, active, setActive, citations = true }: { text: string; sources: Source[]; onCite: (s: Source) => void; citations?: boolean } & Lit) {
  if (!citations) return <Bold text={text} />;
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

type TextProps = { sources: Source[]; onCite: (s: Source) => void; citations?: boolean } & Lit;

function List({ list, nested = false, ...props }: { list: ListBlock; nested?: boolean } & TextProps) {
  const className = `space-y-1 pl-5 marker:text-muted ${list.ordered ? "list-decimal" : "list-disc"} ${nested ? "mt-1" : ""}`;
  const items = list.items.map((item, i) => (
    // value keeps the model's own number, so a list split by other content doesn't restart at 1.
    <li key={i} value={list.ordered ? item.value : undefined}>
      <Cited text={item.text} {...props} />
      {item.children && <List list={item.children} nested {...props} />}
    </li>
  ));
  return list.ordered ? <ol className={className}>{items}</ol> : <ul className={className}>{items}</ul>;
}

function Block({ block, ...props }: { block: AnswerBlock } & TextProps) {
  switch (block.kind) {
    case "h": return <p className="font-bold"><Cited text={block.text} {...props} /></p>;
    case "hr": return <hr className="border-border" />;
    case "code": return <pre className="overflow-x-auto rounded-lg bg-bg p-3 font-mono text-sm leading-6"><code>{block.text}</code></pre>;
    case "list": return <List list={block} {...props} />;
    case "table": return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>{block.head.map((c, i) => <th key={i} className="border-b border-border px-2 py-1.5 text-left font-semibold"><Cited text={c} {...props} /></th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className="border-b border-border last:border-0">
                {row.map((c, i) => <td key={i} className="px-2 py-1.5 align-top"><Cited text={c} {...props} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    default: return <p className="whitespace-pre-wrap"><Cited text={block.text} {...props} /></p>;
  }
}

export function AnswerText({ text, ...props }: { text: string } & TextProps) {
  return (
    <div className="max-w-[68ch] space-y-3 text-[0.97rem] leading-7 [&_.katex-display]:my-0">
      {parseAnswer(text).map((block, i) => <Block key={i} block={block} {...props} />)}
    </div>
  );
}

function Answer({ m, streaming, onCite }: { m: Message; streaming: boolean; onCite: (s: Source) => void }) {
  const shown = useReveal(m.text, !!m.live);
  const done = !streaming && shown.length === m.text.length;
  const [active, setActive] = useState<number | null>(null);
  const cited = new Set((shown.match(CITE) ?? []).flatMap(numbers));
  const sources = (m.sources ?? []).filter((source) => cited.has(source.n));
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0">
        <div>
          {m.text ? (
            <AnswerText text={shown} sources={sources} onCite={onCite} active={active} setActive={setActive} />
          ) : (
            !m.error && <span className="inline-flex items-center gap-2 text-muted"><Spinner /> Thinking…</span>
          )}
        </div>
        {m.error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{m.error}</p>}
        {done && m.text && !m.error && <div className="mt-3"><SpeakButton text={m.text} /></div>}
      </div>
      {/* The margin: every source this answer used, in its highlighter colour. */}
      {(sources.length > 0 || (m.web?.length ?? 0) > 0) && (
        <aside className="border-t border-danger/40 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4" aria-label="Sources">
          {sources.length > 0 && <p className="label mb-2">Sources</p>}
          <ul className="flex flex-wrap gap-x-4 gap-y-2 md:block md:space-y-2">
            {sources.map((s) => (
              <li key={s.n}>
                <button type="button" onClick={() => onCite(s)} title="Open the source"
                        onMouseEnter={() => setActive(s.n)} onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(s.n)} onBlur={() => setActive(null)}
                        className={`text-left text-sm leading-snug transition-opacity [overflow-wrap:anywhere] ${
                          active !== null && active !== s.n ? "opacity-40" : ""}`}>
                  <span className={`hl ${ink(s.n)} box-decoration-clone px-0.5`} data-on={active === s.n}>
                    <b className="mr-1">{s.n}</b>{label(s)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* Web pages are never numbered or highlighted: they are background, not your document. */}
          {(m.web?.length ?? 0) > 0 && (
            <div className={sources.length > 0 ? "mt-4" : ""}>
              <p className="label mb-2">From the web</p>
              <ul className="space-y-1.5">
                {m.web!.map((w) => (
                  <li key={w.uri}>
                    <a href={w.uri} target="_blank" rel="noopener noreferrer"
                       className="text-sm leading-snug underline decoration-border underline-offset-4 hover:decoration-fg">
                      {w.title}<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function History({ chats, chatId, busy, open, remove }: { chats: ChatSummary[]; chatId: string | null; busy: boolean; open: (c: ChatSummary) => void; remove: (id: string) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <ul className="max-h-[28rem] space-y-0.5 overflow-y-auto">
      {chats.map((c) => (
        <li key={c.chat_id} className="flex flex-wrap items-center">
          <button onClick={() => open(c)} disabled={busy}
                  className={`min-w-0 flex-1 rounded-[3px] px-2 py-1.5 text-left text-sm transition hover:bg-surface ${
                    c.chat_id === chatId ? "bg-surface font-semibold" : "text-muted"}`}>
            <span className="line-clamp-1">{c.title}</span>
            <span className="line-clamp-1 text-xs font-normal text-muted">
              {c.file_name ?? "All documents"} · {new Date(c.created_at).toLocaleDateString()}
            </span>
          </button>
          <button disabled={busy} onClick={() => setConfirming(c.chat_id)} aria-label={`Delete chat: ${c.title}`}
                  title="Delete chat" className="shrink-0 px-2 py-2 text-muted hover:text-danger">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
            </svg>
          </button>
          {confirming === c.chat_id && (
            <div className="w-full space-y-2 px-2 py-2 text-sm">
              <p className="text-danger">Delete this chat and all its messages? This cannot be undone.</p>
              <div className="flex gap-2">
                <button className="btn border-danger text-danger" disabled={busy}
                        onClick={() => { setConfirming(null); remove(c.chat_id); }}>Yes, delete</button>
                <button className="btn" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            </div>
          )}
        </li>
      ))}
      {chats.length === 0 && <li className="px-2 text-xs text-muted">No chats yet.</li>}
    </ul>
  );
}

export function Chat({ initialFileId, refreshKey, canWeb }: { initialFileId: string | null; refreshKey: number; canWeb: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(initialFileId); // null = all documents
  const [mode, setMode] = useState<"explain" | "answer">("explain");
  const [web, setWeb] = useState(false); // let the tutor add Google Search background (Explain only)
  const [historyOpen, setHistoryOpen] = useState(false); // the History popover below xl
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
    setBusy(true);
    setError(null);
    try {
      const { messages: stored } = await api<{ messages: StoredMessage[] }>(`/api/v1/chats/${c.chat_id}/messages`);
      setMessages(stored.map((s) => ({
        role: s.role, text: s.content,
        sources: s.citations.filter((c): c is Source => !isWeb(c)),
        web: s.citations.filter(isWeb),
      })));
      setChatId(c.chat_id);
      setFileId(c.file_id); // a chat stays on the document it started with
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/chats/${id}`, { method: "DELETE" });
      setChats((cs) => cs.filter((c) => c.chat_id !== id));
      if (chatId === id) {
        setChatId(null);
        setMessages([]);
        setPreview(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
      await stream("/api/v1/ask", { question: q, chat_id: chatId, file_id: chatId ? null : fileId, mode, web_search: mode === "explain" && web && canWeb }, ({ event, data }) => {
        if (event === "web") patchLast((m) => ({ ...m, web: data as WebSource[] }));
        else
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
            onClick={() => { setMessages([]); setChatId(null); setError(null); setHistoryOpen(false); }}>
      New chat
    </button>
  );

  return (
    <section className="grid gap-6 xl:grid-cols-[11rem_minmax(0,1fr)]">
      {/* Chapter band: the heading with the chosen document as its running head, ruled beneath. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-fg pb-5 xl:col-span-2">
        <div>
          <h1 className="chapter">Ask</h1>
          <p className="mt-2 max-w-[60ch] text-sm text-muted">Ask questions about your documents and explore explanations with sources.</p>
        </div>
        <select value={fileId ?? ""} onChange={(e) => {
                  setFileId(e.target.value || null);
                  setChatId(null);
                  setMessages([]);
                  setError(null);
                  setPreview(null);
                }}
                disabled={busy} aria-label="Document"
                className="field w-64 max-w-full border-border bg-surface text-left text-base font-bold text-fg sm:w-80">
          <option value="" className="bg-surface text-fg">All documents</option>
          {docs.map((d) => <option key={d.file_id} value={d.file_id} className="bg-surface text-fg">{docName(d)}</option>)}
        </select>
      </div>
      <aside className="hidden space-y-3 xl:block">
        {newChat}
        <h3 className="label px-2 pt-2">History</h3>
        <History chats={chats} chatId={chatId} busy={busy} open={(c) => void open(c)} remove={(id) => void remove(id)} />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Answer style. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex gap-1 rounded-[3px] border border-border bg-surface p-1" role="group" aria-label="Answer style">
            {(["explain", "answer"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                      className={`px-3 py-1.5 text-sm font-semibold transition ${
                        mode === m ? "current" : "text-muted hover:text-fg"}`}>
                {m === "explain" ? "Explain" : "Quick answer"}
              </button>
            ))}
          </div>
          <details className="relative xl:hidden" open={historyOpen} onToggle={(e) => setHistoryOpen(e.currentTarget.open)}>
            <summary className="btn cursor-pointer list-none">History</summary>
            <div className="sheet absolute z-10 mt-1 w-72 space-y-2 p-2">
              {newChat}
              {/* Picking or deleting a chat closes the popover, so the answer isn't hidden behind it. */}
              <History chats={chats} chatId={chatId} busy={busy}
                       open={(c) => { setHistoryOpen(false); void open(c); }}
                       remove={(id) => { setHistoryOpen(false); void remove(id); }} />
            </div>
          </details>
        </div>
        <p className="text-xs text-muted">
          {mode === "explain"
            ? "Explain: step by step in simple words, with examples, based on your document and citing its pages."
            : "Quick answer: only facts stated in your document, with page citations."}
          {chatId && " Changing the document starts a new chat."}
        </p>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

        <div className={`study-content ${messages.length === 0 ? "study-content-empty" : ""}`}>
          <div className="study-messages divide-y divide-border">
            {messages.length === 0 && (
              <div className="study-empty">
                <p className="chapter !text-3xl sm:!text-4xl">What are you stuck on?</p>
                <p className="mt-3 max-w-[52ch] text-sm leading-7 text-muted">
                  Ask in any language. Every answer is printed from your own pages, and the numbers{" "}
                  <sup><span className="hl hl-solid hl-n1 inline-block rounded-[2px] px-1 text-[0.95em] leading-[1.35] font-bold">1</span></sup>{" "}
                  <sup><span className="hl hl-solid hl-n2 inline-block rounded-[2px] px-1 text-[0.95em] leading-[1.35] font-bold">2</span></sup>{" "}
                  open the exact page they came from.
                </p>

                <ul className="study-prompts mt-2">
                  {["Explain the main idea of this chapter in simple words", "What are the key definitions I should memorise?", "Give me 5 questions to test myself on this"].map((q) => (
                    <li key={q}>
                      <button type="button" onClick={() => setQuestion(q)}
                              className="py-1.5 text-left text-[0.97rem] font-normal text-muted hover:text-fg">
                        <span>{q}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                // Keep the question distinct from its sourced answer.
                <p key={i} className="!border-b-0 px-5 pt-6 pb-2 text-[1.05rem] font-semibold whitespace-pre-wrap text-accent sm:px-8">{m.text}</p>
              ) : (
                <div key={i} className="px-5 pb-6 sm:px-8">
                  <Answer m={m} streaming={busy && i === messages.length - 1}
                          onCite={(src) => setPreview({ fileId: src.file_id, page: src.page })} />
                </div>
              ),
            )}
          </div>
          <form onSubmit={ask} className="study-composer sticky bottom-16 flex items-end gap-2 border-t border-border bg-surface p-3 lg:bottom-0">
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
            {/* Web search sits with the input it affects. Explain mode only: Quick answer is "only your document". */}
            <button type="button" onClick={() => setWeb((w) => !w)} aria-pressed={canWeb && mode === "explain" && web}
                    disabled={busy || mode !== "explain" || !canWeb}
                    title={!canWeb ? "Web search is part of Pro"
                      : mode !== "explain" ? "Web search works in Explain mode"
                      : web ? "Web search is on: background from Google Search, only on your documents' subject"
                            : "Add background from the web, only on your documents' subject"}
                    className={`btn shrink-0 !px-2.5 ${canWeb && mode === "explain" && web ? "!border-accent bg-accent-soft text-accent" : "text-muted"}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
              <span className="sr-only">Search the web</span>
            </button>
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
