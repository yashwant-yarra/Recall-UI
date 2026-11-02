import { auth } from "./firebase";

const API = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Not signed in");
  // getIdToken() returns a cached token and refreshes it shortly before it expires (1 hour).
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
  } catch {
    // not JSON: keep the status text
  }
  return new ApiError(res.status, message);
}

/** JSON request to the Recall API with the user's Firebase token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(await authHeaders()),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T; // e.g. DELETE: success with no body
  return res.json() as Promise<T>;
}

export type StreamEvent = { event: string; data: unknown };

/**
 * POST to an SSE endpoint and call onEvent for each event as it arrives.
 * The browser's EventSource can't do this: it only sends GET requests and can't add an
 * Authorization header, so the stream is read by hand from fetch().
 */
export async function stream(path: string, body: unknown, onEvent: (e: StreamEvent) => void): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ApiError(500, "No response stream");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // Events are separated by a blank line; the last piece may still be incomplete.
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data.push(line.slice(6));
      }
      if (data.length) onEvent({ event, data: JSON.parse(data.join("\n")) });
    }
  }
}

// Mime types the API accepts (its allow-list), with fallbacks for names browsers report differently.
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  webm: "audio/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};
const ALLOWED = new Set(Object.values(MIME_BY_EXT));
const ALIASES: Record<string, string> = { "audio/x-m4a": "audio/mp4", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/mp3": "audio/mpeg" };

export function mimeFor(file: File): string | null {
  const base = (file.type || "").split(";")[0];
  const fromType = ALIASES[base] ?? base;
  if (ALLOWED.has(fromType)) return fromType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export const ACCEPT = Object.keys(MIME_BY_EXT).map((e) => `.${e}`).join(",");

/**
 * Upload in two steps: ask the API for a signed URL, then PUT the bytes straight to Cloud Storage.
 * The signed URL fixes the exact type and size and is create-only, so the headers must match.
 */
export async function upload(file: Blob, mime: string, name?: string): Promise<string> {
  const { file_id, upload_url, upload_headers } = await api<{
    file_id: string;
    upload_url: string;
    upload_headers: Record<string, string>;
  }>("/api/v1/files", { method: "POST", body: { mime_type: mime, size_bytes: file.size, display_name: name } });
  const put = await fetch(upload_url, { method: "PUT", headers: upload_headers, body: file });
  if (!put.ok) throw new ApiError(put.status, `Upload to storage failed (${put.status})`);
  return file_id;
}

/** Send a recording as the raw request body (e.g. voice input); returns the JSON reply. */
export async function postAudio<T>(path: string, audio: Blob, mime: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": mime },
    body: audio,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

/** POST JSON and get audio back (e.g. read-aloud). The signal lets a Stop button cancel it. */
export async function fetchAudio(path: string, body: unknown, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

/** Read 24 kHz mono 16-bit little-endian PCM as it is generated. */
export async function streamAudio(text: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API}/api/v1/speech/tts/stream`, {
    method: "POST", headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ text }), signal,
  });
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ApiError(500, "No audio stream");
  return res.body;
}
