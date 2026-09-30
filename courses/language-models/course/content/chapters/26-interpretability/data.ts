/**
 * Chapter 26's measurements on CourseGPT, written by `uv run lmc ch26 summary`: the logit lens, attention-head
 * scores, linear probes and a sparse autoencoder.
 */
import raw from './data.json';

export interface ChapterData {
  lens?: {
    /** Per prompt: tokens, and for each layer (0 = embeddings … 8) and position the top 3 [token, probability]. */
    prompts: { tokens: string[]; lens: [string, number][][][] }[];
    /** Averages over validation text, per layer: top-1 agreement with the final layer, KL from it (bits), top-1 accuracy. */
    agree: number[];
    kl_bits: number[];
    top1: number[];
  };
  heads?: {
    induction: number[][];
    previous: number[][];
    T: number;
    /** Loss (bits) at each position of 128 tokens of validation text repeated twice (scores are on the same). */
    loss: number[];
    /** The same measurements on random tokens repeated twice. */
    random?: { induction: number[][]; previous: number[][]; loss: number[] };
    example: {
      tokens: string[];
      induction: { layer: number; head: number; attn: number[][] };
      previous: { layer: number; head: number; attn: number[][] };
    };
  };
  probe?: {
    names: number;
    test: number;
    majority: number;
    examples: string[];
    templates: Record<'name' | 'later', string>;
    name: { accuracy: number[]; control: number[] };
    later: { accuracy: number[]; control: number[] };
  };
  sae?: {
    layer: number;
    m: number;
    k: number;
    steps: number;
    curve: [number, number][];
    fvu: number;
    bits: { clean: number; sae: number; mean: number };
    recovered: number;
    dead: number;
    density_hist: Record<string, number>;
    features: { id: number; density: number; examples: { tokens: string[]; acts: number[] }[]; promotes: string[] }[];
  };
}

export const DATA = raw as unknown as ChapterData;

/** Show a token's spaces and newlines visibly. */
export const show = (t: string) => t.replace(/\n/g, '↵').replace(/^ /, '·');
