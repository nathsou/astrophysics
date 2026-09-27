/**
 * Tokenisers shared by Chapter 3's widgets: BPE trained live on TinyShakespeare (snapshots at any
 * number of merges from one incremental training run), GPT-2's real tokeniser, and simple baselines.
 */
import { base } from '$app/paths';
import { BpeTokeniser, BpeTrainer, COURSE_PATTERN, loadGpt2 } from '@lm/core/tokenise';
import * as T from '@lm/core/text';
import { loadCorpus } from '$lib/data/corpus';

const tick = () => new Promise((r) => setTimeout(r, 0));

let trainerP: Promise<BpeTrainer> | undefined;

/** One trainer over the whole corpus, advanced on demand. */
async function trainer(): Promise<BpeTrainer> {
  trainerP ??= loadCorpus('shakespeare').then(async (text) => {
    await tick();
    return new BpeTrainer(text, COURSE_PATTERN);
  });
  return trainerP;
}

const snapshots = new Map<number, BpeTokeniser>();

/** Shakespeare BPE with exactly `merges` merges (trained incrementally, cached). */
export async function shakespeareBpe(merges: number): Promise<BpeTokeniser> {
  const cached = snapshots.get(merges);
  if (cached) return cached;
  const t = await trainer();
  while (t.merges.length < merges) {
    for (let i = 0; i < 200 && t.merges.length < merges; i++) if (!t.step()) break;
    await tick();
  }
  const tok = new BpeTokeniser({ pattern: COURSE_PATTERN, merges: t.merges.slice(0, merges), special: { '<|endoftext|>': 256 + merges } });
  snapshots.set(merges, tok);
  return tok;
}

let gpt2P: Promise<{ tokeniser: BpeTokeniser; gpt2Id: Int32Array }> | undefined;

export function gpt2(): Promise<{ tokeniser: BpeTokeniser; gpt2Id: Int32Array }> {
  gpt2P ??= Promise.all([
    fetch(`${base}/data/gpt2/vocab.bpe`).then((r) => r.text()),
    fetch(`${base}/data/gpt2/encoder.json`).then((r) => r.json() as Promise<Record<string, number>>),
  ]).then(([bpe, enc]) => loadGpt2(bpe, enc));
  return gpt2P;
}

let wordsP: Promise<Set<string>> | undefined;

/** Word types seen in TinyShakespeare (for showing out-of-vocabulary words). */
export function shakespeareWords(): Promise<Set<string>> {
  wordsP ??= loadCorpus('shakespeare').then((t) => new Set(T.words(t)));
  return wordsP;
}

export interface Token {
  /** Text shown in the chip. */
  text: string;
  /** Id in the tokeniser's own numbering (display id). */
  id: number;
  /** UTF-8 bytes this token stands for. */
  bytes: number[];
  /** Out of vocabulary (word tokeniser only). */
  unk?: boolean;
  /** Internal id for merge-tree lookup (BPE tokenisers). */
  internal?: number;
}

export type TokeniserKind = 'chars' | 'bytes' | 'words' | 'bpe' | 'gpt2';

const visible = (s: string) => s.replace(/ /g, '␣').replace(/\n/g, '↵').replace(/\t/g, '⇥');

export async function tokenise(kind: TokeniserKind, text: string, merges = 1024): Promise<Token[]> {
  if (kind === 'chars') return T.codePoints(text).map((cp) => ({ text: visible(String.fromCodePoint(cp)), id: cp, bytes: [...T.utf8Encode(String.fromCodePoint(cp))] }));
  if (kind === 'bytes') return [...T.utf8Encode(text)].map((b) => ({ text: b < 0x80 ? visible(String.fromCharCode(b)) : `\\x${b.toString(16).toUpperCase()}`, id: b, bytes: [b] }));
  if (kind === 'words') {
    const vocab = await shakespeareWords();
    const list = [...vocab];
    const index = new Map(list.map((w, i) => [w, i + 1]));
    return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*|[^\s\p{L}\p{N}]/gu) ?? []).map((w) => {
      const lw = w.toLowerCase();
      const known = index.get(lw);
      return { text: known ? w : `${w}`, id: known ?? 0, bytes: [...T.utf8Encode(w)], unk: !known && /[\p{L}\p{N}]/u.test(w) };
    });
  }
  const { tokeniser, map } = kind === 'gpt2' ? await gpt2().then((g) => ({ tokeniser: g.tokeniser, map: (i: number) => g.gpt2Id[i]! })) : { tokeniser: await shakespeareBpe(merges), map: (i: number) => i };
  return tokeniser.encode(text).map((i) => ({ text: tokeniser.show(i), id: map(i), bytes: [...tokeniser.tokenBytes(i)], internal: i }));
}
