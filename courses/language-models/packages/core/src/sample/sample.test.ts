import { describe, expect, it } from 'vitest';
import { sampleIndex } from '../lm.ts';
import { mulberry32 } from '../util/random.ts';
import { beamSearch, entropyBits, frequencyPresencePenalty, minP, prepare, repetitionPenalty, sampleToken, softmaxT, speculativeAccept, topK, topP } from './sample.ts';

const P = [0.5, 0.2, 0.15, 0.1, 0.05];
const kept = (p: ArrayLike<number>) => Array.from(p, (x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
const sum = (p: ArrayLike<number>) => Array.from(p).reduce((a, b) => a + b, 0);

describe('temperature', () => {
  it('is the softmax at T = 1, sharper below, flatter above, greedy at 0', () => {
    const z = [2, 1, 0];
    const p1 = softmaxT(z, 1);
    expect(p1[0]).toBeCloseTo(Math.E ** 2 / (Math.E ** 2 + Math.E + 1), 12);
    expect(entropyBits(softmaxT(z, 0.5))).toBeLessThan(entropyBits(p1));
    expect(entropyBits(softmaxT(z, 2))).toBeGreaterThan(entropyBits(p1));
    expect(Array.from(softmaxT(z, 0))).toEqual([1, 0, 0]);
    expect(entropyBits(softmaxT(z, 1e6))).toBeCloseTo(Math.log2(3), 5);
  });
});

describe('truncation', () => {
  it('top-k keeps the k most probable', () => {
    const p = topK(P, 2);
    expect(kept(p)).toEqual([0, 1]);
    expect(p[0]).toBeCloseTo(0.5 / 0.7, 12);
    expect(kept(topK([0.4, 0.2, 0.2, 0.2], 2))).toEqual([0, 1, 2, 3]); // ties with the k-th are kept
  });

  it('top-p keeps the smallest prefix whose mass reaches p', () => {
    expect(kept(topP(P, 0.5))).toEqual([0]);
    expect(kept(topP(P, 0.6))).toEqual([0, 1]);
    expect(kept(topP(P, 0.85))).toEqual([0, 1, 2]);
    expect(kept(topP(P, 0.86))).toEqual([0, 1, 2, 3]);
    expect(sum(topP(P, 0.6))).toBeCloseTo(1, 12);
  });

  it('min-p keeps tokens within a factor of the most probable', () => {
    expect(kept(minP(P, 0.3))).toEqual([0, 1, 2]); // ≥ 0.15
    expect(kept(minP(P, 0.31))).toEqual([0, 1]);
  });
});

describe('penalties', () => {
  it('repetition penalty always lowers repeated tokens', () => {
    expect(Array.from(repetitionPenalty([2, -2, 1], [0, 1, 1], 2))).toEqual([1, -4, 1]);
  });
  it('frequency and presence penalties subtract per occurrence and once', () => {
    expect(Array.from(frequencyPresencePenalty([0, 0, 0], [0, 1, 1], 0.5, 1))).toEqual([-1.5, -2, 0]);
  });
});

describe('the pipeline', () => {
  it('applies temperature before truncation', () => {
    const z = Array.from(P, Math.log);
    // At T = 2 the distribution flattens, so reaching 0.6 needs more tokens.
    expect(kept(prepare(z, [], { temperature: 1, topP: 0.6 }))).toEqual([0, 1]);
    expect(kept(prepare(z, [], { temperature: 2, topP: 0.6 }))).toEqual([0, 1, 2]);
  });
  it('samples in proportion to the prepared distribution', () => {
    const z = Array.from(P, Math.log);
    const rng = mulberry32(1);
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[sampleToken(z, [], { temperature: 1, topK: 2 }, rng)]!++;
    expect(counts[0]! / 20000).toBeCloseTo(0.5 / 0.7, 1);
    expect(counts[2]! + counts[3]! + counts[4]!).toBe(0);
  });
});

describe('beam search', () => {
  // A toy model where the greedy first step is a trap: "a" is likelier first, but "b" leads to a sure continuation.
  const table: Record<string, number[]> = { '': [0.6, 0.4, 0], '0': [0.34, 0.33, 0.33], '1': [0, 0, 1] };
  const lp = (ids: number[]) => (table[ids.slice(1).join(',')] ?? [1 / 3, 1 / 3, 1 / 3]).map(Math.log);

  it('with width 1 it is greedy', async () => {
    const { best } = await beamSearch(lp, [9], { width: 1, steps: 2 });
    expect(best.ids).toEqual([9, 0, 0]);
  });
  it('a wider beam finds the more probable sequence', async () => {
    const { best, trace } = await beamSearch(lp, [9], { width: 2, steps: 2 });
    expect(best.ids).toEqual([9, 1, 2]);
    expect(best.logp).toBeCloseTo(Math.log(0.4), 12);
    expect(trace).toHaveLength(2);
    expect(trace[1]!.candidates.filter((c) => c.kept)).toHaveLength(2);
  });
});

describe('speculative sampling', () => {
  it('emits tokens distributed as the target, whatever the draft', () => {
    const p = [0.5, 0.3, 0.2], q = [0.1, 0.1, 0.8];
    const rng = mulberry32(3);
    const counts = [0, 0, 0];
    let accepted = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const draft = sampleIndex(q, rng());
      const r = speculativeAccept([p, p], [q], [draft], rng);
      counts[r.tokens[0]!]!++;
      accepted += r.accepted;
    }
    counts.forEach((c, i) => expect(c / n).toBeCloseTo(p[i]!, 1));
    // Acceptance probability is Σ min(p, q) = 0.1 + 0.1 + 0.2 = 0.4.
    expect(accepted / n).toBeCloseTo(0.4, 1);
  });
  it('accepts everything when draft and target agree, and adds a bonus token', () => {
    const p = [0, 1, 0];
    const r = speculativeAccept([p, p, p], [p, p], [1, 1], mulberry32(1));
    expect(r).toEqual({ tokens: [1, 1, 1], accepted: 2 });
  });
});

