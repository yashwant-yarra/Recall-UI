"use client";

/**
 * Audio plumbing for live voice: microphone -> 16 kHz 16-bit PCM chunks, and 24 kHz 16-bit PCM
 * chunks -> speakers, queued gap-free and dropped instantly when the student interrupts.
 */

const TARGET_RATE = 16000; // what Gemini Live expects from the microphone
const CHUNK_SAMPLES = 1600; // send ~100 ms at a time

// Runs on the audio thread: hands each block of microphone samples to the page.
const WORKLET = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("mic-capture", MicCapture);
`;

/**
 * Browsers record at their own rate (often 48 kHz) and not all can be asked for 16 kHz, so convert:
 * average the input samples that fall into each output sample.
 */
export function downsample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** Starts the microphone; calls onChunk with ~100 ms of 16 kHz PCM. Returns a function that stops it. */
export async function startMic(onChunk: (pcm: ArrayBuffer) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Echo cancellation keeps the tutor's own voice from the speakers out of the microphone.
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "mic-capture");
  let pending: number[] = [];
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const samples = downsample(e.data, ctx.sampleRate);
    for (let i = 0; i < samples.length; i++) pending.push(samples[i]);
    if (pending.length >= CHUNK_SAMPLES) {
      onChunk(floatTo16BitPCM(Float32Array.from(pending)));
      pending = [];
    }
  };
  source.connect(node);
  return () => {
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    stream.getTracks().forEach((t) => t.stop()); // turns the mic indicator off
    void ctx.close();
  };
}

/** Plays 16-bit PCM chunks back to back. stop() drops everything queued (for interruptions). */
export class PcmPlayer {
  private ctx = new AudioContext();
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private rate = 24000) {}

  play(chunk: ArrayBuffer) {
    const pcm = new Int16Array(chunk);
    if (!pcm.length) return;
    const buffer = this.ctx.createBuffer(1, pcm.length, this.rate); // the browser resamples on playback
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    // Schedule right after what's already queued, so chunks join without gaps.
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.02);
    src.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** True while queued audio is still playing. */
  get speaking(): boolean {
    return this.sources.size > 0;
  }

  stop() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already ended
      }
    });
    this.sources.clear();
    this.nextTime = 0;
  }

  close() {
    this.stop();
    void this.ctx.close();
  }
}
