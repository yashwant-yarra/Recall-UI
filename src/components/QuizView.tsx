"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Quiz, QuizSummary } from "@/lib/types";
import { docName, useFiles } from "@/lib/useFiles";
import { Spinner } from "./Spinner";

type Grade = { score: number; total: number; answers: string[]; results: Quiz["questions"] };

export function QuizView({ initialFileId, refreshKey }: { initialFileId: string | null; refreshKey: number }) {
  const docs = useFiles(refreshKey).filter((f) => f.status === "ready" && f.kind === "doc");
  const [fileId, setFileId] = useState<string>(initialFileId ?? "");
  const [count, setCount] = useState(5);
  const [kind, setKind] = useState<"mixed" | "mcq" | "short">("mixed");
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState<"making" | "grading" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QuizSummary[]>([]);

  const loadHistory = useCallback(
    () => api<{ quizzes: QuizSummary[] }>("/api/v1/quizzes").then((r) => setHistory(r.quizzes)).catch(() => {}),
    [],
  );

  useEffect(() => {
    let live = true;
    api<{ quizzes: QuizSummary[] }>("/api/v1/quizzes").then((r) => live && setHistory(r.quizzes)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const chosen = fileId || docs[0]?.file_id || "";

  async function make(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setBusy("making");
    setError(null);
    setGrade(null);
    try {
      const q = await api<Quiz>("/api/v1/quizzes", {
        method: "POST",
        body: { file_id: chosen, count, kind, topic: topic.trim() || null },
      });
      setQuiz(q);
      setAnswers(q.questions.map(() => ""));
      void loadHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!quiz) return;
    setBusy("grading");
    setError(null);
    try {
      setGrade(await api<Grade>(`/api/v1/quizzes/${quiz.quiz_id}/grade`, { method: "POST", body: { answers } }));
      void loadHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function openPast(id: string) {
    if (busy) return;
    setError(null);
    try {
      const q = await api<Quiz>(`/api/v1/quizzes/${id}`);
      setQuiz(q);
      if (q.score !== null && q.score !== undefined) {
        setGrade({ score: q.score, total: q.total ?? q.questions.length, answers: q.answers ?? [], results: q.questions });
        setAnswers(q.answers ?? []);
      } else {
        setGrade(null);
        setAnswers(q.questions.map(() => ""));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const shown = grade ? grade.results : quiz?.questions ?? [];

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_15rem]">
      <div className="space-y-5">
        <form onSubmit={make} className="card grid gap-3 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Document</span>
            <select value={chosen} onChange={(e) => setFileId(e.target.value)} className="field mt-1" disabled={!docs.length}>
              {docs.length === 0 && <option value="">Upload a document first</option>}
              {docs.map((d) => <option key={d.file_id} value={d.file_id}>{docName(d)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Questions</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="field mt-1">
              {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field mt-1">
              <option value="mixed">Mixed</option>
              <option value="mcq">Multiple choice</option>
              <option value="short">Short answer</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Topic <span className="font-normal text-muted">(optional)</span></span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="field mt-1"
                   placeholder="e.g. photosynthesis, chapter 3, Newton's laws" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={!chosen || busy !== null}>
              {busy === "making" ? <><Spinner /> Writing questions…</> : "Make a quiz"}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        {quiz && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {quiz.file_name ?? "Quiz"}{quiz.topic ? ` · ${quiz.topic}` : ""}
              </h2>
              {grade && (
                <span className="pill bg-accent text-accent-fg text-sm">Score: {grade.score} / {grade.total}</span>
              )}
            </div>
            <ol className="space-y-4">
              {shown.map((q, i) => (
                <li key={i} className={`card p-4 text-sm ${grade ? (q.correct ? "border-accent" : "border-danger") : ""}`}>
                  <p className="font-medium">
                    {i + 1}. {q.question}
                    {q.page !== null && <span className="ml-2 font-normal text-muted">(p. {q.page})</span>}
                  </p>
                  {q.type === "mcq" ? (
                    <div className="mt-3 space-y-1.5">
                      {q.options.map((opt) => {
                        const picked = answers[i] === opt;
                        const right = grade && opt === q.answer;
                        return (
                          <label key={opt} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
                            right ? "border-accent bg-accent-soft" : picked && grade ? "border-danger" : "border-border"}`}>
                            <input type="radio" name={`q${i}`} checked={picked} disabled={!!grade}
                                   onChange={() => setAnswers((a) => a.map((x, j) => (j === i ? opt : x)))} className="mt-0.5" />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea value={answers[i] ?? ""} disabled={!!grade} rows={2} maxLength={1000}
                              onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                              className="field mt-3" placeholder="Your answer" />
                  )}
                  {grade && (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      <p className={q.correct ? "font-medium text-accent" : "font-medium text-danger"}>
                        {q.correct ? "Correct" : "Not quite"}: {q.feedback}
                      </p>
                      {q.type === "short" && <p><span className="text-muted">Answer:</span> {q.answer}</p>}
                      <p className="text-muted">{q.explanation}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {!grade && (
              <button className="btn-primary" onClick={() => void submit()} disabled={busy !== null || answers.every((a) => !a.trim())}>
                {busy === "grading" ? <><Spinner /> Checking…</> : "Check my answers"}
              </button>
            )}
          </div>
        )}
      </div>

      <aside>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Past quizzes</h3>
        <ul className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto">
          {history.map((h) => (
            <li key={h.quiz_id}>
              <button onClick={() => void openPast(h.quiz_id)} disabled={busy !== null}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-surface ${
                        quiz?.quiz_id === h.quiz_id ? "bg-surface" : ""}`}>
                <span className="line-clamp-1 font-medium">{h.file_name ?? "Quiz"}{h.topic ? ` · ${h.topic}` : ""}</span>
                <span className="text-muted">
                  {h.score === null ? "not submitted" : `${h.score}/${h.total}`} · {new Date(h.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
          {history.length === 0 && <li className="text-xs text-muted">No quizzes yet.</li>}
        </ul>
      </aside>
    </section>
  );
}
