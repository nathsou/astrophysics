/**
 * Chapter 23's measurements, written by `uv run lmc ch23 summary`: a 4-layer GPT trained from scratch on
 * three-term sums, answering directly or by calling a calculator.
 */
import raw from './data.json';

export interface ChapterData {
  examples: { direct: string; tool: string };
  /** Per format: [step, training loss, accuracy on 500 held-out problems]. */
  train?: Record<'direct' | 'tool', { curve: [number, number, number][]; seconds: number }>;
  /** Accuracy by operand length (every operand has exactly that many digits; training used 1 to 6). */
  evaluate?: {
    digits: number[];
    direct: number[];
    tool: number[];
    /** The tool-trained model with no calculator attached: it must write the results itself. */
    tool_without: number[];
    samples: { prompt: string; direct: string; tool: string; tool_without: string }[];
  };
}

export const DATA = raw as unknown as ChapterData;
