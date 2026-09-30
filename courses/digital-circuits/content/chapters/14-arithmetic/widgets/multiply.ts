/**
 * Multiplication by shift and add, the way long multiplication works on paper. For every bit of the multiplier, from
 * the least significant: if the bit is 1, add the multiplicand (shifted left by the bit's position) to the running
 * product; if it is 0, add nothing. An n × n multiplication takes n steps and gives a product of up to 2n bits.
 */
export interface MulStep {
  /** Which multiplier bit this step looks at (0 = least significant). */
  index: number;
  /** Its value. */
  bit: number;
  /** The multiplicand shifted left by `index`: what is added when the bit is 1. */
  shifted: number;
  /** What is actually added (`shifted` or 0). */
  added: number;
  /** The running product before and after the step. */
  before: number;
  after: number;
}

export function steps(a: number, b: number, n = 4): MulStep[] {
  const out: MulStep[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const bit = (b >> i) & 1;
    const shifted = a * 2 ** i;
    const added = bit ? shifted : 0;
    out.push({ index: i, bit, shifted, added, before: acc, after: acc + added });
    acc += added;
  }
  return out;
}

export const product = (a: number, b: number, n = 4): number => steps(a, b, n).at(-1)?.after ?? 0;

/** The additions a multiplier of `n` bits needs: the number of 1 bits in b. */
export const additions = (b: number, n = 4): number => Array.from({ length: n }, (_, i) => (b >> i) & 1).reduce((x, y) => x + y, 0);

/** Full adders in an n × n array multiplier: n(n − 1) of them, plus n² AND gates. */
export const arrayCost = (n: number): { ands: number; fullAdders: number } => ({ ands: n * n, fullAdders: n * (n - 1) });
