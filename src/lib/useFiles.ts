"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { FileItem } from "./types";

/** The user's files, reloaded whenever refreshKey changes (e.g. when a tab is opened). */
export function useFiles(refreshKey: number): FileItem[] {
  const [files, setFiles] = useState<FileItem[]>([]);
  useEffect(() => {
    let live = true;
    api<{ files: FileItem[] }>("/api/v1/files").then((r) => live && setFiles(r.files)).catch(() => {});
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return files;
}

const TYPE: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
};

/** The file's name; files uploaded before names were saved show their type and upload date instead. */
export const docName = (f: FileItem) =>
  f.name ?? `${f.kind === "audio" ? "Voice note" : (TYPE[f.mime_type] ?? "Document")} · ${new Date(f.created_at).toLocaleDateString()}`;
