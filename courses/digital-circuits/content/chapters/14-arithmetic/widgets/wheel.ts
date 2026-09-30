/**
 * Number representations for the two's-complement wheel: what an n-bit pattern means as an unsigned number, in
 * sign-magnitude, in ones' complement and in two's complement, and what an addition does to the flags. The patterns
 * run 0 … 2^n − 1 round the wheel, clockwise from the top.
 */
export type Encoding = 'unsigned' | 'sign-magnitude' | 'ones' | 'twos';

export const ENCODINGS: { id: Encoding; label: string }[] = [
  { id: 'unsigned', label: 'Unsigned' },
  { id: 'sign-magnitude', label: 'Sign–magnitude' },
  { id: 'ones', label: 'Ones’ complement' },
  { id: 'twos', label: 'Two’s complement' },
];

export const mask = (n: number): number => 2 ** n - 1;

/** What pattern `v` (0 … 2^n − 1) means. Returns the value and whether it is a "negative zero". */
export function decode(enc: Encoding, v: number, n: number): { value: number; negZero: boolean } {
  const m = mask(n);
  const top = 2 ** (n - 1);
  v &= m;
  switch (enc) {
    case 'unsigned':
      return { value: v, negZero: false };
    case 'sign-magnitude':
      return v >= top ? { value: v === top ? 0 : -(v - top), negZero: v === top } : { value: v, negZero: false };
    case 'ones':
      return v >= top ? { value: v === m ? 0 : -(m - v), negZero: v === m } : { value: v, negZero: false };
    case 'twos':
      return { value: v >= top ? v - 2 ** n : v, negZero: false };
  }
}

/** The value as text, with a real minus sign, and "−0" where it exists. */
export function label(enc: Encoding, v: number, n: number): string {
  const d = decode(enc, v, n);
  if (d.negZero) return '−0';
  return d.value < 0 ? `−${-d.value}` : `${d.value}`;
}

/** Smallest and largest value of an encoding. */
export function range(enc: Encoding, n: number): [number, number] {
  const top = 2 ** (n - 1);
  switch (enc) {
    case 'unsigned':
      return [0, 2 ** n - 1];
    case 'twos':
      return [-top, top - 1];
    default:
      return [-(top - 1), top - 1];
  }
}

/** How many different patterns mean zero. */
export const zeros = (enc: Encoding, n: number): number => Array.from({ length: 2 ** n }, (_, v) => v).filter((v) => decode(enc, v, n).value === 0).length;

/** −x in two's complement: invert every bit and add one. */
export const negate = (x: number, n: number): number => (~x + 1) & mask(n);

export interface Sum {
  /** The n-bit result. */
  result: number;
  /** Carry out of the top bit: the unsigned result does not fit. */
  carry: boolean;
  /** Signed overflow (V): the two's complement result does not fit. */
  overflow: boolean;
  /** The top bit of the result (N). */
  negative: boolean;
  zero: boolean;
  /** V computed the way hardware does: the carry into the top bit XOR the carry out of it. */
  carryIntoTop: boolean;
}

/** a + b + cin in n bits, with the flags of a processor. */
export function add(a: number, b: number, n: number, cin = 0): Sum {
  const m = mask(n);
  const top = 2 ** (n - 1);
  a &= m;
  b &= m;
  const raw = a + b + cin;
  const result = raw & m;
  const carry = raw > m;
  // The carry into the top bit is the carry of the sum of the lower bits.
  const low = m >> 1;
  const carryIntoTop = (a & low) + (b & low) + cin > low;
  const overflow = carryIntoTop !== carry;
  return { result, carry, overflow, negative: (result & top) !== 0, zero: result === 0, carryIntoTop };
}

/** a − b as hardware does it: a + ¬b + 1. The carry flag is 1 when there is *no* borrow. */
export const subtract = (a: number, b: number, n: number): Sum => add(a, ~b & mask(n), n, 1);

/** Overflow by the human rule: two operands of the same sign give a result of the other sign. */
export function overflowBySign(a: number, b: number, n: number): boolean {
  const top = 2 ** (n - 1);
  const sa = (a & top) !== 0;
  const sb = (b & top) !== 0;
  const sr = (add(a, b, n).result & top) !== 0;
  return sa === sb && sr !== sa;
}

/** Angle of pattern v round the wheel, in radians clockwise from the top. */
export const angleOf = (v: number, n: number): number => (v / 2 ** n) * 2 * Math.PI;

/** The pattern nearest to a point (x, y) relative to the centre of the wheel (y grows downwards). */
export function patternAt(x: number, y: number, n: number): number {
  let a = Math.atan2(x, -y);
  if (a < 0) a += 2 * Math.PI;
  return Math.round((a / (2 * Math.PI)) * 2 ** n) % 2 ** n;
}

export const bits = (v: number, n: number): string => v.toString(2).padStart(n, '0');
