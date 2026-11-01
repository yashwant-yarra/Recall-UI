"use client";

import { useCallback, useEffect, useState } from "react";
import { api, stream, type StreamEvent } from "@/lib/api";
import type { AgentRun, RunDetail } from "@/lib/types";
import { useReveal } from "@/lib/useReveal";
import { Loading, Spinner } from "./Spinner";

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

function AnswerCard({ text, live }: { text: string; live: boolean }) {
  const shown = useReveal(text, live);
  return <li className="sheet max-w-[72ch] px-5 py-4 text-[0.97rem] leading-7 whitespace-pre-wrap sm:px-6">{shown}</li>;
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
  const [goal, setGoal] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);

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

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-4">
        <form onSubmit={start} className="flex gap-2">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={2000} aria-label="Goal"
                 placeholder="e.g. Make a task for every action item in my latest voice note" className="field font-medium text-accent" />
          <button type="submit" disabled={busy || !goal.trim()} className="btn-primary shrink-0">
            {busy ? <><Spinner /> Working…</> : "Run"}
          </button>
        </form>
        <p className="text-xs text-muted">The agent reads freely, but asks you before it creates a task or saves a draft.</p>

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
                  <Args args={it.args} />
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
                  <Args args={it.args} />
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => decide(true)}>Approve</button>
                    <button className="btn" disabled={busy} onClick={() => decide(false)}>Reject</button>
                  </div>
                </li>
              );
            if (it.type === "answer") return <AnswerCard key={i} text={it.text} live={it.live} />;
            return <li key={i} role="alert" className="text-sm text-danger">{it.message}</li>;
          })}
          {busy && items.at(-1)?.type !== "answer" && <li><Loading text="Working…" /></li>}
        </ol>
      </div>

      <aside>
        <h3 className="label px-2">History</h3>
        <ul className="mt-2 max-h-[32rem] space-y-0.5 overflow-y-auto">
          {runs.map((r) => (
            <li key={r.run_id}>
              <button onClick={() => void openRun(r.run_id)} disabled={busy}
                      className={`w-full rounded-[3px] px-2 py-1.5 text-left text-xs transition hover:bg-surface ${
                        r.run_id === runId ? "bg-surface" : ""}`}>
                <span className="line-clamp-2 text-sm font-semibold">{r.goal}</span>
                <span className={r.status === "awaiting_approval" ? "font-bold text-warn" : r.status === "failed" ? "text-danger" : "text-muted"}>
                  {r.status.replace("_", " ")} · {new Date(r.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
          {runs.length === 0 && <li className="text-xs text-muted">No runs yet.</li>}
        </ul>
      </aside>
    </section>
  );
}
