"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAudio, streamAudio } from "@/lib/api";
import { Spinner } from "./Spinner";

// Stream the first piece and generate later pieces ahead of playback.
// Keeping adjacent sentences together avoids pauses between separately generated clips.
const FIRST_PIECE = 300;
const MAX_PIECE = 300; // the API accepts up to 600
const AHEAD = 3; // pieces generated in parallel
const CACHE_SIZE = 80; // clips kept in memory for replays

/** Plain speakable text: no [1] citation markers, no markdown symbols. */
export function speakable(text: string): string {
  return text
    .replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "") // with the space before it: "food [1]." -> "food."
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Where to cut a too-long sentence: after the last comma within the limit, else the last space. */
function cutAt(s: string, limit: number): number {
  const comma = s.lastIndexOf(", ", limit);
  if (comma > limit / 3) return comma + 1;
  const space = s.lastIndexOf(" ", limit);
  return space > limit / 2 ? space : limit;
}

/**
 * Splits text into pieces at sentence ends (incl. the Hindi danda "।"): the first up to `first`
 * characters, the rest up to `max`. A sentence longer than the limit is cut at a comma or space.
 */
export function speechPieces(text: string, first = FIRST_PIECE, max = MAX_PIECE): string[] {
  const sentences = speakable(text).match(/[^.!?।]+[.!?।]*\s*/g) ?? [];
  const pieces: string[] = [];
  const limit = () => (pieces.length === 0 ? first : max);
  let current = "";
  for (const s of sentences) {
    if (current && (current + s).length > limit()) {
      pieces.push(current.trim());
      current = "";
    }
    let rest = s;
    while (rest.length > limit()) {
      const cut = cutAt(rest, limit());
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    current += rest;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

// Generated clips, by their text, for this page's lifetime. Replaying an answer, or pressing Stop and
// Listen again, reuses them instead of generating (and paying for) the same speech twice.
const clipCache = new Map<string, Promise<Blob>>();

function clip(text: string): Promise<Blob> {
  const cached = clipCache.get(text);
  if (cached) {
    clipCache.delete(text); // move to the end: most recently used
    clipCache.set(text, cached);
    return cached;
  }
  const request = fetchAudio("/api/v1/speech/tts", { text });
  clipCache.set(text, request);
  request.catch(() => clipCache.delete(text)); // a failed clip can be retried next time
  while (clipCache.size > CACHE_SIZE) clipCache.delete(clipCache.keys().next().value!);
  return request;
}

// Only one answer plays at a time: starting a new one stops the current one.
let stopCurrent: (() => void) | null = null;

/** Reads an answer aloud, piece by piece, generating the next few pieces while the current one plays. */
export function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  async function play() {
    stopCurrent?.();
    setError(null);
    const pieces = speechPieces(text);
    if (!pieces.length) return;
    let stopped = false;
    let audio: HTMLAudioElement | null = null;
    let finish: (() => void) | null = null;
    const abort = new AbortController();
    const context = !clipCache.has(pieces[0]) && typeof AudioContext !== "undefined" ? new AudioContext() : null;
    if (context) void context.resume();
    const halt = () => {
      stopped = true;
      abort.abort();
      if (context && context.state !== "closed") void context.close();
      audio?.pause();
      finish?.();
      setState("idle");
    };
    stop.current = halt;
    stopCurrent = halt;
    setState("loading");
    const prefetch = (i: number) => {
      for (let j = i; j < Math.min(i + AHEAD, pieces.length); j++) clip(pieces[j]).catch(() => {});
    };
    try {
      for (let i = 0; i < pieces.length; i++) {
        if (i === 0 && context) {
          const first = streamAudio(pieces[i], abort.signal);
          prefetch(1);
          const reader = (await first).getReader();
          const pcm: Uint8Array[] = [];
          let carry: number | null = null;
          let next = context.currentTime + 0.2;
          let last: AudioBufferSourceNode | null = null;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const bytes: Uint8Array = new Uint8Array(value.length + (carry === null ? 0 : 1));
            if (carry !== null) bytes[0] = carry;
            bytes.set(value, carry === null ? 0 : 1);
            carry = bytes.length % 2 ? bytes[bytes.length - 1] : null;
            const even = bytes.subarray(0, bytes.length - (carry === null ? 0 : 1));
            if (!even.length) continue;
            pcm.push(even);
            const buffer = context.createBuffer(1, even.length / 2, 24000);
            const samples = buffer.getChannelData(0);
            const view = new DataView(even.buffer, even.byteOffset, even.byteLength);
            for (let n = 0; n < samples.length; n++) samples[n] = view.getInt16(n * 2, true) / 32768;
            last = context.createBufferSource();
            last.buffer = buffer;
            last.connect(context.destination);
            next = Math.max(next, context.currentTime + 0.005);
            last.start(next);
            next += buffer.duration;
            setState("playing");
          }
          if (carry !== null || !last) throw new Error("Incomplete audio stream");
          const length = pcm.reduce((sum, bytes) => sum + bytes.length, 0);
          const header = new ArrayBuffer(44);
          const view = new DataView(header);
          for (const [offset, value] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]] as const)
            for (let n = 0; n < value.length; n++) view.setUint8(offset + n, value.charCodeAt(n));
          view.setUint32(4, 36 + length, true); view.setUint32(16, 16, true);
          view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24000, true);
          view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
          view.setUint32(40, length, true);
          clipCache.set(pieces[i], Promise.resolve(new Blob([header, ...pcm as BlobPart[]], { type: "audio/wav" })));
          while (clipCache.size > CACHE_SIZE) clipCache.delete(clipCache.keys().next().value!);
          if (context.currentTime < next)
            await new Promise<void>((resolve) => { finish = resolve; last!.onended = () => resolve(); });
          if (stopped) return;
          continue;
        }
        prefetch(i);
        const blob = await clip(pieces[i]);
        if (stopped) return;
        prefetch(i + 1); // keep the window full while this piece plays
        const url = URL.createObjectURL(blob);
        audio = new Audio(url);
        setState("playing");
        await new Promise<void>((resolve) => {
          finish = resolve;
          audio!.onended = () => resolve();
          audio!.onerror = () => resolve();
          void audio!.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        if (stopped) return;
      }
    } catch (e) {
      if (!stopped) setError((e as Error).message);
    } finally {
      if (context && context.state !== "closed") void context.close();
      if (stopCurrent === halt) stopCurrent = null;
      if (!stopped) setState("idle");
    }
  }

  // From the first click the same button stops it, also while the first piece is still being prepared.
  const label = state === "idle" ? "Listen" : state === "loading" ? "Stop (preparing audio)" : "Stop";
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => (state === "idle" ? void play() : stop.current?.())}
        aria-label={label}
        title={label}
        aria-pressed={state !== "idle"}
        className={`pill p-1.5 transition ${
          state === "idle" ? "bg-bg text-muted hover:text-accent" : "bg-danger/10 text-danger ring-1 ring-danger/40"
        }`}
      >
        {state === "idle" ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        ) : (
          // A solid square: the usual "stop" symbol, with a spinner while the first piece is being prepared.
          <>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
            </svg>
            {state === "loading" && <Spinner className="h-3.5 w-3.5" />}
          </>
        )}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
