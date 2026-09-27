/**
 * The interface every language model in the course implements — from n-gram tables (Chapter 2)
 * to CourseGPT (Chapter 14). Evaluation and sampling code is written once against it.
 */
import type { Rng } from './util/random.ts';

export interface LanguageModel {
  readonly vocabSize: number;
  /** How many previous tokens the model can use (n − 1 for an n-gram model). */
  readonly contextLength: number;
  /** P(· | context) over the whole vocabulary. `context` is oldest-first; only the tail is used. */
  distribution(context: ArrayLike<number>): Float64Array;
  /** P(next | context). */
  prob(context: ArrayLike<number>, next: number): number;
}

export interface CrossEntropyResult {
  /** Average −log_b P(x_t | context), in units of `base` (bits by default). Infinity if any P was 0. */
  crossEntropy: number;
  /** base ** crossEntropy — the effective branching factor. */
  perplexity: number;
  /** Number of predicted positions. */
  count: number;
  /** Positions that received probability 0. */
  zeros: number;
}

/**
 * Cross-entropy of a model on a token sequence: the average surprisal of each token given the
 * tokens before it (up to the model's context length). Positions before `start` are context only.
 */
export function crossEntropy(model: LanguageModel, ids: ArrayLike<number>, opts: { start?: number; end?: number; base?: number } = {}): CrossEntropyResult {
  const { start = 1, end = ids.length, base = 2 } = opts;
  const L = Number.isFinite(model.contextLength) ? model.contextLength : Infinity;
  let nats = 0;
  let zeros = 0;
  let count = 0;
  const arr = Array.isArray(ids) ? (ids as number[]) : Array.from(ids);
  for (let t = Math.max(start, 0); t < end; t++) {
    const ctx = arr.slice(Math.max(0, t - L), t);
    const p = model.prob(ctx, arr[t]!);
    if (p <= 0) zeros++;
    else nats -= Math.log(p);
    count++;
  }
  const ce = zeros > 0 ? Infinity : nats / Math.max(count, 1) / Math.log(base);
  return { crossEntropy: ce, perplexity: base ** ce, count, zeros };
}

/** Inverse-CDF sampling: the smallest index whose cumulative probability exceeds u ∈ [0, 1). */
export function sampleIndex(probs: ArrayLike<number>, u: number): number {
  let total = 0;
  for (let i = 0; i < probs.length; i++) total += probs[i]!;
  let acc = 0;
  const target = u * total; // tolerate slightly unnormalised input
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]!;
    if (target < acc) return i;
  }
  // Floating-point round-off: fall back to the last index with non-zero mass.
  for (let i = probs.length - 1; i >= 0; i--) if (probs[i]! > 0) return i;
  return probs.length - 1;
}

/** Autoregressive generation: repeatedly sample the next token and append it. */
export function generate(model: LanguageModel, prompt: ArrayLike<number>, steps: number, rng: Rng): number[] {
  const out = Array.from(prompt);
  for (let i = 0; i < steps; i++) {
    const L = Number.isFinite(model.contextLength) ? model.contextLength : out.length;
    const dist = model.distribution(out.slice(Math.max(0, out.length - L)));
    out.push(sampleIndex(dist, rng()));
  }
  return out;
}
