/**
 * Chapter 22's measurements, written by `uv run lmc ch22 summary`: a 4-layer GPT trained from scratch on 6-digit
 * addition, answering directly or through a scratchpad; majority voting over sampled answers; and GRPO.
 */
import raw from './data.json';

export type ModelKey = 'direct' | 'scratchpad' | 'direct-short';

export interface ChapterData {
  examples: { direct: string; scratchpad: string };
  /** Per model: [step, training loss, greedy accuracy on 500 held-out problems]. */
  train?: Record<ModelKey, { curve: [number, number, number][]; seconds?: number }>;
  /** Per model: greedy accuracy, and [k, accuracy] of majority voting and of pass@k over k samples at T = 1. */
  vote?: Record<ModelKey, { greedy: number; vote: [number, number][]; pass: [number, number][] }>;
  /**
   * GRPO from the under-trained direct model: [step, greedy accuracy on 1,000 problems, mean reward of the training
   * batch's samples, accuracy of one sample at T = 1 on 500 problems]; and greedy, pass@1 and pass@8 before and after.
   */
  grpo?: GrpoRun;
  /** The same run at other learning rates. */
  grpo_sweep?: GrpoRun[];
}

export interface GrpoRun {
  curve: [number, number, number, number][];
  group: number;
  prompts: number;
  beta: number;
  lr: number;
  before: { greedy: number; pass1: number; pass8: number };
  after: { greedy: number; pass1: number; pass8: number };
}

export const DATA = raw as unknown as ChapterData;

export const LABELS: Record<ModelKey, string> = {
  direct: 'Direct answer',
  scratchpad: 'Scratchpad',
  'direct-short': 'Direct, under-trained',
};
