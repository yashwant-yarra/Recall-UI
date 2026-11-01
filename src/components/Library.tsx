"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCEPT, api, mimeFor, upload } from "@/lib/api";
import type { FileItem } from "@/lib/types";
import { Preview } from "./Preview";
import { Recorder } from "./Recorder";

const STATUS_STYLE: Record<FileItem["status"], string> = {
  pending: "bg-bg text-muted",
  processing: "bg-accent-soft text-accent",
  ready: "bg-accent text-accent-fg",
  failed: "bg-danger/10 text-danger",
};

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Library({ onOpen }: { onOpen: (tab: "chat" | "quiz", fileId: string) => void }) {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // what is uploading right now
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // file waiting for "Yes, delete"
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setFiles((await api<{ files: FileItem[] }>("/api/v1/files")).files);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let live = true; // ignore the answer if the screen unmounted meanwhile
    api<{ files: FileItem[] }>("/api/v1/files")
      .then((r) => live && setFiles(r.files))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  // While anything is still being processed, refresh every 3 seconds; stop once all are settled.
  const unsettled = files?.some((f) => f.status === "pending" || f.status === "processing");
  useEffect(() => {
    if (!unsettled) return;
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [unsettled, load]);

  async function send(blob: Blob, mime: string, label: string) {
    setBusy(label);
    setError(null);
    try {
      await upload(blob, mime, label);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setConfirming(null);
    setError(null);
    try {
      await api(`/api/v1/files/${id}`, { method: "DELETE" });
      setFiles((fs) => fs?.filter((f) => f.file_id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    const mime = mimeFor(file);
    if (!mime) return setError("Supported: PDF, DOCX, TXT, and audio (webm, mp3, m4a, wav).");
    void send(file, mime, file.name);
  }

  return (
    <section className="space-y-6">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Add to your library</h2>
          <p className="mt-1 text-sm text-muted">Documents are split and indexed; voice notes are transcribed and summarized.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept={ACCEPT} onChange={pick} className="hidden" />
          <button onClick={() => input.current?.click()} disabled={!!busy} className="btn-primary">
            Upload file
          </button>
          <Recorder onDone={(audio, mime) => void send(audio, mime, `Voice note, ${new Date().toLocaleString()}`)} />
        </div>
      </div>

      {busy && <p className="text-sm text-muted">Uploading {busy}…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {files === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted">Nothing here yet. Upload a document or record a voice note.</p>
      ) : (
        <ul className="space-y-3">
          {files.map((f) => (
            <li key={f.file_id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{f.name ?? (f.kind === "audio" ? "Voice note" : (TYPE_LABEL[f.mime_type] ?? "Document"))}</span>
                <span className="text-muted">
                  · {f.kind === "audio" ? "voice note" : (TYPE_LABEL[f.mime_type] ?? "document")} · {size(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString()}
                </span>
                <span className={`pill ml-auto ${STATUS_STYLE[f.status]}`}>{f.status}</span>
              </div>
              {f.summary ? (
                <p className="mt-2 text-sm">{f.summary}</p>
              ) : (
                f.preview && <p className="mt-2 line-clamp-2 text-sm text-muted">{f.preview}</p>
              )}
              {f.action_items.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                  {f.action_items.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              {f.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.topics.map((t) => <span key={t} className="pill bg-bg text-muted">{t}</span>)}
                </div>
              )}
              {f.error && <p className="mt-2 text-sm text-danger">{f.error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {f.status === "ready" && (
                  <>
                    <button className="btn" onClick={() => onOpen("chat", f.file_id)}>Ask about this</button>
                    {f.kind === "doc" && <button className="btn" onClick={() => onOpen("quiz", f.file_id)}>Quiz me</button>}
                  </>
                )}
                {f.status !== "pending" && <button className="btn" onClick={() => setPreviewing(f.file_id)}>Preview</button>}
                {confirming === f.file_id ? (
                  <span className="ml-auto flex items-center gap-2 text-sm">
                    <span className="text-danger">Delete this file, its notes and search data?</span>
                    <button className="btn border-danger text-danger" onClick={() => void remove(f.file_id)}>Yes, delete</button>
                    <button className="btn" onClick={() => setConfirming(null)}>Cancel</button>
                  </span>
                ) : (
                  <button className="btn ml-auto text-muted hover:text-danger" onClick={() => setConfirming(f.file_id)}
                          aria-label={`Delete ${f.name ?? "file"}`}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {previewing && <Preview fileId={previewing} onClose={() => setPreviewing(null)} />}
    </section>
  );
}
