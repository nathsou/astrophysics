/**
 * Chapter 17's measurements, written by `uv run lmc ch17 summary`: a sweep of 16 small GPTs on
 * TinyStories at three compute budgets, and the scaling laws fitted to it.
 */
import raw from './data.json';

export interface Law {
  E: number;
  A: number;
  B: number;
  alpha: number;
  beta: number;
}

export interface SweepRun {
  name: string;
  layers: number;
  width: number;
  budget: number;
  /** Sequences of 512 tokens per optimiser step. */
  batch: number;
  steps: number;
  tokens: number;
  flops_per_token: number;
  non_embedding: number;
  total: number;
  /** Validation loss at the end of the run, bits per token. */
  val_bits: number;
  seconds: number;
  /** [training FLOPs so far, training bits per token] every 100 steps. */
  curve: [number, number][];
}

export interface Fit {
  minima: { budget: number; parabola: [number, number, number]; n_opt: number; d_opt: number; loss: number }[];
  n_opt_exponent: number | null;
  law: Law;
  G: number;
  coursegpt: { params: number; tokens: number; predicted: number; measured: number | null };
}

export interface ChapterData {
  runs: SweepRun[];
  fit?: Fit;
  /** The first sweep, with too small a batch (8,192 tokens per step), kept for comparison. */
  first_sweep?: { batch: number; runs: Pick<SweepRun, 'layers' | 'width' | 'budget' | 'total' | 'tokens' | 'val_bits'>[]; fit?: Fit };
}

export const DATA = raw as unknown as ChapterData;

/** Published fits, for comparison (nats per token on each paper's own data and tokeniser). */
export const PUBLISHED: Record<string, { label: string; law: Law; unit: string }> = {
  chinchilla: { label: 'Chinchilla (Hoffmann et al., 2022)', law: { E: 1.69, A: 406.4, B: 410.7, alpha: 0.34, beta: 0.28 }, unit: 'nats / token' },
  epoch: { label: 'Replication (Besiroglu et al., 2024)', law: { E: 1.82, A: 482.01, B: 2085.43, alpha: 0.3478, beta: 0.3658 }, unit: 'nats / token' },
};

export const lawLoss = (l: Law, N: number, D: number) => l.E + l.A / N ** l.alpha + l.B / D ** l.beta;

/** Superscript exponent formatting for log axes: 10¹⁵ etc. */
export function pow10(v: number): string {
  const e = Math.round(Math.log10(v));
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return `10${e < 0 ? '⁻' : ''}${[...String(Math.abs(e))].map((d) => sup[+d]).join('')}`;
}

export const si = (n: number) => (n >= 1e12 ? `${(n / 1e12).toPrecision(3)} T` : n >= 1e9 ? `${(n / 1e9).toPrecision(3)} B` : n >= 1e6 ? `${(n / 1e6).toPrecision(3)} M` : n >= 1e3 ? `${(n / 1e3).toPrecision(3)} k` : n.toPrecision(3));
