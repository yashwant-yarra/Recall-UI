export type FileItem = {
  file_id: string;
  name: string | null;
  kind: "doc" | "audio";
  mime_type: string;
  size_bytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
  preview: string | null;
  summary: string | null;
  action_items: string[];
  topics: string[];
};

export type Source = { n: number; chunk_id: string; file_id: string; kind?: "doc" | "audio"; page: number | null; name?: string | null };

/** Created by the Agent after the student approved it. `due` is a calendar day, "YYYY-MM-DD". */
export type Task = { id: string; title: string; due: string | null; done: boolean; file_id: string | null; file_name: string | null; created_at: string };
export type Draft = { id: string; title: string; body: string; created_at: string };

/** A web page the tutor's Google Search used. Never cited with [n]; shown under the answer. */
export type WebSource = { kind: "web"; uri: string; title: string };
export const isWeb = (c: Source | WebSource): c is WebSource => c.kind === "web";

export type ChatSummary = { chat_id: string; title: string; created_at: string; file_id: string | null; file_name: string | null };

export type StoredMessage = { role: "user" | "assistant"; content: string; citations: (Source | WebSource)[]; created_at: string };

export type RunStep = {
  step_no: number;
  tool: string;
  args: Record<string, unknown>;
  output: unknown;
  status: "done" | "awaiting_approval" | "rejected";
};

/** One row of the plan table, straight from the API's settings. free 0 = Pro only; pro null = unlimited. */
export type PlanLimit = { key: string; label: string; free: number; pro: number | null; ultra: number | null };
export type Tier = "pro" | "ultra";
/** The account's one free trial of Pro: running now, when it ends, and whether it can still be started. */
export type Trial = { active: boolean; ends_at: string | null; available: boolean; blocked?: string | null };
export type Me = { user_id: string; plan: "free" | Tier; paid_until?: string | null; email_verified?: boolean; trial?: Trial; limits?: PlanLimit[] };

export type AgentRun = {
  run_id: string;
  goal: string;
  status: "running" | "awaiting_approval" | "done" | "failed";
  answer: string | null;
  error: string | null;
  created_at: string;
};

export type RunDetail = AgentRun & { steps: RunStep[] };

export type QuizQuestion = {
  type: "mcq" | "short";
  question: string;
  options: string[];
  page: number | null;
  // present once graded
  answer?: string;
  explanation?: string;
  correct?: boolean;
  feedback?: string;
};

export type Quiz = {
  quiz_id: string;
  file_id: string | null;
  file_name: string | null;
  topic: string | null;
  questions: QuizQuestion[];
  answers?: string[] | null;
  score?: number | null;
  total?: number;
};

export type QuizSummary = { quiz_id: string; file_name: string | null; topic: string | null; created_at: string; total: number; score: number | null };
