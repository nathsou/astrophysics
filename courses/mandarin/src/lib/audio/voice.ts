/** The learner's typical speaking pitch, learned from their recordings (kept in this browser). */
import type { Voice } from './tones';

const KEY = 'mandarin:voice';

export function loadVoice(): Voice | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { mid: number; n: number } | null;
    return v && v.n >= 3 ? { mid: v.mid } : undefined;
  } catch {
    return undefined;
  }
}

/** Fold one recording's median pitch into the running estimate (geometric mean). */
export function learnVoice(medianHz: number): void {
  try {
    const v = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as { mid: number; n: number } | null) ?? { mid: medianHz, n: 0 };
    const n = Math.min(v.n + 1, 30);
    const mid = Math.exp((Math.log(v.mid) * (n - 1) + Math.log(medianHz)) / n);
    localStorage.setItem(KEY, JSON.stringify({ mid, n }));
  } catch {
    /* storage unavailable */
  }
}
