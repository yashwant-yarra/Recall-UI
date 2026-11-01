"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCEPT, api, mimeFor, upload } from "@/lib/api";
import type { FileItem } from "@/lib/types";
import { Preview } from "./Preview";
import { Recorder } from "./Recorder";
import { Loading } from "./Spinner";

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Status as a mark in a fixed cell: filled = ready, hollow = still working, struck = failed. */
function StatusMark({ status }: { status: FileItem["status"] }) {
  const box = "mt-1 h-3.5 w-3.5 shrink-0 rounded-[2px] border-2";
  if (status === "ready") return <span className={`${box} border-ok bg-ok`} aria-hidden />;
  if (status === "failed")
    return (
      <svg viewBox="0 0 14 14" className="mt-1 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M2 12 12 2" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  return <span className={`${box} ${status === "processing" ? "animate-pulse border-warn" : "border-dashed border-muted"}`} aria-hidden />;
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
    <section className="max-w-4xl space-y-5">
      <div className="flex flex-col gap-4 border-b-2 border-fg pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Add to your library</h2>
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

      {busy && <Loading text={`Uploading ${busy}…`} />}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

      {files === null ? (
        <Loading />
      ) : files.length === 0 ? (
        <p className="py-6 text-sm text-muted">Nothing here yet. Upload a document or record a voice note.</p>
      ) : (
        <ul className="sheet divide-y divide-border">
          {files.map((f) => (
            <li key={f.file_id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 px-4 py-4 sm:px-6">
              <StatusMark status={f.status} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`font-bold ${f.status === "failed" ? "struck" : ""}`}>
                    {f.name ?? (f.kind === "audio" ? "Voice note" : (TYPE_LABEL[f.mime_type] ?? "Document"))}
                  </span>
                  <span className="text-sm text-muted">
                    {f.kind === "audio" ? "voice note" : (TYPE_LABEL[f.mime_type] ?? "document")} · {size(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString()}
                  </span>
                  <span className={`label ml-auto ${f.status === "failed" ? "!text-danger" : f.status === "ready" ? "!text-ok" : ""}`}>
                    {f.status}
                  </span>
                </div>
                {f.summary ? (
                  <p className="mt-2 max-w-[68ch] text-sm leading-6">{f.summary}</p>
                ) : (
                  f.preview && <p className="mt-2 line-clamp-2 max-w-[68ch] text-sm text-muted">{f.preview}</p>
                )}
                {f.action_items.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm marker:text-muted">
                    {f.action_items.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                )}
                {f.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                    {f.topics.map((t, i) => <span key={t} className={`hl hl-n${(i % 5) + 1}`}>{t}</span>)}
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
                    <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-danger">Delete this file, its notes and search data?</span>
                      <button className="btn border-danger text-danger hover:border-danger" onClick={() => void remove(f.file_id)}>Yes, delete</button>
                      <button className="btn" onClick={() => setConfirming(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="ml-auto px-2 py-2 text-sm font-semibold text-muted transition hover:text-danger"
                            onClick={() => setConfirming(f.file_id)} aria-label={`Delete ${f.name ?? "file"}`}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {previewing && <Preview fileId={previewing} onClose={() => setPreviewing(null)} />}
    </section>
  );
}
