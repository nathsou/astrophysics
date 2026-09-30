/**
 * Exhaustive search for the fewest gates: is a target truth table possible with `limit` gates of the allowed
 * kinds (and, or, nand, nor, xor, xnor of two to `fanIn` inputs, and not)? Used by the tests to check that the
 * pars of the gate-golf exercises are not just the best the author found but the best there is.
 */
export type Kind = 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'xnor' | 'not';

export interface Target {
  n: number;
  /** Required outputs per row (row index has A as the most significant bit); null is don't-care. */
  rows: (0 | 1 | null)[];
}

const FN: Record<Kind, (ins: number[], full: number) => number> = {
  and: (i, f) => i.reduce((a, b) => a & b, f),
  or: (i) => i.reduce((a, b) => a | b, 0),
  nand: (i, f) => ~i.reduce((a, b) => a & b, f) & f,
  nor: (i, f) => ~i.reduce((a, b) => a | b, 0) & f,
  xor: (i) => i.reduce((a, b) => a ^ b, 0),
  xnor: (i, f) => ~i.reduce((a, b) => a ^ b, 0) & f,
  not: (i, f) => ~i[0]! & f,
};

/** Bit r of the value of input v: the value of variable v in row r. */
export function inputMasks(n: number): number[] {
  return Array.from({ length: n }, (_, v) => {
    let m = 0;
    for (let r = 0; r < 2 ** n; r++) if ((r >> (n - 1 - v)) & 1) m |= 1 << r;
    return m;
  });
}

export function matches(t: Target, value: number): boolean {
  return t.rows.every((want, r) => want === null || ((value >> r) & 1) === want);
}

/** True if some circuit of exactly `limit` gates has a gate whose output equals the target on every specified row. */
export function possible(t: Target, kinds: Kind[], limit: number, fanIn = 3): boolean {
  const full = 2 ** t.rows.length - 1;
  const sigs = inputMasks(t.n);
  if (sigs.some((s) => matches(t, s))) return true;
  const recurse = (depth: number): boolean => {
    if (depth === limit) return false;
    const k = sigs.length;
    for (const kind of kinds) {
      const arities = kind === 'not' ? [1] : Array.from({ length: fanIn - 1 }, (_, i) => i + 2);
      for (const a of arities) {
        const pick = (start: number, chosen: number[]): boolean => {
          if (chosen.length === a) {
            const v = FN[kind](chosen.map((i) => sigs[i]!), full);
            if (matches(t, v)) return true;
            sigs.push(v);
            const found = recurse(depth + 1);
            sigs.pop();
            return found;
          }
          for (let i = start; i < k; i++) {
            chosen.push(i);
            const hit = pick(i, chosen);
            chosen.pop();
            if (hit) return true;
          }
          return false;
        };
        if (pick(0, [])) return true;
      }
    }
    return false;
  };
  return recurse(0);
}

/** The smallest number of gates that works, up to `max`, or undefined. */
export function minGates(t: Target, kinds: Kind[], max: number, fanIn = 3): number | undefined {
  for (let g = 0; g <= max; g++) if (possible(t, kinds, g, fanIn)) return g;
  return undefined;
}

export function tableOf(n: number, fn: (bits: number[]) => 0 | 1 | null): Target {
  return { n, rows: Array.from({ length: 2 ** n }, (_, r) => fn(Array.from({ length: n }, (_, v) => (r >> (n - 1 - v)) & 1))) };
}
