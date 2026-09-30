/**
 * Shifters. Shifting left by k multiplies by 2^k (and drops the bits that fall off the top); a logical right shift
 * divides an unsigned number by 2^k, rounding down; an arithmetic right shift copies the sign bit into the empty
 * places, so it divides a two's complement number by 2^k, rounding towards −∞. A barrel shifter does any shift
 * in log₂ n stages of 2:1 multiplexers: stage j shifts by 2^j or not, according to bit j of the shift amount.
 */
export type ShiftMode = 'lsl' | 'lsr' | 'asr' | 'rol';

export const MODES: { id: ShiftMode; label: string; title: string }[] = [
  { id: 'lsl', label: 'Left', title: 'Logical shift left: zeros come in at the right' },
  { id: 'lsr', label: 'Right', title: 'Logical shift right: zeros come in at the left' },
  { id: 'asr', label: 'Arithmetic right', title: 'Arithmetic shift right: the sign bit is copied in at the left' },
  { id: 'rol', label: 'Rotate left', title: 'Rotate left: the bits that fall off the top come in at the bottom' },
];

const mk = (n: number) => 2 ** n - 1;

/** The result of shifting an n-bit word by k places. */
export function shift(x: number, k: number, mode: ShiftMode, n = 8): number {
  const m = mk(n);
  x &= m;
  k = Math.max(0, Math.min(n, k));
  switch (mode) {
    case 'lsl':
      return (x * 2 ** k) % 2 ** n;
    case 'lsr':
      return Math.floor(x / 2 ** k);
    case 'asr': {
      const neg = (x & 2 ** (n - 1)) !== 0;
      const r = Math.floor(x / 2 ** k);
      return neg ? (r | (m - (2 ** (n - k) - 1))) & m : r;
    }
    case 'rol': {
      const j = k % n;
      return j === 0 ? x : (((x * 2 ** j) % 2 ** n) | Math.floor(x / 2 ** (n - j))) & m;
    }
  }
}

/** The bits of x, most significant first, as an array of n numbers. */
export const toBits = (x: number, n = 8): number[] => Array.from({ length: n }, (_, i) => (x >> (n - 1 - i)) & 1);
export const fromBits = (b: number[]): number => b.reduce((v, x) => v * 2 + x, 0);

export interface Stage {
  /** The shift this stage performs when enabled: 1, 2, 4, … */
  by: number;
  enabled: boolean;
  /** The word after the stage, most significant bit first. */
  bits: number[];
}

/**
 * The barrel shifter's stages for a shift by `amount` (0 … n − 1). Stage j moves every bit by 2^j places when bit j of
 * `amount` is 1 and passes the word through when it is 0, filling from `fill` (0 for logical shifts, the sign bit for
 * an arithmetic right shift) or wrapping round (rotate).
 */
export function stages(x: number, amount: number, mode: ShiftMode, n = 8): Stage[] {
  const out: Stage[] = [];
  let cur = toBits(x, n);
  const sign = cur[0]!;
  const fill = mode === 'asr' ? sign : 0;
  for (let j = 0; 2 ** j < n; j++) {
    const by = 2 ** j;
    const enabled = ((amount >> j) & 1) === 1;
    if (enabled) {
      const prev = cur;
      cur = prev.map((_, i) => {
        // Position i counts from the left. Left shift: bit i takes the value i + by places to its right.
        if (mode === 'lsl' || mode === 'rol') {
          const s = i + by;
          return s < n ? prev[s]! : mode === 'rol' ? prev[s - n]! : 0;
        }
        const s = i - by;
        return s >= 0 ? prev[s]! : fill;
      });
    }
    out.push({ by, enabled, bits: cur });
  }
  return out;
}
