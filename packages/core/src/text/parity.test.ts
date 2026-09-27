/// <reference types="node" />
/**
 * Parity test: the TypeScript text statistics must match the Python companion exactly
 * (fixture written by `uv run lmc ch01 --write-fixture`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codePoints, countFrequencies, entropy, fitPowerLaw, rankFrequencies, vocabularyGrowth, words } from './index.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const fixture = JSON.parse(readFileSync(root('training/fixtures/ch01_shakespeare_stats.json'), 'utf8'));
const text = readFileSync(root('course/static/data/tinyshakespeare.txt'), 'utf8');

describe('TypeScript ↔ Python parity (Chapter 1)', () => {
  const ws = words(text);
  const wordRanks = rankFrequencies(countFrequencies(ws));
  const chars = rankFrequencies(countFrequencies(codePoints(text)));

  it('counts characters and words identically', () => {
    expect(codePoints(text).length).toBe(fixture.characters);
    expect(chars.length).toBe(fixture.distinct_characters);
    expect(ws.length).toBe(fixture.words);
    expect(wordRanks.length).toBe(fixture.distinct_words);
    expect(wordRanks.filter((r) => r.count === 1).length).toBe(fixture.hapax_legomena);
    expect(wordRanks.slice(0, 10).map((r) => r.item)).toEqual(fixture.top_words);
  });

  it('computes the same entropies', () => {
    expect(entropy(chars.map((r) => r.count))).toBeCloseTo(fixture.char_entropy_bits, 10);
    expect(entropy(wordRanks.map((r) => r.count))).toBeCloseTo(fixture.word_entropy_bits, 10);
  });

  it('fits the same Zipf and Heaps parameters', () => {
    const body = wordRanks.filter((r) => r.count >= 3);
    const zipf = fitPowerLaw(body.map((r) => r.rank), body.map((r) => r.count));
    expect(zipf.s).toBeCloseTo(fixture.zipf.s, 8);
    expect(zipf.r2).toBeCloseTo(fixture.zipf.r2, 8);
    const g = vocabularyGrowth(ws, 80).filter((p) => p.n >= 2000);
    const heaps = fitPowerLaw(g.map((p) => p.n), g.map((p) => p.v));
    expect(heaps.C).toBeCloseTo(fixture.heaps.K, 6);
    expect(-heaps.s).toBeCloseTo(fixture.heaps.beta, 8);
  });
});
