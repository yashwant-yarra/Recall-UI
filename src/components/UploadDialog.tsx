"use client";

import { useEffect, useRef, useState } from "react";
import { ACCEPT, mimeFor } from "@/lib/api";

export function UploadDialog({ onUpload, onClose }: { onUpload: (file: File, mime: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function pick(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 1) return setError("Choose one file at a time.");
    const file = files[0];
    const mime = mimeFor(file);
    if (!mime) return setError("Supported: PDF, DOC, DOCX, PPT, PPTX, TXT, and audio (webm, mp3, m4a, wav).");
    if (!file.size) return setError("This file is empty. Choose a file with content.");
    onUpload(file, mime);
    dialog.current?.close();
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="upload-title" aria-describedby="upload-help"
            className="m-auto w-[min(36rem,94vw)] rounded-[3px] border border-border bg-surface p-0 text-fg shadow-[var(--lift)] backdrop:bg-scrim"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="upload-title" className="text-lg font-bold">Upload file</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close upload dialog"
                className="p-2 text-muted hover:text-fg">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      <div className="p-5 sm:p-6">
        <div className={`flex min-h-64 flex-col items-center justify-center rounded-[3px] border-2 border-dashed px-4 py-8 text-center ${
          dragging ? "border-accent bg-accent/5" : "border-border"}`}>
          <svg viewBox="0 0 48 48" className="mb-4 h-12 w-12 text-muted" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M28 6H12v36h24V14L28 6Z M28 6v8h8 M24 34V20m-6 6 6-6 6 6" />
          </svg>
          <p className="text-base font-semibold">{dragging ? "Drop your file here" : "Drag a file here"}</p>
          <p className="mt-1 mb-4 text-sm text-muted">or choose a file from your device</p>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" aria-label="Choose file"
                 onChange={(e) => { pick(e.currentTarget.files); e.currentTarget.value = ""; }} />
          <button type="button" className="btn-primary" autoFocus onClick={() => input.current?.click()}>Browse files</button>
          <p id="upload-help" className="mt-5 text-xs leading-5 text-muted">PDF, DOC, DOCX, PPT, PPTX, TXT, WEBM, MP3, M4A or WAV. One file at a time.</p>
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </div>
    </dialog>
  );
}
