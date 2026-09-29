/**
 * Rotary position embedding for one head's vector at position `pos` (Su et al., 2021). Coordinates i and
 * i + d/2 form a pair, rotated by the angle pos · base^(−2i/d).
 */
export function rope(x: Float32Array, pos: number, base = 10000): Float32Array {
  const d = x.length, half = d / 2;
  // TODO
  return Float32Array.from(x);
}
