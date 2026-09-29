/**
 * A small seeded pseudo-random generator (mulberry32) for the random-program generators and tests.
 * Deterministic across platforms: the same seed always gives the same sequence.
 */
export class Prng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A uniformly distributed 32-bit unsigned integer. */
  u32(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** A float in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** An integer in [lo, hi] (inclusive). */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)]!;
  }

  /** Pick a key with probability proportional to its weight. */
  weighted<K extends string>(weights: Partial<Record<K, number>>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.float() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r < 0) return k;
    }
    return entries[entries.length - 1]![0];
  }
}
