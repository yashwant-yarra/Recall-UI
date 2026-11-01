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

export type ChatSummary = { chat_id: string; title: string; created_at: string; file_id: string | null; file_name: string | null };

export type StoredMessage = { role: "user" | "assistant"; content: string; citations: Source[]; created_at: string };

export type RunStep = {
  step_no: number;
  tool: string;
  args: Record<string, unknown>;
  output: unknown;
  status: "done" | "awaiting_approval" | "rejected";
};

export type Me = { user_id: string; plan: "free" | "pro" };

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
