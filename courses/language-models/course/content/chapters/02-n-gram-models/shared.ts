/**
 * Data shared by Chapter 2's widgets: TinyShakespeare as character ids, a 90/10 train/validation
 * split, and n-gram count tables up to order 8 (built once per page, ≈0.5 s).
 */
import { CharVocab, WordVocab } from '@lm/core/tokenise';
import { NGramModel, NGramStats, type Smoothing } from '@lm/core/ngram';
import * as T from '@lm/core/text';
import { loadCorpus } from '$lib/data/corpus';

export const MAX_ORDER = 8;

export interface CharData {
  text: string;
  vocab: CharVocab;
  train: number[];
  val: number[];
  stats: NGramStats;
}

let chars: Promise<CharData> | undefined;

/** Yield to the browser so a "counting…" message can paint before heavy work. */
const tick = () => new Promise((r) => setTimeout(r, 0));

export function charData(): Promise<CharData> {
  chars ??= (async () => {
    const text = await loadCorpus('shakespeare');
    await tick();
    const vocab = CharVocab.fromText(text);
    const ids = vocab.encode(text);
    const split = Math.floor(ids.length * 0.9);
    const train = ids.slice(0, split);
    const val = ids.slice(split);
    const stats = new NGramStats(train, vocab.vocabSize, MAX_ORDER);
    return { text, vocab, train, val, stats };
  })();
  return chars;
}

export interface WordData {
  vocab: WordVocab;
  train: number[];
  val: number[];
  stats: NGramStats;
}

let wordsP: Promise<WordData> | undefined;

/** Word-level data (orders 1–3; V ≈ 12k so V⁴ would overflow our 53-bit codes). */
export function wordData(): Promise<WordData> {
  wordsP ??= (async () => {
    const text = await loadCorpus('shakespeare');
    await tick();
    const ws = T.words(text);
    const split = Math.floor(ws.length * 0.9);
    const vocab = new WordVocab(ws.slice(0, split));
    const ids = vocab.encode(ws);
    const train = ids.slice(0, split);
    return { vocab, train, val: ids.slice(split), stats: new NGramStats(train, vocab.vocabSize, 3) };
  })();
  return wordsP;
}

export type SmoothingKind = Smoothing['kind'];

export const SMOOTHING_LABELS: Record<SmoothingKind, string> = {
  mle: 'MLE (no smoothing)',
  addk: 'Add-k',
  interp: 'Interpolation',
  kn: 'Kneser–Ney',
};

/** Build a smoothing config from the page's shared parameters. */
export function smoothingFrom(kind: SmoothingKind, p: { k: number; lambda: number; d: number }): Smoothing {
  return kind === 'mle' ? { kind } : kind === 'addk' ? { kind, k: p.k } : kind === 'interp' ? { kind, lambda: p.lambda } : { kind, d: p.d };
}

export function model(data: { stats: NGramStats }, order: number, s: Smoothing): NGramModel {
  return new NGramModel(data.stats, order, s);
}

/** Train/validation text for display. */
export function valText(d: CharData, start: number, length: number): number[] {
  return d.val.slice(start, start + length);
}
