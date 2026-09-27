/**
 * Chapter 15's measurements, written by `uv run lmc ch15 summary`: CourseGPT's next-token distributions
 * for a few prompts (the 200 largest logits, and the rest as a histogram), and the quality–diversity
 * trade-off of many decoding settings.
 */
import raw from './data.json';

export interface StoredDistribution {
  key: string;
  prompt: string;
  tokens: string[];
  logits: number[];
  /** The other logits, as counts in bins of `width` starting at `lo`. */
  tail: { lo: number; width: number; counts: number[] };
}

export interface TradeoffResult {
  label: string;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  repetition_penalty?: number;
  /** Mean log-probability per generated token under the model at T = 1 (nats). */
  logp: number;
  /** Share of each continuation's 4-grams that already occurred earlier in it. */
  repetition: number;
  /** Distinct 4-grams over all continuations. */
  distinct4: number;
}

export interface ChapterData {
  distributions?: StoredDistribution[];
  tradeoff?: { n: number; steps: number; prompt_len: number; results: TradeoffResult[]; examples: Record<string, string> };
}

export const DATA = raw as unknown as ChapterData;

/**
 * A full-vocabulary logit vector from a stored distribution: the explicit top logits, then each tail
 * bin's count of tokens at the bin's centre. Labels for the tail tokens are empty.
 */
export function expand(d: StoredDistribution): { logits: Float64Array; labels: string[] } {
  const n = d.logits.length + d.tail.counts.reduce((a, b) => a + b, 0);
  const logits = new Float64Array(n);
  const labels: string[] = new Array<string>(n).fill('');
  d.logits.forEach((z, i) => {
    logits[i] = z;
    labels[i] = d.tokens[i]!;
  });
  let k = d.logits.length;
  d.tail.counts.forEach((c, b) => {
    const z = d.tail.lo + (b + 0.5) * d.tail.width;
    for (let j = 0; j < c; j++) logits[k++] = z;
  });
  return { logits, labels };
}

/** How a token looks in a chart: visible spaces and newlines. */
export const show = (t: string) => (t === '<|endoftext|>' ? '⟨end⟩' : t.replaceAll(' ', '·').replaceAll('\n', '↵'));
