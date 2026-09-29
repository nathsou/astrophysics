/**
 * A monotone stretch of one axis: make room inside chosen intervals (the footprints of gates that
 * are being opened up) and shift everything after them, so a drawing keeps its shape, its wires stay
 * straight and connected, and only the distances grow.
 */

export interface Need {
  /** The interval's ends: both must be among the coordinates passed to `stretch`. */
  a: number;
  b: number;
  /** The interval must be at least this long after stretching. */
  min: number;
}

export interface Stretch {
  /** Map a coordinate: exact at the coordinates given, linear between them, a shift beyond them. */
  (v: number): number;
}

/**
 * Stretch an axis. `coords` are the coordinates that must map exactly (wire vertices and pins). Every
 * gap between neighbours keeps at least its length; an interval that is too short gets the
 * shortfall added to its first and last gaps, half each, so a gate's pins stay in the middle of its box.
 */
export function stretch(coords: number[], needs: Need[]): Stretch {
  const xs = [...new Set(coords)].sort((p, q) => p - q);
  const gap = xs.slice(1).map((v, i) => v - xs[i]!);
  const index = new Map(xs.map((v, i) => [v, i]));
  for (const n of [...needs].sort((p, q) => p.b - q.b || p.a - q.a)) {
    const i = index.get(n.a);
    const j = index.get(n.b);
    if (i === undefined || j === undefined || j <= i) continue;
    let have = 0;
    for (let k = i; k < j; k++) have += gap[k]!;
    const short = n.min - have;
    if (short <= 0) continue;
    gap[i] = gap[i]! + Math.ceil(short / 2);
    gap[j - 1] = gap[j - 1]! + Math.floor(short / 2);
  }
  const pos = [xs[0] ?? 0];
  for (const g of gap) pos.push(pos[pos.length - 1]! + g);
  return (v) => {
    if (!xs.length) return v;
    if (v <= xs[0]!) return pos[0]! + (v - xs[0]!);
    const last = xs.length - 1;
    if (v >= xs[last]!) return pos[last]! + (v - xs[last]!);
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid]! <= v) lo = mid;
      else hi = mid;
    }
    const f = (v - xs[lo]!) / (xs[lo + 1]! - xs[lo]!);
    return pos[lo]! + f * (pos[lo + 1]! - pos[lo]!);
  };
}
