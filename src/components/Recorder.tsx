"use client";

import { useEffect, useRef, useState } from "react";

// Formats the API accepts, in order of preference. Chrome and Firefox record webm; Safari records mp4.
const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/** Records a voice note in the browser and hands back the audio with the plain mime type the API expects. */
export function Recorder({ onDone }: { onDone: (audio: Blob, mime: string) => void }) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop the microphone if the component goes away mid-recording.
  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    setError(null);
    const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    if (!format) return setError("This browser can't record audio in a supported format.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("Microphone access was denied.");
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: format });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopTracks();
      const mime = format.split(";")[0]; // "audio/webm;codecs=opus" -> "audio/webm"
      onDone(new Blob(chunks, { type: mime }), mime);
      setState("idle");
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setState("recording");
  }

  return (
    <div className="flex items-center gap-3">
      {state === "idle" ? (
        <button onClick={() => void start()} className="btn">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden /> Record voice note
        </button>
      ) : (
        <button onClick={() => recorder.current?.stop()} className="btn border-danger text-danger">
          <span className="h-2.5 w-2.5 animate-pulse rounded-sm bg-danger" aria-hidden /> Stop ·{" "}
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </button>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
