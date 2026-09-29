/**
 * Chapter 21's measurements, written by `uv run lmc ch21 summary`: preference pairs sampled from Chapter 20's
 * instruction-tuned model, a Bradley–Terry reward model, best-of-n sampling, and DPO at two values of β.
 */
import raw from './data.json';

export interface Evaluation {
  /** Fraction of 200 held-out instructions whose story uses the name and all three words. */
  all: number;
  /** Mean number of the four constraints satisfied. */
  mean_score: number;
  /** Bits per token of the generated stories under the original CourseGPT: lower reads more naturally. */
  fluency_bits: number;
  samples: { instruction: string; story: string }[];
  /** DPO only: [step, loss, fraction of the batch where the chosen response has the larger implicit reward]. */
  curve?: [number, number, number][];
}

export interface ChapterData {
  pairs?: { count: number; example: { name: string; words: string[]; chosen: string; rejected: string; scores: [number, number] } };
  /** Held-out accuracy of the reward model: [step, fraction of pairs ranked correctly]. */
  reward?: { curve: [number, number][]; pairs: number };
  /** Fraction of instructions fully satisfied by best-of-k, picking with the reward model or with the true score. */
  bestofn?: { reward_model: [number, number][]; oracle: [number, number][] };
  dpo?: Record<string, Evaluation>;
}

export const DATA = raw as unknown as ChapterData;
