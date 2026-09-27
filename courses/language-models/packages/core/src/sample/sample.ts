/**
 * Decoding (Chapter 15): turning a model's next-token logits into a choice of token.
 *
 * The pipeline, in the order Hugging Face's generate() applies it:
 *   penalties on the logits → temperature → softmax → top-k → top-p → min-p → sample.
 * Each truncation zeroes some probabilities and renormalises the rest.
 */
import { sampleIndex } from '../lm.ts';
import type { Rng } from '../util/random.ts';

export function argmax(xs: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i]! > xs[best]!) best = i;
  return best;
}

/** softmax(logits / T). T = 0 is the limit: all the mass on the largest logit (greedy decoding). */
export function softmaxT(logits: ArrayLike<number>, temperature = 1): Float64Array {
  const p = new Float64Array(logits.length);
  if (temperature <= 0) {
    p[argmax(logits)] = 1;
    return p;
  }
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]!);
  let z = 0;
  for (let i = 0; i < logits.length; i++) z += p[i] = Math.exp((logits[i]! - max) / temperature);
  for (let i = 0; i < p.length; i++) p[i]! /= z;
  return p;
}

/** Entropy in bits. */
export function entropyBits(p: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) if (p[i]! > 0) h -= p[i]! * Math.log2(p[i]!);
  return h;
}

function renormalise(p: Float64Array): Float64Array {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += p[i]!;
  for (let i = 0; i < p.length; i++) p[i]! /= s;
  return p;
}

/** Indices sorted by decreasing probability (ties by index, so results are deterministic). */
export function order(p: ArrayLike<number>): number[] {
  return Array.from({ length: p.length }, (_, i) => i).sort((a, b) => p[b]! - p[a]! || a - b);
}

/** Keep the k most probable tokens (and any tied with the k-th), renormalised. */
export function topK(p: ArrayLike<number>, k: number): Float64Array {
  const out = Float64Array.from(p);
  if (k <= 0 || k >= p.length) return out;
  const threshold = p[order(p)[k - 1]!]!;
  for (let i = 0; i < out.length; i++) if (out[i]! < threshold) out[i] = 0;
  return renormalise(out);
}

/** Nucleus sampling: the smallest set of most probable tokens whose total probability reaches `top`. */
export function topP(p: ArrayLike<number>, top: number): Float64Array {
  const out = new Float64Array(p.length);
  if (top >= 1) return Float64Array.from(p);
  let mass = 0;
  for (const i of order(p)) {
    if (mass >= top) break;
    out[i] = p[i]!;
    mass += p[i]!;
  }
  return renormalise(out);
}

/** Min-p: keep tokens at least `ratio` times as probable as the most probable one. */
export function minP(p: ArrayLike<number>, ratio: number): Float64Array {
  const out = Float64Array.from(p);
  if (ratio <= 0) return out;
  let max = 0;
  for (let i = 0; i < p.length; i++) max = Math.max(max, p[i]!);
  for (let i = 0; i < out.length; i++) if (out[i]! < ratio * max) out[i] = 0;
  return renormalise(out);
}

/**
 * Repetition penalty of CTRL (Keskar et al., 2019): for every token already in `history`, divide
 * its logit by θ if positive and multiply it by θ if negative, so θ > 1 always makes it less likely.
 */
export function repetitionPenalty(logits: ArrayLike<number>, history: Iterable<number>, theta: number): Float64Array {
  const out = Float64Array.from(logits);
  if (theta === 1) return out;
  for (const t of new Set(history)) out[t] = out[t]! > 0 ? out[t]! / theta : out[t]! * theta;
  return out;
}

/** OpenAI's penalties: subtract `frequency` × (times the token appeared) and `presence` if it appeared at all. */
export function frequencyPresencePenalty(logits: ArrayLike<number>, history: Iterable<number>, frequency: number, presence: number): Float64Array {
  const out = Float64Array.from(logits);
  const counts = new Map<number, number>();
  for (const t of history) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, c] of counts) out[t] = out[t]! - frequency * c - (c > 0 ? presence : 0);
  return out;
}

export interface SamplerSettings {
  /** 0 = greedy. */
  temperature: number;
  /** 0 = off. */
  topK?: number;
  /** 1 = off. */
  topP?: number;
  /** 0 = off. */
  minP?: number;
  /** 1 = off. */
  repetitionPenalty?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export const DEFAULT_SAMPLER: Required<SamplerSettings> = { temperature: 1, topK: 0, topP: 1, minP: 0, repetitionPenalty: 1, frequencyPenalty: 0, presencePenalty: 0 };

/** The distribution a sampler actually draws from, after penalties, temperature and truncation. */
export function prepare(logits: ArrayLike<number>, history: number[], settings: SamplerSettings): Float64Array {
  const s = { ...DEFAULT_SAMPLER, ...settings };
  let z: ArrayLike<number> = logits;
  if (s.repetitionPenalty !== 1) z = repetitionPenalty(z, history, s.repetitionPenalty);
  if (s.frequencyPenalty || s.presencePenalty) z = frequencyPresencePenalty(z, history, s.frequencyPenalty, s.presencePenalty);
  let p = softmaxT(z, s.temperature);
  if (s.topK > 0) p = topK(p, s.topK);
  if (s.topP < 1) p = topP(p, s.topP);
  if (s.minP > 0) p = minP(p, s.minP);
  return p;
}

/** Draw the next token. */
export function sampleToken(logits: ArrayLike<number>, history: number[], settings: SamplerSettings, rng: Rng): number {
  return sampleIndex(prepare(logits, history, settings), rng());
}

export interface Beam {
  ids: number[];
  /** Sum of the log-probabilities of the generated tokens. */
  logp: number;
  done: boolean;
}

export interface BeamStep {
  /** Every candidate considered at this step, with the index of the beam it extends. */
  candidates: { parent: number; token: number; logp: number; kept: boolean }[];
  beams: Beam[];
  /** For each beam, the index of the beam it extends at the previous step, and the token added (−1: finished, unchanged). */
  parents: number[];
  tokens: number[];
}

/** Length-normalised score used to rank finished hypotheses: logp / length^α (α = 0: no normalisation). */
export const beamScore = (b: Beam, start: number, alpha: number) => b.logp / Math.max(1, b.ids.length - start) ** alpha;

/**
 * Beam search: keep the `width` most probable partial sequences; at each step, extend each by its
 * `width` most probable next tokens and keep the best `width` of all the extensions. A beam that
 * produces `eos` is finished and carried along unchanged. `logprobs` returns log P(· | ids).
 */
export async function beamSearch(
  logprobs: (ids: number[]) => Promise<ArrayLike<number>> | ArrayLike<number>,
  start: number[],
  opts: { width: number; steps: number; eos?: number; lengthPenalty?: number },
): Promise<{ best: Beam; beams: Beam[]; trace: BeamStep[] }> {
  const { width, steps, eos, lengthPenalty = 0 } = opts;
  let beams: Beam[] = [{ ids: [...start], logp: 0, done: false }];
  const trace: BeamStep[] = [];
  for (let t = 0; t < steps && beams.some((b) => !b.done); t++) {
    const candidates: BeamStep['candidates'] = [];
    const next: { beam: Beam; parent: number; token: number }[] = [];
    for (let b = 0; b < beams.length; b++) {
      const beam = beams[b]!;
      if (beam.done) {
        next.push({ beam, parent: b, token: -1 });
        continue;
      }
      const lp = await logprobs(beam.ids);
      for (const tok of order(lp).slice(0, width)) {
        const logp = beam.logp + lp[tok]!;
        candidates.push({ parent: b, token: tok, logp, kept: false });
        next.push({ beam: { ids: [...beam.ids, tok], logp, done: tok === eos }, parent: b, token: tok });
      }
    }
    next.sort((a, b) => b.beam.logp - a.beam.logp);
    const kept = next.slice(0, width);
    for (const k of kept) {
      const c = candidates.find((c) => c.parent === k.parent && c.token === k.token);
      if (c) c.kept = true;
    }
    beams = kept.map((k) => k.beam);
    trace.push({ candidates, beams, parents: kept.map((k) => k.parent), tokens: kept.map((k) => k.token) });
  }
  const best = beams.reduce((a, b) => (beamScore(b, start.length, lengthPenalty) > beamScore(a, start.length, lengthPenalty) ? b : a));
  return { best, beams, trace };
}

/**
 * Speculative sampling (Leviathan et al., 2023; Chen et al., 2023). A draft model proposed `drafts`,
 * drawing token i from q[i]; the target model's distributions at the same positions are p[i], plus
 * p[drafts.length] for the position after the last draft. Accept draft i with probability
 * min(1, p[i](x) / q[i](x)); at the first rejection, draw instead from the normalised excess
 * max(0, p[i] − q[i]) and stop; if every draft is accepted, draw one more token from the last p.
 * The tokens returned are distributed exactly as if sampled from the target alone.
 */
export function speculativeAccept(p: ArrayLike<number>[], q: ArrayLike<number>[], drafts: number[], rng: Rng): { tokens: number[]; accepted: number } {
  const tokens: number[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const x = drafts[i]!, pi = p[i]!, qi = q[i]!;
    if (rng() * qi[x]! < pi[x]!) {
      tokens.push(x);
      continue;
    }
    const excess = Float64Array.from(pi, (v, j) => Math.max(0, v - qi[j]!));
    tokens.push(sampleIndex(excess, rng()));
    return { tokens, accepted: i };
  }
  tokens.push(sampleIndex(p[drafts.length]!, rng()));
  return { tokens, accepted: drafts.length };
}
