/**
 * Chapter 25's measurements, written by `uv run lmc ch25 summary`: a "which sentence comes next?" benchmark built
 * from TinyStories, for the models of the book; CourseGPT's calibration; and a deliberately contaminated run.
 */
import raw from './data.json';

export interface BenchmarkResult {
  run: string;
  label: string;
  params: number;
  val_bits: number;
  acc_sum: number;
  ci_sum: [number, number];
  acc_mean: number;
  ci_mean: [number, number];
}

export interface ChapterData {
  benchmark?: {
    n: number;
    results: BenchmarkResult[];
    paired: { a: string; b: string; diff: number; ci: [number, number] } | null;
    examples: { context: string; options: string[]; answer: number }[];
    /** CourseGPT, per item: [probability of its chosen option among the four, 1 if right]. */
    conf: [number, number][] | null;
  };
  /** Next-token calibration: bins of [lo, hi, mean confidence, accuracy, count]. */
  calibration?: { bins: [number, number, number, number, number][]; ece: number; accuracy: number; confidence: number; tokens: number };
  /** Training on the test items: [step, accuracy on those items, accuracy on 1,000 fresh ones]. */
  contaminate?: { before: { test: number; fresh: number }; curve: [number, number, number][]; steps: number; lr: number };
}

export const DATA = raw as unknown as ChapterData;
