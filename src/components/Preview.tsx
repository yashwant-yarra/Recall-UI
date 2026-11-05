"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loading } from "./Spinner";

type FileUrl = { url: string; mime_type: string; kind: "doc" | "audio"; name: string | null };
type Page = { page: number | null; text: string };

/**
 * Shows a file in a dialog: PDFs in the browser's PDF viewer (opened at `page` when given),
 * PowerPoint as converted PDF slides, voice notes with a player and their transcript,
 * and other Office files as extracted text.
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
        // Only PDFs and plain text render directly; Office files and audio use extracted text.
        if (!["application/pdf", "text/plain"].includes(f.mime_type)) {
          api<{ pages: Page[] }>(`/api/v1/files/${fileId}/text`).then((r) => live && setPages(r.pages))
            .catch((e: Error) => live && setError(e.message));
        }
      })
      .catch((e: Error) => live && setError(e.message === "File not found" ? "This file was deleted." : e.message));
    return () => {
      live = false;
    };
  }, [fileId]);

  const pdf = file?.mime_type === "application/pdf";
  const office = file?.kind === "doc" && !["application/pdf", "text/plain"].includes(file.mime_type);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()} // click on the backdrop
      className="m-auto h-[85vh] w-[min(56rem,94vw)] rounded-[3px] border border-border bg-surface p-0 text-fg shadow-[var(--lift)] backdrop:bg-scrim"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="truncate text-sm font-bold">
            {file?.name ?? (file?.kind === "audio" ? "Voice note" : "Document")}
            {pdf && page ? <span className="hl hl-solid hl-n1 ml-2 px-1">page {page}</span> : null}
          </p>
          <div className="flex shrink-0 gap-2">
            {file && <a href={file.url} target="_blank" rel="noreferrer" className="btn">Open in new tab</a>}
            <button className="btn" onClick={() => dialog.current?.close()} autoFocus>Close</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {error && <p role="alert" className="p-4 text-sm text-danger">{error}</p>}
          {!file && !error && <div className="p-4"><Loading /></div>}
          {file && pdf && (
            // #page=N is understood by the PDF viewers in Chrome, Edge, Firefox and Safari.
            <iframe src={`${file.url}#page=${page ?? 1}`} title={file.name ?? "Document"} className="h-full w-full" />
          )}
          {file && file.mime_type === "text/plain" && <iframe src={file.url} title={file.name ?? "Text"} className="h-full w-full bg-white" />}
          {file && file.kind === "audio" && (
            <div className="space-y-4 p-4">
              <audio controls src={file.url} className="w-full" />
              <h3 className="text-sm font-semibold">Transcript</h3>
              {pages ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{pages.map((p) => p.text).join("\n")}</p> : <Loading text="Loading transcript…" />}
            </div>
          )}
          {file && office && (
            <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed">
              <p className="mb-3 text-xs text-muted">This preview shows the text extracted from your Office file.</p>
              {pages ? pages.map((p) => (
                <div key={p.page} className="mb-6">
                  {p.page !== null && <p className="label mb-2">Page / slide {p.page}</p>}
                  <p>{p.text}</p>
                </div>
              )) : <Loading text="Loading text…" />}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
