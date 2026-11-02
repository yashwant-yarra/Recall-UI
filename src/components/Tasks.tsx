"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Draft, Task } from "@/lib/types";
import { AnswerText } from "./Chat";
import { Loading } from "./Spinner";

// A due date is a calendar day, not an instant: build it in local time so it never shifts a day.
function dueDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isOverdue(t: Task) {
  if (!t.due || t.done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate(t.due) < today;
}

export function Tasks({ refreshKey, onAgent }: { refreshKey: number; onAgent: () => void }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // task or draft waiting for "Yes, delete"
  const [open, setOpen] = useState<string | null>(null); // draft shown in full
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([
        api<{ tasks: Task[] }>("/api/v1/tasks"),
        api<{ drafts: Draft[] }>("/api/v1/drafts"),
      ]);
      setTasks(t.tasks);
      setDrafts(d.drafts);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload whenever the tab is opened: the Agent may have added something since.
  useEffect(() => {
    let live = true;
    Promise.all([api<{ tasks: Task[] }>("/api/v1/tasks"), api<{ drafts: Draft[] }>("/api/v1/drafts")])
      .then(([t, d]) => {
        if (!live) return;
        setTasks(t.tasks);
        setDrafts(d.drafts);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [refreshKey]);

  async function toggle(t: Task) {
    setTasks((ts) => ts?.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)) ?? null); // instant, undone on failure
    try {
      await api(`/api/v1/tasks/${t.id}/done`, { method: "POST", body: { done: !t.done } });
    } catch (e) {
      setError((e as Error).message);
      void load();
    }
  }

  async function remove(kind: "tasks" | "drafts", id: string) {
    setConfirming(null);
    try {
      await api(`/api/v1/${kind}/${id}`, { method: "DELETE" });
      if (kind === "tasks") setTasks((ts) => ts?.filter((t) => t.id !== id) ?? null);
      else setDrafts((ds) => ds?.filter((d) => d.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copy(d: Draft) {
    try {
      await navigator.clipboard.writeText(`${d.title}\n\n${d.body}`);
      setCopied(d.id);
      setTimeout(() => setCopied((c) => (c === d.id ? null : c)), 2000);
    } catch {
      setError("Could not copy. Select the text and copy it instead.");
    }
  }

  const empty = (title: string, text: string) => (
    <div className="ruled px-5 py-8 pl-[3.6rem] sm:px-8 sm:pl-[3.6rem]">
      <p className="chapter !text-2xl sm:!text-3xl">{title}</p>
      <p className="mt-3 max-w-[52ch] text-sm leading-7 text-muted">{text}</p>
      <button type="button" onClick={onAgent} className="btn mt-4">Open the Agent</button>
    </div>
  );

  return (
    <section className="max-w-4xl space-y-8">
      <p className="max-w-[65ch] text-sm text-muted">
        What the Agent created for you after you approved it. Tick tasks off, copy drafts out, delete what you no longer need.
      </p>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

      <div className="space-y-3">
        <h2 className="border-b-2 border-fg pb-2 text-lg font-bold">Tasks</h2>
        {tasks === null ? (error ? null : <Loading />) : tasks.length === 0 ? (
          <div className="sheet">{empty("No tasks yet", "Ask the Agent to turn action items from a voice note or your notes into tasks. It asks before it creates any.")}</div>
        ) : (
          <ul className="sheet divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                <input type="checkbox" checked={t.done} onChange={() => void toggle(t)}
                       aria-label={`${t.done ? "Mark not done" : "Mark done"}: ${t.title}`}
                       className="mt-1 h-4 w-4 shrink-0 cursor-pointer" />
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${t.done ? "text-muted line-through decoration-1" : ""}`}>{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted [overflow-wrap:anywhere]">
                    {t.due && (
                      <span className={isOverdue(t) ? "font-semibold text-danger" : ""}>
                        {isOverdue(t) ? "Overdue, " : "Due "}
                        {dueDate(t.due).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {t.file_name && <span>From {t.file_name}</span>}
                  </p>
                </div>
                {confirming === t.id ? (
                  <span className="flex shrink-0 items-center gap-2 text-sm">
                    <button className="btn border-danger text-danger hover:border-danger" onClick={() => void remove("tasks", t.id)}>Yes, delete</button>
                    <button className="btn" onClick={() => setConfirming(null)}>Cancel</button>
                  </span>
                ) : (
                  <button className="shrink-0 px-2 py-1 text-sm font-semibold text-muted transition hover:text-danger"
                          onClick={() => setConfirming(t.id)} aria-label={`Delete task: ${t.title}`}>Delete</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="border-b-2 border-fg pb-2 text-lg font-bold">Drafts</h2>
        {drafts === null ? (error ? null : <Loading />) : drafts.length === 0 ? (
          <div className="sheet">{empty("No drafts yet", "Ask the Agent to summarise a chapter or write study notes and save it as a draft. It asks before it saves.")}</div>
        ) : (
          <ul className="sheet divide-y divide-border">
            {drafts.map((d) => (
              <li key={d.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-bold">{d.title}</p>
                  <p className="text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                {/* Rendered like an answer (bullets, bold, headings, maths); collapsed it fades out after a few lines. */}
                <div className={`mt-2 ${open === d.id ? "" : "max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"}`}>
                  <AnswerText text={d.body} sources={[]} onCite={() => {}} active={null} setActive={() => {}} citations={false} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="btn" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                    {open === d.id ? "Show less" : "Read all"}
                  </button>
                  <button className="btn" onClick={() => void copy(d)}>{copied === d.id ? "Copied" : "Copy"}</button>
                  {confirming === d.id ? (
                    <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                      <button className="btn border-danger text-danger hover:border-danger" onClick={() => void remove("drafts", d.id)}>Yes, delete</button>
                      <button className="btn" onClick={() => setConfirming(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="ml-auto px-2 py-2 text-sm font-semibold text-muted transition hover:text-danger"
                            onClick={() => setConfirming(d.id)} aria-label={`Delete draft: ${d.title}`}>Delete</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
