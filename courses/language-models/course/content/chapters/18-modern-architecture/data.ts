/**
 * Chapter 18's measurements, written by `uv run lmc ch18 summary`: the 6 × 384 GPT on TinyStories at
 * 6.25 × 10¹⁵ FLOPs with each of Llama's block changes, and loss by position beyond the training context.
 */
import raw from './data.json';

export interface ArchRun {
  key: string;
  label: string;
  /** Validation bits per token at the end of the run. */
  val_bits: number;
  step: number;
  /** Median training throughput. */
  tokens_per_s: number | null;
  /** [step, training bits per token] every 100 steps. */
  curve: [number, number][];
  params: number;
  /** Bytes of bf16 KV cache per sequence at the full 512-token context. */
  kv_cache_bytes: number;
}

export interface ChapterData {
  runs: ArchRun[];
  steps?: number;
  budget?: number;
  /** Mean validation bits per token by position (bins of 64), for models trained with a 512-token context. */
  context?: Record<string, [number, number][]>;
}

export const DATA = raw as unknown as ChapterData;
