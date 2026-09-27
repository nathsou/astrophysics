/// <reference types="node" />
/** TypeScript ↔ Python parity for Chapter 2 (fixture: `uv run lmc ch02 --max-order 5 --write-fixture`). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CharVocab } from '../tokenise/char.ts';
import { crossEntropy } from '../lm.ts';
import { NGramModel, NGramStats, type Smoothing } from './index.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const fixture = JSON.parse(readFileSync(root('training/fixtures/ch02_ngram_bits.json'), 'utf8')) as {
  eval: number;
  start: number;
  results: Record<string, { train: number | null; val: number | null }[]>;
};

describe('n-gram cross-entropy matches Python', () => {
  const text = readFileSync(root('course/static/data/tinyshakespeare.txt'), 'utf8');
  const vocab = CharVocab.fromText(text);
  const ids = vocab.encode(text);
  const split = Math.floor(ids.length * 0.9);
  const train = ids.slice(0, split), val = ids.slice(split);
  const stats = new NGramStats(train, vocab.vocabSize, 5);
  const smoothings: Record<string, Smoothing> = { mle: { kind: 'mle' }, addk: { kind: 'addk', k: 0.1 }, interp: { kind: 'interp', lambda: 0.8 }, kn: { kind: 'kn', d: 0.75 } };
  const window = (xs: number[]) => xs.slice(0, fixture.eval + fixture.start);

  for (const [name, s] of Object.entries(smoothings)) {
    it(name, () => {
      fixture.results[name]!.forEach((expected, i) => {
        const m = new NGramModel(stats, i + 1, s);
        const tr = crossEntropy(m, window(train), { start: fixture.start }).crossEntropy;
        const va = crossEntropy(m, window(val), { start: fixture.start }).crossEntropy;
        // null in the fixture means an infinite cross-entropy.
        for (const [got, want] of [[tr, expected.train], [va, expected.val]] as const) {
          if (want === null) expect(got).toBe(Infinity);
          else expect(got).toBeCloseTo(want, 9);
        }
      });
    });
  }
});
