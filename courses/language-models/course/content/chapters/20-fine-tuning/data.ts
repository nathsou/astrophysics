/**
 * Chapter 20's measurements, written by `uv run lmc ch20 summary`: CourseGPT fine-tuned to follow story
 * instructions, fully and with LoRA, and how well each follows instructions and remembers plain stories.
 */
import raw from './data.json';

export interface ChapterData {
  settings: Record<string, string>;
  finetune?: Record<string, { trainable: number; seconds: number; memory_gib: number; curve: [number, number][] }>;
  evaluate?: {
    n: number;
    /** Share of generated stories using all three words (words), the name (name), or both (all); loss on plain stories. */
    results: Record<string, { words: number; name: number; all: number; story_bits: number }>;
    samples: Record<string, { instruction: string; story: string }[]>;
  };
  /** Singular values of the full fine-tune's weight change for a few matrices, and their cumulative energy. */
  spectrum?: Record<string, { singular: number[]; energy: number[]; rank: number }>;
}

export const DATA = raw as unknown as ChapterData;
