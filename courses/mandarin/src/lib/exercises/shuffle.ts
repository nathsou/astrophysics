/** Deterministic shuffling, so prerendered and hydrated pages agree. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], seed: number | string): T[] {
  const r = rng(typeof seed === 'string' ? hash(seed) : seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A shuffle that never leaves everything in its original order (when that is possible). */
export function scramble<T>(xs: readonly T[], seed: string): T[] {
  for (let k = 0; k < 8; k++) {
    const s = shuffle(xs, `${seed}:${k}`);
    if (xs.length < 2 || s.some((x, i) => x !== xs[i])) return s;
  }
  return [...xs].reverse();
}
