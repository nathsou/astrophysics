/**
 * Recognising a Mandarin tone from a pitch track, and drawing it on Chao's five-level scale.
 *
 * Real syllables are messier than textbook contours: a second tone dips before it rises, a
 * third tone often goes creaky (pitch trackers halve it), and a fourth can rise briefly before
 * it falls. So rather than hand-written rules, the classifier compares the learner's contour
 * with 300 recorded examples (75 syllables in four voices, fixtures/tts-tones.json) and lets the
 * nine nearest vote. The shape is compared in semitones around the syllable's own average; once
 * the course knows the speaker's typical pitch it also compares the level, which is what tells
 * a low, level third tone from a first tone. Idealised textbook contours are added as templates
 * so that clean, exaggerated learner tones are recognised too. On held-out voices, with the
 * speaker's level known, it is right about 87% of the time and 93% when the vote is clear (85% of
 * syllables); unclear votes are reported as unsure. tones.test.ts measures this.
 */
import type { Tone } from '$lib/zh/pinyin';
import FIXTURE from './fixtures/tts-tones.json' with { type: 'json' };

type Tone4 = Exclude<Tone, 5>;

/** Chao tone letters: the target contour of each tone on a 1 (low) to 5 (high) scale. */
export const CHAO: Record<Tone4, number[]> = {
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

const REASONS: Record<Tone4, string> = {
  1: 'Your pitch stayed high and level: a first tone.',
  2: 'Your pitch rose: a second tone.',
  3: 'Your pitch dipped low: a third tone.',
  4: 'Your pitch fell: a fourth tone.',
};

export interface Analysis {
  tone: Tone4 | null;
  /** Share of the neighbours' vote won by `tone` (0–1). Below 0.7 the verdict is unsure. */
  confidence: number;
  /** The voiced part of the contour, smoothed, on the Chao scale, 24 points (for drawing). */
  chao: number[];
  /** Duration of the voiced part in seconds. */
  seconds: number;
  /** Why the classifier decided, in words a learner can use. */
  reason: string;
}

export interface Voice {
  /** The speaker's typical pitch (Hz); the middle of their range. */
  mid: number;
}

export const CONFIDENT = 0.7;
const N = 12;
const K = 9;
const LEVEL_WEIGHT = 2;

export const semitones = (hz: number, ref: number) => 12 * Math.log2(hz / ref);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
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

/** The voiced stretch, gaps filled by interpolation, octave slips folded back. Null if too short. */
export function voicedContour(track: (number | null)[]): { hz: number[]; frames: number } | null {
  const idx = track.flatMap((f, i) => (f ? [i] : []));
  if (idx.length < 6) return null;
  const hz: number[] = [];
  for (let i = idx[0]!; i <= idx[idx.length - 1]!; i++) {
    const f = track[i];
    if (f) {
      hz.push(f);
      continue;
    }
    const p = idx.filter((k) => k < i).pop()!;
    const n = idx.find((k) => k > i)!;
    hz.push(track[p]! + ((track[n]! - track[p]!) * (i - p)) / (n - p));
  }
  const m = median(hz);
  // Pitch trackers jump an octave up on some frames; creaky voice reads as an octave down,
  // and is genuinely low, so it is held at the bottom rather than folded up.
  return { hz: hz.map((f) => (f > m * 1.7 ? f / 2 : f < m / 1.7 ? m / 1.7 : f)), frames: idx.length };
}

/** Feature vector: 12-point shape (semitones around its mean) and level relative to the speaker. */
export function features(track: (number | null)[], mid?: number): number[] | null {
  const v = voicedContour(track);
  if (!v) return null;
  const m = median(v.hz);
  const st = v.hz.map((f) => semitones(f, m));
  const core = st.slice(Math.floor(st.length * 0.1));
  const smooth = core.map((_, i) => median(core.slice(Math.max(0, i - 2), i + 3)));
  const shape = resample(smooth, N);
  const mean = shape.reduce((a, b) => a + b, 0) / N;
  const level = mid ? semitones(m, mid) + mean : 0;
  return [...shape.map((x) => x - mean), level * LEVEL_WEIGHT];
}

export interface Template {
  tone: Tone4;
  voice: string;
  x: number[];
}

type FixtureRow = { voice: string; ch: string; tone: number; hz: number[] };

/** Templates from the recorded fixture, each voice levelled against its own median pitch. */
export function buildTemplates(rows: FixtureRow[] = FIXTURE as FixtureRow[]): Template[] {
  const mids = new Map<string, number>();
  for (const v of new Set(rows.map((r) => r.voice))) mids.set(v, median(rows.filter((r) => r.voice === v).flatMap((r) => r.hz.filter((x) => x > 0))));
  return rows.flatMap((r) => {
    const x = features(
      r.hz.map((h) => h || null),
      mids.get(r.voice),
    );
    return x ? [{ tone: r.tone as Tone4, voice: r.voice, x }] : [];
  });
}

/**
 * Textbook contours at several sizes, so clean, exaggerated learner tones (a straight rise, a
 * deep dip) are recognised as well as natural speech. Level is in semitones from the speaker's
 * middle, as for recorded templates.
 */
export function idealTemplates(): Template[] {
  const out: Template[] = [];
  const add = (tone: Tone4, semis: (t: number) => number, level: number) => {
    const frames = Array.from({ length: 40 }, (_, i) => 200 * 2 ** (semis(i / 39) / 12));
    const x = features(frames, 200 * 2 ** (-level / 12));
    if (x) out.push({ tone, voice: 'ideal', x });
  };
  for (const k of [0.7, 1, 1.4, 1.8]) {
    add(1, () => 0, 5 * k);
    add(2, (t) => -3 * k + 6 * k * t, 0.5 * k);
    add(2, (t) => (t < 0.3 ? -2 * k - t * k : -2.3 * k + ((t - 0.3) / 0.7) * 6 * k), 0);
    add(3, (t) => (t < 0.55 ? -2 * k * (t / 0.55) : -2 * k + ((t - 0.55) / 0.45) * 4 * k), -4 * k);
    add(3, (t) => -1.5 * k * t, -6 * k);
    add(3, (t) => (t < 0.5 ? -2.5 * k * (t / 0.5) : -2.5 * k + ((t - 0.5) / 0.5) * 7.5 * k), -2 * k);
    add(4, (t) => 4 * k - 9 * k * t, 1.5 * k);
  }
  return out;
}

let TEMPLATES: Template[] | null = null;

/** k-nearest-neighbour vote. Without a speaker level, the level dimension is ignored. */
export function vote(x: number[], templates: Template[], useLevel: boolean): { tone: Tone4; confidence: number } {
  const dims = useLevel ? x.length : x.length - 1;
  const near = templates
    .map((t) => {
      let d = 0;
      for (let i = 0; i < dims; i++) d += (t.x[i]! - x[i]!) ** 2;
      return { tone: t.tone, d };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, K);
  const votes = new Map<Tone4, number>();
  for (const n of near) votes.set(n.tone, (votes.get(n.tone) ?? 0) + 1 / (1 + n.d));
  const ranked = [...votes].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, w]) => s + w, 0);
  return { tone: ranked[0]![0], confidence: ranked[0]![1] / total };
}

/**
 * Classify one syllable. `hopSeconds` is the time between pitch frames. Returns tone null when
 * there is too little voiced sound to judge.
 */
export function analyse(track: (number | null)[], hopSeconds: number, voice?: Voice): Analysis {
  const v = voicedContour(track);
  if (!v || v.frames < 8) return { tone: null, confidence: 0, chao: [], seconds: 0, reason: 'I could not hear a clear voiced syllable. Try again, a little louder and longer.' };
  const x = features(track, voice?.mid)!;
  TEMPLATES ??= [...buildTemplates(), ...idealTemplates()];
  const { tone, confidence } = vote(x, TEMPLATES, !!voice);

  // For drawing: about 2.5 semitones per Chao level, centred on the speaker (or the syllable).
  const ref = voice?.mid ?? median(v.hz);
  const st = resample(v.hz.map((f) => semitones(f, ref)), 24);
  const smooth = st.map((_, i) => median(st.slice(Math.max(0, i - 2), i + 3)));
  const chao = smooth.map((s) => Math.max(0.6, Math.min(5.4, 3 + s / 2.5)));
  const reason = confidence >= CONFIDENT ? REASONS[tone] : 'I am not sure which tone that was. Compare your line with the target shape.';
  return { tone, confidence, chao, seconds: v.frames * hopSeconds, reason };
}

/** The target contour of a tone, as `n` points on the Chao scale (for drawing). */
export function targetContour(tone: Tone4, n = 24): number[] {
  return resample(CHAO[tone], n);
}
