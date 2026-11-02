"use client";

import { useCallback, useEffect, useState } from "react";
import { api, stream, type StreamEvent } from "@/lib/api";
import type { AgentRun, RunDetail } from "@/lib/types";
import { docName, useFiles } from "@/lib/useFiles";
import { useReveal } from "@/lib/useReveal";
import { AnswerText } from "./Chat";
import { LoadingMark } from "./Spinner";

type Item =
  | { type: "step"; tool: string; args: Record<string, unknown>; output: unknown; approved?: boolean }
  | { type: "approval"; tool: string; args: Record<string, unknown> }
  | { type: "answer"; text: string; live: boolean }
  | { type: "error"; message: string };

const TOOL_LABEL: Record<string, string> = {
  search_knowledge: "Searched your library",
  get_document: "Read a document",
  list_voice_notes: "Listed voice notes",
  get_transcript: "Read a transcript",
  create_task: "Create a task",
  save_draft: "Save a draft",
};
const WRITE_TOOLS = new Set(["create_task", "save_draft"]);

function Args({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (!entries.length) return null;
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="whitespace-pre-wrap break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What a write tool will save, shown the way it will look afterwards (not as raw arguments). */
function WriteArgs({ tool, args, fileNames }: { tool: string; args: Record<string, unknown>; fileNames: Map<string, string> }) {
  const title = typeof args.title === "string" ? args.title : "";
  if (tool === "save_draft") {
    const body = typeof args.body === "string" ? args.body : "";
    return (
      <div className="mt-2">
        <p className="text-base font-bold">{title}</p>
        {body && (
          <div className="mt-2 max-h-80 overflow-auto rounded-[3px] border border-border bg-bg px-4 py-3">
            <AnswerText text={body} sources={[]} onCite={() => {}} active={null} setActive={() => {}} citations={false} />
          </div>
        )}
      </div>
    );
  }
  // create_task: the due date is a calendar day, so build it in local time.
  let due = "";
  if (typeof args.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due)) {
    const [y, m, d] = args.due.split("-").map(Number);
    due = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  const file = typeof args.source_file_id === "string" ? fileNames.get(args.source_file_id) : undefined;
  return (
    <div className="mt-2">
      <p className="text-base font-bold">{title}</p>
      {(due || file) && (
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
          {due && <span>Due {due}</span>}
          {file && <span>From {file}</span>}
        </p>
      )}
    </div>
  );
}

function AnswerCard({ text, live }: { text: string; live: boolean }) {
  const shown = useReveal(text, live);
  return <li className="sheet max-w-[72ch] px-5 py-4 sm:px-6">
    <AnswerText text={shown} sources={[]} onCite={() => {}} active={null} setActive={() => {}} citations={false} />
  </li>;
}

function AgentLoading() {
  return (
    <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <LoadingMark />
      <div>
        <p className="font-semibold">Working on your request</p>
        <p className="mt-1 text-sm text-muted">Your agent is putting the pieces together.</p>
      </div>
    </div>
  );
}

// A live answer is text still streaming in; if a tool step follows, that text was a draft, so drop it.
const dropLiveAnswer = (xs: Item[]) => (xs.at(-1)?.type === "answer" && (xs.at(-1) as { live: boolean }).live ? xs.slice(0, -1) : xs);

/** Turns a stored run (from history) back into the same items a live run shows. */
function itemsFrom(run: RunDetail): Item[] {
  const items: Item[] = run.steps.map((s) =>
    s.status === "awaiting_approval"
      ? { type: "approval", tool: s.tool, args: s.args }
      : { type: "step", tool: s.tool, args: s.args, output: s.output,
          approved: s.status === "rejected" ? false : WRITE_TOOLS.has(s.tool) ? true : undefined },
  );
  if (run.answer) items.push({ type: "answer", text: run.answer, live: false });
  if (run.error) items.push({ type: "error", message: run.error });
  return items;
}

export function Agent() {
  // File names for the tasks the agent links to a document (it only knows the id).
  const fileNames = new Map(useFiles(0).map((f) => [f.file_id, docName(f)] as const));
  const [goal, setGoal] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadRuns = useCallback(
    () => api<{ runs: AgentRun[] }>("/api/v1/agent/runs").then((r) => setRuns(r.runs)).catch(() => {}),
    [],
  );

  useEffect(() => {
    let live = true;
    api<{ runs: AgentRun[] }>("/api/v1/agent/runs").then((r) => live && setRuns(r.runs)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function onEvent({ event, data }: StreamEvent) {
    const d = data as Record<string, unknown>;
    if (event === "run") setRunId(d.run_id as string);
    else if (event === "token")
      setItems((xs) => {
        const last = xs.at(-1);
        return last?.type === "answer" && last.live
          ? [...xs.slice(0, -1), { ...last, text: last.text + (d.text as string) }]
          : [...xs, { type: "answer", text: d.text as string, live: true }];
      });
    else if (event === "step")
      setItems((xs) => [
        // An approved or rejected write replaces its approval card.
        ...dropLiveAnswer(xs).filter((x) => x.type !== "approval"),
        { type: "step", tool: d.tool as string, args: d.args as Record<string, unknown>, output: d.output,
          approved: d.approved as boolean | undefined },
      ]);
    else if (event === "approval_needed")
      setItems((xs) => [...dropLiveAnswer(xs), { type: "approval", tool: d.tool as string, args: d.args as Record<string, unknown> }]);
    else if (event === "answer")
      setItems((xs) => {
        // Same card the tokens built, now with the final text: the reveal carries on without restarting.
        const last = xs.at(-1);
        return last?.type === "answer" && last.live
          ? [...xs.slice(0, -1), { ...last, text: d.text as string }]
          : [...xs, { type: "answer", text: d.text as string, live: true }];
      });
    else if (event === "error") setItems((xs) => [...dropLiveAnswer(xs), { type: "error", message: d.message as string }]);
  }

  async function run(path: string, body: unknown) {
    setBusy(true);
    try {
      await stream(path, body, onEvent);
    } catch (err) {
      setItems((xs) => [...xs, { type: "error", message: (err as Error).message }]);
    } finally {
      setBusy(false);
      void loadRuns();
    }
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setItems([]);
    setRunId(null);
    void run("/api/v1/agent/runs", { goal: goal.trim() });
  }

  async function openRun(id: string) {
    if (busy) return;
    try {
      const detail = await api<RunDetail>(`/api/v1/agent/runs/${id}`);
      setRunId(id);
      setGoal(detail.goal);
      setItems(itemsFrom(detail));
    } catch (e) {
      setItems([{ type: "error", message: (e as Error).message }]);
    }
  }

  const decide = (approve: boolean) => runId && void run(`/api/v1/agent/runs/${runId}/approve`, { approve });

  async function deleteRun(id: string) {
    setDeleting(true);
    setHistoryError("");
    try {
      await api(`/api/v1/agent/runs/${id}`, { method: "DELETE" });
      setRuns((xs) => xs.filter((r) => r.run_id !== id));
      if (runId === id) {
        setRunId(null);
        setItems([]);
        setGoal("");
      }
      setConfirming(null);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <p className="max-w-[72ch] text-sm text-muted lg:col-span-2">
        Give the agent a goal and it can search your documents and voice notes, create tasks, or save drafts.
        It will ask for your approval before creating a task or saving a draft.
      </p>
      <div className="min-w-0 space-y-4">
        <form onSubmit={start} className="flex gap-2">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={2000} aria-label="Goal"
                 placeholder="e.g. Make a task for every action item in my latest voice note" className="field font-medium text-accent" />
          <button type="submit" disabled={busy || !goal.trim()} className="btn-primary shrink-0">
            Run
          </button>
        </form>
        {items.length === 0 && !busy && (
          <div className="sheet ruled px-5 py-10 pl-[3.6rem] sm:px-8 sm:pl-[3.6rem]">
            <p className="chapter !text-3xl sm:!text-4xl">Hand it a goal</p>
            <p className="mt-3 max-w-[52ch] text-sm leading-7 text-muted">
              The agent searches your material and works out the steps. Anything it would write, you approve first.
            </p>
            <p className="label mt-7">Try a goal</p>
            <ul className="mt-2">
              {["Make a task for every action item in my latest voice note", "Summarise my notes on this chapter and save it as a draft", "Find every definition in my documents"].map((g, i) => (
                <li key={g}>
                  <button type="button" onClick={() => setGoal(g)} className="py-1.5 text-left text-[0.97rem] font-semibold text-accent hover:text-fg">
                    <span className={`hl hl-n${i + 1} box-decoration-clone`}>{g}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ol className="space-y-3">
          {items.map((it, i) => {
            if (it.type === "step")
              return (
                <li key={i} className="border-b border-border px-1 pb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${it.approved === false ? "struck text-muted" : ""}`}>{TOOL_LABEL[it.tool] ?? it.tool}</span>
                    {it.approved === true && <span className="label !text-ok">approved</span>}
                    {it.approved === false && <span className="label !text-danger">rejected</span>}
                  </div>
                  {WRITE_TOOLS.has(it.tool) ? <WriteArgs tool={it.tool} args={it.args} fileNames={fileNames} /> : <Args args={it.args} />}
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer">Result</summary>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(it.output, null, 2)}</pre>
                  </details>
                </li>
              );
            if (it.type === "approval")
              return (
                <li key={i} className="sheet px-5 py-4 text-sm">
                  <p className="text-base font-bold"><span className="hl hl-solid hl-n4 px-0.5">Approve: {TOOL_LABEL[it.tool] ?? it.tool}?</span></p>
                  <WriteArgs tool={it.tool} args={it.args} fileNames={fileNames} />
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>Approve</button>
                    <button className="btn" disabled={busy} onClick={() => decide(false)}>Reject</button>
                  </div>
                </li>
              );
            if (it.type === "answer") return <AnswerCard key={i} text={it.text} live={it.live} />;
            return <li key={i} role="alert" className="text-sm text-danger">{it.message}</li>;
          })}
          {busy && items.at(-1)?.type !== "answer" && <li><AgentLoading /></li>}
        </ol>
      </div>

      <aside>
        <h3 className="label px-2">History</h3>
        <ul className="mt-2 max-h-[32rem] space-y-0.5 overflow-y-auto">
          {runs.map((r) => (
            <li key={r.run_id} className="flex flex-wrap items-center">
              <button onClick={() => void openRun(r.run_id)} disabled={busy || deleting}
                      className={`min-w-0 flex-1 rounded-[3px] px-2 py-1.5 text-left text-xs transition hover:bg-surface ${
                        r.run_id === runId ? "bg-surface" : ""}`}>
                <span className="line-clamp-2 text-sm font-semibold">{r.goal}</span>
                <span className={r.status === "awaiting_approval" ? "font-bold text-warn" : r.status === "failed" ? "text-danger" : "text-muted"}>
                  {r.status.replace("_", " ")} · {new Date(r.created_at).toLocaleDateString()}
                </span>
              </button>
              {(r.status === "done" || r.status === "failed") && (
                <button disabled={busy || deleting} onClick={() => setConfirming(r.run_id)}
                        aria-label={`Delete agent run: ${r.goal}`} title="Delete run"
                        className="shrink-0 px-2 py-2 text-muted hover:text-danger">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                  </svg>
                </button>
              )}
              {confirming === r.run_id && (
                <div className="w-full space-y-2 px-2 py-2 text-sm">
                  <p className="text-danger">Delete this run and its history? Tasks and drafts will remain. This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button className="btn border-danger text-danger" disabled={busy || deleting} onClick={() => void deleteRun(r.run_id)}>Yes, delete</button>
                    <button className="btn" disabled={deleting} onClick={() => setConfirming(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {runs.length === 0 && <li className="px-2 text-xs text-muted">No runs yet.</li>}
        </ul>
        {historyError && <p role="alert" className="px-2 text-xs text-danger">{historyError}</p>}
      </aside>
    </section>
  );
}
