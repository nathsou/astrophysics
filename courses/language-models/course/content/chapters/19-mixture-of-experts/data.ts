/**
 * Chapter 19's measurements, written by `uv run lmc ch19 summary`: mixture-of-experts variants of the 6 × 384
 * model against the dense baseline of Chapter 18, all with the same active compute.
 */
import raw from './data.json';

export interface MoeRun {
  key: string;
  label: string;
  val_bits: number;
  tokens_per_s: number | null;
  curve: [number, number][];
  total_params: number;
  /** Parameters used for each token (the router's top-k experts, plus everything outside the MLPs). */
  active_params: number;
}

export interface ChapterData {
  runs: MoeRun[];
  steps?: number;
  /** For each variant, each layer's share of routing slots per expert. */
  loads?: Record<string, number[][]>;
  /** One validation story and, for each layer, each token's top expert (8 experts, top-2 model). */
  story?: { tokens: string[]; experts: number[][] };
}

export const DATA = raw as unknown as ChapterData;
