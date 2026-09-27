/**
 * Truncation rules for sampling. Each takes a probability distribution and returns a new one in which
 * the discarded tokens have probability 0 and the survivors are renormalised to sum to 1.
 */

function renormalise(p: Float64Array): Float64Array {
  const total = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / total);
}

/** Indices by decreasing probability; ties by index so the result is deterministic. */
function byProbability(p: ArrayLike<number>): number[] {
  return Array.from({ length: p.length }, (_, i) => i).sort((a, b) => p[b]! - p[a]! || a - b);
}

/** Keep the k most probable tokens, plus any tied with the k-th. k ≤ 0 or k ≥ length: keep all. */
export function topK(p: ArrayLike<number>, k: number): Float64Array {
  const out = Float64Array.from(p);
  if (k <= 0 || k >= p.length) return out;
  const threshold = p[byProbability(p)[k - 1]!]!;
  return renormalise(out.map((x) => (x >= threshold ? x : 0)));
}

/** Keep the smallest set of most probable tokens whose total probability is at least `top` (≥ 1: keep all). */
export function topP(p: ArrayLike<number>, top: number): Float64Array {
  if (top >= 1) return Float64Array.from(p);
  const out = new Float64Array(p.length);
  let mass = 0;
  for (const i of byProbability(p)) {
    if (mass >= top) break;
    out[i] = p[i]!;
    mass += p[i]!;
  }
  return renormalise(out);
}

/** Keep the tokens whose probability is at least `ratio` times the largest probability. */
export function minP(p: ArrayLike<number>, ratio: number): Float64Array {
  const max = Math.max(...Array.from(p));
  return renormalise(Float64Array.from(p, (x) => (x >= ratio * max ? x : 0)));
}
