/**
 * Recognising a Mandarin tone from a pitch track, and drawing it on Chao's five-level scale.
 *
 * Tones are shapes, not absolute pitches, so the classifier looks at the contour in semitones:
 * how much it rises and falls, and where its lowest point is. Level only matters to tell a
 * high flat first tone from a low flat third tone, and that uses the speaker's own voice range,
 * learned from their recordings.
 */
import type { Tone } from '$lib/zh/pinyin';

/** Chao tone letters: the target contour of each tone on a 1 (low) to 5 (high) scale. */
export const CHAO: Record<Exclude<Tone, 5>, number[]> = {
  1: [5, 5],
  2: [3, 5],
  3: [2, 1, 4],
  4: [5, 1],
};

export const TONE_NAMES: Record<Tone, string> = {
  1: 'first tone (high and level)',
  2: 'second tone (rising)',
  3: 'third tone (low, dipping)',
  4: 'fourth tone (falling)',
  5: 'neutral tone',
};

export interface Analysis {
  tone: Exclude<Tone, 5> | null;
  /** The voiced part of the contour, smoothed, on the Chao scale, 24 points. */
  chao: number[];
  /** Duration of the voiced part in seconds. */
  seconds: number;
  /** Why the classifier decided, in words a learner can use. */
  reason: string;
  features: { rise: number; fall: number; net: number; span: number; minPos: number; level: number };
}

export const semitones = (hz: number, ref: number) => 12 * Math.log2(hz / ref);

/** The longest voiced stretch, bridging gaps of up to `gap` frames. */
export function voicedSegment(track: (number | null)[], gap = 4): number[] {
  let best: number[] = [];
  let cur: number[] = [];
  let silent = 0;
  for (const f of track) {
    if (f) {
      cur.push(f);
      silent = 0;
    } else if (cur.length && ++silent > gap) {
      if (cur.length > best.length) best = cur;
      cur = [];
      silent = 0;
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function medianFilter(xs: number[], k = 5): number[] {
  const h = Math.floor(k / 2);
  return xs.map((_, i) => median(xs.slice(Math.max(0, i - h), i + h + 1)));
}

function resample(xs: number[], n: number): number[] {
  if (xs.length === 1) return Array(n).fill(xs[0]);
  return Array.from({ length: n }, (_, i) => {
    const x = (i * (xs.length - 1)) / (n - 1);
    const a = Math.floor(x);
    const b = Math.min(xs.length - 1, a + 1);
    return xs[a]! + (xs[b]! - xs[a]!) * (x - a);
  });
}

/** Remove octave jumps (a common pitch-tracker error) by folding outliers back toward the median. */
function fixOctaves(hz: number[]): number[] {
  const m = median(hz);
  return hz.map((f) => {
    let x = f;
    while (x > m * 1.7) x /= 2;
    while (x < m / 1.7) x *= 2;
    return x;
  });
}

export interface Voice {
  /** The speaker's typical pitch (Hz); the middle of their range. */
  mid: number;
}

/**
 * Classify one syllable. `hopSeconds` is the time between pitch frames. Returns tone null when
 * there is too little voiced sound to judge.
 */
export function analyse(track: (number | null)[], hopSeconds: number, voice?: Voice): Analysis {
  const seg = voicedSegment(track);
  const empty: Analysis = { tone: null, chao: [], seconds: 0, reason: '', features: { rise: 0, fall: 0, net: 0, span: 0, minPos: 0, level: 0 } };
  if (seg.length < 8) return { ...empty, reason: 'I could not hear a clear voiced syllable. Try again, a little louder and longer.' };

  // Trim the unstable onset and release (consonant transitions, creak).
  const trim = Math.floor(seg.length * 0.1);
  const core = fixOctaves(seg.slice(trim, seg.length - trim || undefined));
  const mid = voice?.mid ?? median(core);
  const st = resample(medianFilter(core.map((f) => semitones(f, mid))), 24);

  const start = (st[0]! + st[1]!) / 2;
  const end = (st[22]! + st[23]!) / 2;
  let minI = 0;
  st.forEach((v, i) => {
    if (v < st[minI]!) minI = i;
  });
  const min = st[minI]!;
  const max = Math.max(...st);
  const features = {
    rise: end - min,
    fall: start - min,
    net: end - start,
    span: max - min,
    minPos: minI / 23,
    level: st.reduce((a, b) => a + b, 0) / st.length,
  };
  const { rise, fall, net, span, minPos, level } = features;

  let tone: Exclude<Tone, 5>;
  let reason: string;
  if (span < 1.8) {
    if (voice && level < -2.5) {
      tone = 3;
      reason = 'Level and low in your voice: that is a (half) third tone.';
    } else {
      tone = 1;
      reason = 'Your pitch stayed level, which is the first tone.';
    }
  } else if (fall >= 1.2 && rise >= 1.2 && minPos > 0.25 && minPos < 0.85) {
    tone = 3;
    reason = 'Your pitch dipped and came back up, which is the third tone.';
  } else if (net <= -1.8 || (fall > rise && minPos >= 0.6)) {
    tone = 4;
    reason = 'Your pitch fell, which is the fourth tone.';
  } else if (net >= 1.8 || (rise > fall && minPos <= 0.4)) {
    tone = minPos > 0.3 && fall > 1.5 ? 3 : 2;
    reason = tone === 2 ? 'Your pitch rose, which is the second tone.' : 'Your pitch dipped before rising, which is the third tone.';
  } else {
    tone = 1;
    reason = 'Your pitch hardly moved, which sounds like the first tone.';
  }

  // Chao scale: about 2.5 semitones per level around the speaker's middle (level 3).
  const centre = voice ? 0 : level;
  const chao = st.map((v) => Math.max(0.6, Math.min(5.4, 3 + (v - centre) / 2.5)));
  return { tone, chao, seconds: seg.length * hopSeconds, reason, features };
}

/** The target contour of a tone, as `n` points on the Chao scale (for drawing). */
export function targetContour(tone: Exclude<Tone, 5>, n = 24): number[] {
  return resample(CHAO[tone], n);
}
