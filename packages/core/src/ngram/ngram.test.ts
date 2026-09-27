import { describe, expect, it } from 'vitest';
import { NGramModel, NGramStats, type Smoothing } from './index.ts';
import { crossEntropy, sampleIndex, generate } from '../lm.ts';
import { mulberry32 } from '../util/random.ts';

const rng = mulberry32(7);
const randomIds = (n: number, V: number) => Array.from({ length: n }, () => Math.floor(rng() ** 2 * V)); // skewed

/** Naive reference: Map-based counts. */
function naiveCounts(ids: number[], k: number) {
  const m = new Map<string, number>();
  for (let t = 0; t + k <= ids.length; t++) {
    const key = ids.slice(t, t + k).join(',');
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

/** Naive interpolated Kneser–Ney, straight from the textbook definition. */
function naiveKN(ids: number[], V: number, n: number, d: number, ctx: number[], w: number): number {
  const top = Math.min(n, ctx.length + 1);
  const raw = (k: number) => naiveCounts(ids, k);
  const cont = (k: number) => {
    const m = new Map<string, number>();
    for (const key of raw(k + 1).keys()) {
      const suffix = key.split(',').slice(1).join(',');
      m.set(suffix, (m.get(suffix) ?? 0) + 1);
    }
    return m;
  };
  let p = 1 / V;
  for (let j = 1; j <= top; j++) {
    const table = j < top ? cont(j) : raw(j);
    const h = ctx.slice(ctx.length - (j - 1));
    let tot = 0, types = 0, c = 0;
    for (let x = 0; x < V; x++) {
      const v = table.get([...h, x].join(',')) ?? 0;
      tot += v;
      if (v > 0) types++;
      if (x === w) c = v;
    }
    if (tot === 0) continue;
    p = Math.max(c - d, 0) / tot + ((d * types) / tot) * p;
  }
  return p;
}

describe('NGramStats', () => {
  const ids = randomIds(3000, 7);
  const stats = new NGramStats(ids, 7, 4);

  it('counts every order exactly like a naive Map', () => {
    for (let k = 1; k <= 4; k++) {
      const naive = naiveCounts(ids, k);
      expect(stats.table(k).codes.length).toBe(naive.size);
      for (const [key, c] of naive) {
        const code = key.split(',').reduce((a, x) => a * 7 + Number(x), 0);
        expect(stats.count(k, code)).toBe(c);
      }
    }
  });

  it('rejects orders whose codes would overflow doubles', () => {
    expect(() => new NGramStats([0, 1], 70_000, 4)).toThrow('2^53');
  });
});

describe('NGramModel', () => {
  const V = 6;
  const ids = randomIds(2000, V);
  const smoothings: Smoothing[] = [{ kind: 'mle' }, { kind: 'addk', k: 0.5 }, { kind: 'interp', lambda: 0.7 }, { kind: 'kn', d: 0.75 }];
  const contexts = [[], [0], [5, 5], [1, 2, 3], [0, 0, 0, 0, 0], [5, 4, 3, 2]];

  for (const s of smoothings) {
    it(`${s.kind}: distributions sum to 1 and agree with prob()`, () => {
      const m = NGramModel.train(ids, V, 4, s);
      for (const ctx of contexts) {
        const d = m.distribution(ctx);
        expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        for (let w = 0; w < V; w++) expect(m.prob(ctx, w)).toBeCloseTo(d[w]!, 12);
      }
    });
  }

  it('MLE is the relative frequency', () => {
    // a b a b a c  → after "a": b twice, c once
    const m = NGramModel.train([0, 1, 0, 1, 0, 2], 3, 2, { kind: 'mle' });
    expect(m.prob([0], 1)).toBeCloseTo(2 / 3, 12);
    expect(m.prob([0], 2)).toBeCloseTo(1 / 3, 12);
    expect(m.prob([0], 0)).toBe(0);
  });

  it('add-1 (Laplace) moves mass to unseen continuations', () => {
    const m = NGramModel.train([0, 1, 0, 1, 0, 2], 3, 2, { kind: 'addk', k: 1 });
    expect(m.prob([0], 0)).toBeCloseTo(1 / 6, 12);
    expect(m.prob([0], 1)).toBeCloseTo(3 / 6, 12);
  });

  it('Kneser–Ney matches the textbook definition', () => {
    const small = randomIds(400, 5);
    const m = NGramModel.train(small, 5, 3, { kind: 'kn', d: 0.6 });
    for (const ctx of [[], [1], [0, 4], [2, 2]]) for (let w = 0; w < 5; w++) expect(m.prob(ctx, w)).toBeCloseTo(naiveKN(small, 5, 3, 0.6, ctx, w), 12);
  });
});

describe('evaluation and sampling', () => {
  it('a uniform model has cross-entropy log2 V', () => {
    const uniform = { vocabSize: 8, contextLength: 0, distribution: () => new Float64Array(8).fill(1 / 8), prob: () => 1 / 8 };
    expect(crossEntropy(uniform, [1, 2, 3, 4, 5]).crossEntropy).toBeCloseTo(3, 12);
  });

  it('MLE on unseen data gives infinite cross-entropy', () => {
    const m = NGramModel.train([0, 1, 0, 1], 3, 2, { kind: 'mle' });
    const r = crossEntropy(m, [0, 2]);
    expect(r.crossEntropy).toBe(Infinity);
    expect(r.zeros).toBe(1);
  });

  it('samples by inverse CDF', () => {
    expect(sampleIndex([0.2, 0.5, 0.3], 0)).toBe(0);
    expect(sampleIndex([0.2, 0.5, 0.3], 0.21)).toBe(1);
    expect(sampleIndex([0.2, 0.5, 0.3], 0.999)).toBe(2);
    expect(sampleIndex([0, 1, 0], 0.5)).toBe(1);
  });

  it('generates reproducibly with a seeded RNG', () => {
    const m = NGramModel.train(randomIds(500, 4), 4, 3, { kind: 'kn', d: 0.75 });
    expect(generate(m, [0], 20, mulberry32(1))).toEqual(generate(m, [0], 20, mulberry32(1)));
  });
});
