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
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0 space-y-6">
        <form onSubmit={make} className="grid gap-3 border-b-2 border-fg pb-6 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="block">
            <span className="label">Document</span>
            <select value={chosen} onChange={(e) => setFileId(e.target.value)} className="field mt-1 font-semibold" disabled={!docs.length}>
              {docs.length === 0 && <option value="">Upload a document first</option>}
              {docs.map((d) => <option key={d.file_id} value={d.file_id}>{docName(d)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Questions</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="field mt-1">
              {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field mt-1">
              <option value="mixed">Mixed</option>
              <option value="mcq">Multiple choice</option>
              <option value="short">Short answer</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Topic <span className="font-normal normal-case tracking-normal">(optional)</span></span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="field mt-1"
                   placeholder="e.g. photosynthesis, chapter 3, Newton's laws" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={!chosen || busy !== null}>
              {busy === "making" ? <><Spinner /> Writing questions…</> : "Make a quiz"}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

        {!quiz && (
          <div className="sheet ruled px-5 py-10 pl-[3.6rem] sm:px-8 sm:pl-[3.6rem]">
            <p className="chapter !text-3xl sm:!text-4xl">Test yourself</p>
            <p className="mt-3 max-w-[52ch] text-sm leading-7 text-muted">Pick a document above and Recall writes questions from its pages.</p>
            <ol className="mt-6 space-y-2 text-[0.97rem] font-semibold">
              <li><span className="hl hl-solid hl-n1 px-1">1</span> Answer without peeking. Correct answers stay hidden.</li>
              <li><span className="hl hl-solid hl-n2 px-1">2</span> Get graded, and see the right answer in green.</li>
              <li><span className="hl hl-solid hl-n3 px-1">3</span> Read the page it came from, then try again.</li>
            </ol>
          </div>
        )}

        {quiz && (
          <div className="sheet px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <h2 className="min-w-0 text-lg font-bold [overflow-wrap:anywhere]">
                {quiz.file_name ?? "Quiz"}{quiz.topic ? ` · ${quiz.topic}` : ""}
              </h2>
              {grade && (
                // The mark, the way a teacher writes it: red pen, top right.
                <p className="chapter !text-4xl text-danger" aria-label={`Score: ${grade.score} out of ${grade.total}`}>
                  {grade.score}<span className="mx-1 font-medium">/</span>{grade.total}
                </p>
              )}
            </div>
            <ol className="divide-y divide-border">
              {shown.map((q, i) => (
                <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] py-5 text-sm">
                  <span className={`text-base font-extrabold ${grade ? (q.correct ? "text-ok" : "text-danger") : ""}`}>{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-[0.97rem] leading-6 font-semibold">
                      {q.question}
                      {q.page !== null && <span className="ml-2 font-normal text-muted">(p. {q.page})</span>}
                    </p>
                    {q.type === "mcq" ? (
                      <div className="mt-3 space-y-1">
                        {q.options.map((opt) => {
                          const picked = answers[i] === opt;
                          const right = grade && opt === q.answer;
                          const wrong = grade && picked && !right;
                          return (
                            <label key={opt} className={`flex items-start gap-2.5 rounded-[3px] px-2 py-1.5 transition ${
                              grade ? "cursor-default" : "cursor-pointer hover:bg-bg"}`}>
                              <input type="radio" name={`q${i}`} checked={picked} disabled={!!grade}
                                     onChange={() => setAnswers((a) => a.map((x, j) => (j === i ? opt : x)))} className="mt-1" />
                              <span className={right ? "hl hl-solid hl-n2 px-0.5 font-semibold" : wrong ? "struck text-muted" : picked ? "font-semibold text-accent" : ""}>
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea value={answers[i] ?? ""} disabled={!!grade} rows={2} maxLength={1000}
                                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                                className="field mt-3 font-medium text-accent" placeholder="Your answer" />
                    )}
                    {grade && (
                      <div className="mt-3 space-y-1 leading-6">
                        <p className={q.correct ? "font-semibold text-ok" : "font-semibold text-danger"}>
                          {q.correct ? "Correct" : "Not quite"}: {q.feedback}
                        </p>
                        {q.type === "short" && <p><span className="text-muted">Answer:</span> <span className="hl hl-solid hl-n2 px-0.5">{q.answer}</span></p>}
                        <p className="text-muted">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {!grade && (
              <button className="btn-primary mt-2" onClick={() => void submit()} disabled={busy !== null || answers.every((a) => !a.trim())}>
                {busy === "grading" ? <><Spinner /> Checking…</> : "Check my answers"}
              </button>
            )}
          </div>
        )}
      </div>

      <aside>
        <h3 className="label px-2">Past quizzes</h3>
        <ul className="mt-2 max-h-[32rem] space-y-0.5 overflow-y-auto">
          {history.map((h) => (
            <li key={h.quiz_id}>
              <button onClick={() => void openPast(h.quiz_id)} disabled={busy !== null}
                      className={`w-full rounded-[3px] px-2 py-1.5 text-left text-xs transition hover:bg-surface ${
                        quiz?.quiz_id === h.quiz_id ? "bg-surface" : ""}`}>
                <span className="line-clamp-1 text-sm font-semibold">{h.file_name ?? "Quiz"}{h.topic ? ` · ${h.topic}` : ""}</span>
                <span className="text-muted">
                  {h.score === null ? "not submitted" : <b className="text-danger">{h.score}/{h.total}</b>} · {new Date(h.created_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
          {history.length === 0 && <li className="px-2 text-xs text-muted">No quizzes yet.</li>}
        </ul>
      </aside>
    </section>
  );
}
