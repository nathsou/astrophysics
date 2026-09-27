/**
 * Measurements quoted in Chapter 14, written by `uv run lmc ch14 summary` from the PyTorch lab's runs on
 * an RTX 4060 Ti. Sections are missing until the corresponding command has been run.
 */
import raw from './data.json';

export interface SpeedResult {
  label: string;
  tokens_per_s: number;
  tflops: number;
  mfu: number;
  memory_gib: number;
}

export interface AttentionRow {
  T: number;
  naive_ms: number | null;
  naive_mib: number | null;
  flash_ms: number | null;
  flash_mib: number | null;
}

export interface CourseGptLog {
  config: Record<string, number | string | boolean>;
  params: number;
  flops_per_token: number;
  /** [step, train bits/token, tokens/s, MFU] every 100 steps. */
  train: [number, number, number, number][];
  /** [step, validation bits/token, seconds since the start]. */
  val: [number, number, number][];
  /** [step, story opening generated from <|endoftext|> with a fixed seed]. */
  samples: [number, string][];
}

export interface ChapterData {
  speed?: { gpu: string; batch: number; context: number; results: SpeedResult[] };
  attention?: { batch: number; heads: number; head_dim: number; rows: AttentionRow[] };
  precision?: {
    checkpoint: string;
    /** Histogram of log₂|g| over all gradient entries, one bin per power of two from log2_min. */
    log2_min: number;
    hist: number[];
    median_log2: number;
    scales: Record<string, { zero: number; subnormal: number; overflow: number }>;
  };
  /** CourseGPT on the whole validation split. */
  evaluate?: { run: string; tokens: number; val_bits: number; bits_per_byte: number };
  baselines?: { uniform: number; unigram: number; bigram: number; bigram_lambda: number; bytes_per_token: number };
  /** [step, train bits/token] curves and final validation for each sweep run. */
  sweep: { run: string; curve: [number, number][]; val_bits: number }[];
  coursegpt?: CourseGptLog;
  tokeniser: {
    meta: { vocab: number; eot: number; val: { tokens: number; bytes: number; bytes_per_token: number }; train: { tokens: number; bytes: number; bytes_per_token: number } };
    /** [merges, bytes per token] while training the tokeniser. */
    merge_curve: [number, number][];
  };
}

export const DATA = raw as unknown as ChapterData;
