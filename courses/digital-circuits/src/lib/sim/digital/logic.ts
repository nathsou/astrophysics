/**
 * Four-valued logic helpers shared by the digital models. Values: 0, 1, 2 (X), 3 (Z).
 * Inputs reading Z see an unknown value (a floating CMOS input), so every helper treats Z like X.
 */

export const X = 2;
export const Z = 3;

/** An input as a gate sees it: Z reads as X. */
export const input = (v: number): number => (v > 1 ? X : v);

/** A control input (enable, clear, load) that reads `dflt` when nothing drives it (Z), X when unknown. */
export const control = (v: number, dflt: number): number => (v === Z ? dflt : v);

export const not4 = (v: number): number => (v === 0 ? 1 : v === 1 ? 0 : X);
export const and4 = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : X);
export const or4 = (a: number, b: number): number => (a === 1 || b === 1 ? 1 : a === 0 && b === 0 ? 0 : X);
export const xor4 = (a: number, b: number): number => (a > 1 || b > 1 ? X : a ^ b);
/** Majority of three (the carry of a full adder): known as soon as two known inputs agree. */
export function maj4(a: number, b: number, c: number): number {
  let ones = 0;
  let zeros = 0;
  if (a === 1) ones++;
  else if (a === 0) zeros++;
  if (b === 1) ones++;
  else if (b === 0) zeros++;
  if (c === 1) ones++;
  else if (c === 0) zeros++;
  return ones >= 2 ? 1 : zeros >= 2 ? 0 : X;
}

/** Merge two possible values: equal known values stay, anything else is X. */
export const merge = (a: number, b: number): number => (a === b && a <= 1 ? a : X);

/** Parse a power-up parameter: 0, 1, '0', '1' or 'X'. */
export function parseInit(v: unknown, dflt = 0): number {
  if (v === undefined || v === '') return dflt;
  if (v === true) return 1;
  if (v === false) return 0;
  const s = String(v).trim().toUpperCase();
  if (s === 'X') return X;
  if (s === 'Z') return Z;
  const n = Number(s);
  return n === 0 || n === 1 ? n : n === 2 ? X : n === 3 ? Z : dflt;
}

/**
 * Reading buses without allocating: `readBus` fills `bus.value` (the known bits, LSB first) and
 * `bus.unknown` (a mask of bits that are X or Z). Works for up to 32 bits; values are unsigned.
 */
export const bus = { value: 0, unknown: 0 };

export function readBus(nets: Uint8Array, pinNets: Int32Array, start: number, count: number): void {
  let value = 0;
  let unknown = 0;
  for (let i = 0; i < count; i++) {
    const v = nets[pinNets[start + i]!]!;
    const bit = 2 ** i;
    if (v === 1) value += bit;
    else if (v !== 0) unknown += bit;
  }
  bus.value = value;
  bus.unknown = unknown;
}

/** Bit `i` of an unsigned value of up to 32 bits (0 or 1). */
export const bitOf = (value: number, i: number): number => Math.floor(value / 2 ** i) % 2;

/** A mask of `n` ones (n ≤ 32). */
export const ones = (n: number): number => 2 ** n - 1;
