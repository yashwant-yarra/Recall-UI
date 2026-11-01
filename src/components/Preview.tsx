"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type FileUrl = { url: string; mime_type: string; kind: "doc" | "audio"; name: string | null };
type Page = { page: number | null; text: string };

/**
 * Shows a file in a dialog: PDFs in the browser's PDF viewer (opened at `page` when given),
 * voice notes with a player and their transcript, DOCX/TXT as their extracted text.
 * The file comes straight from Cloud Storage through a short-lived signed link.
 */
export function Preview({ fileId, page, onClose }: { fileId: string; page?: number | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<FileUrl | null>(null);
  const [pages, setPages] = useState<Page[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal(); // native modal: traps focus, closes on Escape
  }, []);

  useEffect(() => {
    let live = true;
    api<FileUrl>(`/api/v1/files/${fileId}/url`)
      .then((f) => {
        if (!live) return;
        setFile(f);
        // PDFs and plain text show the original; voice notes and Word files show extracted text.
        if (f.kind === "audio" || f.mime_type.includes("wordprocessingml")) {
          api<{ pages: Page[] }>(`/api/v1/files/${fileId}/text`).then((r) => live && setPages(r.pages)).catch(() => {});
        }
      })
      .catch((e: Error) => live && setError(e.message === "File not found" ? "This file was deleted." : e.message));
    return () => {
      live = false;
    };
  }, [fileId]);

  const pdf = file?.mime_type === "application/pdf";
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()} // click on the backdrop
      className="m-auto h-[85vh] w-[min(56rem,94vw)] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="truncate text-sm font-medium">
            {file?.name ?? (file?.kind === "audio" ? "Voice note" : "Document")}
            {pdf && page ? <span className="text-muted"> · page {page}</span> : null}
          </p>
          <div className="flex shrink-0 gap-2">
            {file && <a href={file.url} target="_blank" rel="noreferrer" className="btn">Open in new tab</a>}
            <button className="btn" onClick={() => dialog.current?.close()} autoFocus>Close</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {error && <p role="alert" className="p-4 text-sm text-danger">{error}</p>}
          {!file && !error && <p className="p-4 text-sm text-muted">Loading…</p>}
          {file && pdf && (
            // #page=N is understood by the PDF viewers in Chrome, Edge, Firefox and Safari.
            <iframe src={`${file.url}#page=${page ?? 1}`} title={file.name ?? "Document"} className="h-full w-full" />
          )}
          {file && file.mime_type === "text/plain" && <iframe src={file.url} title={file.name ?? "Text"} className="h-full w-full bg-white" />}
          {file && file.kind === "audio" && (
            <div className="space-y-4 p-4">
              <audio controls src={file.url} className="w-full" />
              <h3 className="text-sm font-semibold">Transcript</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{pages ? pages.map((p) => p.text).join("\n") : "Loading…"}</p>
            </div>
          )}
          {file && file.mime_type.includes("wordprocessingml") && (
            <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed">
              <p className="mb-3 text-xs text-muted">Word files can&apos;t be shown in the browser, so this is the text extracted from it.</p>
              {pages ? pages.map((p) => p.text).join("\n\n") : "Loading…"}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
