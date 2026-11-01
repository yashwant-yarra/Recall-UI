"use client";

import { useEffect, useState } from "react";

const WORD = /^\s*\S+\s*/; // the next word plus the spaces around it
const TICK_MS = 30;

/**
 * Reveals `target` one word at a time, so streamed text flows instead of jumping.
 * The model sends bursts of several words; this paces them evenly on screen. If the text falls far
 * behind the stream, it reveals bigger steps to catch up, so the display never lags much.
 * With live=false (history), the whole text shows at once.
 */
export function useReveal(target: string, live: boolean): string {
  const [shown, setShown] = useState(live ? 0 : target.length);
  const visible = Math.min(shown, target.length); // the target can shrink (a dropped draft)

  useEffect(() => {
    if (visible >= target.length) return;
    const id = setTimeout(() => {
      const rest = target.slice(visible);
      const word = rest.match(WORD)?.[0].length ?? rest.length;
      const behind = target.length - visible;
      setShown(visible + (behind > 300 ? Math.max(word, Math.ceil(behind / 15)) : word));
    }, TICK_MS);
    return () => clearTimeout(id);
  }, [visible, target]);

  return target.slice(0, visible);
}
