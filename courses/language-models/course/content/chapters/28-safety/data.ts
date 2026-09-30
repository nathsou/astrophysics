/** Chapter 28's measurements, written by `uv run lmc ch28 summary`: a backdoor planted by data poisoning. */
import raw from './data.json';

export interface Rates {
  /** Fraction of stories containing the payload, for the trigger name and for ordinary names. */
  trigger: number;
  clean: number;
  trigger_words: number;
  clean_words: number;
}

export interface ChapterData {
  poison?: {
    trigger: string;
    payload: string;
    total: number;
    example: { name: string; words: string[]; story: string };
    results: (Rates & { count: number; fraction: number; samples: { instruction: string; story: string }[]; after_clean?: Rates })[];
  };
}

export const DATA = raw as unknown as ChapterData;
