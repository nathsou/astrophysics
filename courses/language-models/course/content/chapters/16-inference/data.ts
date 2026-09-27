/**
 * Chapter 16's measurements, written by `uv run lmc ch16 summary` from CourseGPT in PyTorch.
 */
import raw from './data.json';

export interface ChapterData {
  /** Validation loss with the weights rounded to fewer bits (fake quantisation). */
  quant?: { run: string; tokens: number; results: { label: string; bits: number; group: number | null; val_bits: number; megabytes: number }[] };
  /** Speculative sampling with the draft model: tokens per target pass and acceptance, for each γ. */
  speculative?: { run: string; draft: string; results: { gamma: number; tokens_per_pass: number; acceptance: number }[] };
  /** A sample of real weights, stored column by column. */
  weights?: Record<string, { rows: number; cols: number; values: number[] }>;
}

export const DATA = raw as unknown as ChapterData;
