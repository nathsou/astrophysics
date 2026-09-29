/**
 * Rotary position embedding for one head's vector at position `pos` (Su et al., 2021). Coordinates i and
 * i + d/2 form a pair, rotated by the angle pos · base^(−2i/d).
 */
export function rope(x: Float32Array, pos: number, base = 10000): Float32Array {
  const d = x.length, half = d / 2;
  const out = new Float32Array(d);
  for (let i = 0; i < half; i++) {
    const theta = pos * base ** ((-2 * i) / d); // low i: fast rotation; high i: slow
    const c = Math.cos(theta), s = Math.sin(theta);
    const x1 = x[i]!, x2 = x[i + half]!;
    out[i] = x1 * c - x2 * s;
    out[i + half] = x1 * s + x2 * c;
  }
  return out;
}
