/**
 * Seeded pseudo-random numbers (xoshiro128**, seeded with splitmix32). Everything random in the toolchain
 * comes from here so that tests, figures and precomputed samples are reproducible.
 */
export interface Rng {
  /** A uniformly distributed unsigned 32-bit integer. */
  nextU32(): number;
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [lo, hi) (hi exclusive). */
  int(lo: number, hi: number): number;
  /** A random element of a non-empty array. */
  pick<T>(xs: readonly T[]): T;
  /** A shuffled copy. */
  shuffle<T>(xs: readonly T[]): T[];
  /** true with probability p. */
  chance(p: number): boolean;
  /** An independent generator derived from this one. */
  fork(): Rng;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function rng(seed = 1): Rng {
  const sm = splitmix32(seed);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
  const nextU32 = () => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result;
  };
  const self: Rng = {
    nextU32,
    next: () => nextU32() / 4294967296,
    int: (lo, hi) => lo + Math.floor((nextU32() / 4294967296) * (hi - lo)),
    pick: (xs) => xs[Math.floor((nextU32() / 4294967296) * xs.length)]!,
    shuffle: (xs) => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor((nextU32() / 4294967296) * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance: (p) => nextU32() / 4294967296 < p,
    fork: () => rng(nextU32()),
  };
  return self;
}
