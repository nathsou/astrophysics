/**
 * Intervals of integers (chapter 26): [lo, hi] with either end possibly infinite (null). The empty interval is
 * represented separately (BOT). Arithmetic is sound: the result contains every value the operation can produce
 * from values in the arguments. Division truncates towards zero, as in Vouch.
 */
export type Bound = bigint | null;
export interface Itv {
  lo: Bound; // null = −∞
  hi: Bound; // null = +∞
}
export const BOT = 'bot' as const;
export type IntervalV = Itv | typeof BOT;

export const TOP: Itv = { lo: null, hi: null };
export const itv = (lo: Bound, hi: Bound): IntervalV => (lo !== null && hi !== null && lo > hi ? BOT : { lo, hi });
export const constant = (n: bigint): Itv => ({ lo: n, hi: n });

const minB = (a: Bound, b: Bound, lowSide: boolean): Bound => (a === null || b === null ? (lowSide ? null : null) : a < b ? a : b);
const maxB = (a: Bound, b: Bound): Bound => (a === null || b === null ? null : a > b ? a : b);

export function join(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT) return b;
  if (b === BOT) return a;
  return { lo: minB(a.lo, b.lo, true), hi: maxB(a.hi, b.hi) };
}

export function meet(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  const lo = a.lo === null ? b.lo : b.lo === null ? a.lo : a.lo > b.lo ? a.lo : b.lo;
  const hi = a.hi === null ? b.hi : b.hi === null ? a.hi : a.hi < b.hi ? a.hi : b.hi;
  return itv(lo, hi);
}

export function leq(a: IntervalV, b: IntervalV): boolean {
  if (a === BOT) return true;
  if (b === BOT) return false;
  const loOk = b.lo === null || (a.lo !== null && a.lo >= b.lo);
  const hiOk = b.hi === null || (a.hi !== null && a.hi <= b.hi);
  return loOk && hiOk;
}

export const eq = (a: IntervalV, b: IntervalV) => leq(a, b) && leq(b, a);

/** Widening: a bound that grew jumps to infinity, so that increasing chains stop. */
export function widen(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT) return b;
  if (b === BOT) return a;
  const lo = b.lo === null || (a.lo !== null && b.lo < a.lo) ? null : a.lo;
  const hi = b.hi === null || (a.hi !== null && b.hi > a.hi) ? null : a.hi;
  return { lo, hi };
}

/** Narrowing: an infinite bound may be replaced by the finite one the next iteration computes. */
export function narrow(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  return itv(a.lo === null ? b.lo : a.lo, a.hi === null ? b.hi : a.hi);
}

const addB = (a: Bound, b: Bound): Bound => (a === null || b === null ? null : a + b);

export function add(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  return { lo: addB(a.lo, b.lo), hi: addB(a.hi, b.hi) };
}
export function neg(a: IntervalV): IntervalV {
  if (a === BOT) return BOT;
  return { lo: a.hi === null ? null : -a.hi, hi: a.lo === null ? null : -a.lo };
}
export const sub = (a: IntervalV, b: IntervalV) => add(a, neg(b));

/** Products of bounds, with ±∞ (sign-aware). */
function mulB(a: Bound, aInf: -1 | 1, b: Bound, bInf: -1 | 1): { v: bigint } | { inf: -1 | 1 } | { zero: true } {
  if (a === 0n || b === 0n) return { zero: true };
  if (a === null || b === null) {
    const sa = a === null ? aInf : a > 0n ? 1 : -1;
    const sb = b === null ? bInf : b > 0n ? 1 : -1;
    return { inf: (sa * sb) as -1 | 1 };
  }
  return { v: a * b };
}

export function mul(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  const corners = [mulB(a.lo, -1, b.lo, -1), mulB(a.lo, -1, b.hi, 1), mulB(a.hi, 1, b.lo, -1), mulB(a.hi, 1, b.hi, 1)];
  let lo: Bound | undefined;
  let hi: Bound | undefined;
  let loInf = false;
  let hiInf = false;
  for (const c of corners) {
    const val = 'zero' in c ? 0n : 'v' in c ? c.v : undefined;
    if (val === undefined) {
      if ('inf' in c && c.inf < 0) loInf = true;
      else hiInf = true;
      continue;
    }
    lo = lo === undefined || (lo !== null && val < lo) ? val : lo;
    hi = hi === undefined || (hi !== null && val > hi) ? val : hi;
  }
  return { lo: loInf ? null : (lo ?? null), hi: hiInf ? null : (hi ?? null) };
}

const tdiv = (a: bigint, b: bigint) => a / b; // BigInt division truncates towards zero

/** Truncating division; the divisor's zero is excluded (division by zero is an alarm, not a value). */
export function div(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  let out: IntervalV = BOT;
  for (const d of [meet(b, { lo: 1n, hi: null }), meet(b, { lo: null, hi: -1n })]) {
    if (d === BOT) continue;
    const dsign = d.lo !== null && d.lo > 0n ? 1 : -1;
    // For a divisor of fixed sign, the extremes are at the corners. An infinite dividend gives an infinite
    // quotient (with the right sign); an infinite divisor gives 0.
    const vals: (bigint | 'neg' | 'pos')[] = [];
    const xs: [Bound, -1 | 1][] = [[a.lo, -1], [a.hi, 1]];
    for (const [x, xside] of xs)
      for (const y of [d.lo, d.hi]) {
        if (x === null) vals.push(xside * dsign < 0 ? 'neg' : 'pos');
        else if (y === null) vals.push(0n);
        else vals.push(tdiv(x, y));
      }
    const finite = vals.filter((v): v is bigint => typeof v === 'bigint');
    const lo = vals.includes('neg') ? null : finite.reduce((m, v) => (v < m ? v : m));
    const hi = vals.includes('pos') ? null : finite.reduce((m, v) => (v > m ? v : m));
    // Truncation moves results towards zero, so 0 lies between results of opposite signs: the corners cover it.
    out = join(out, { lo, hi });
  }
  return out;
}

/** Remainder: its sign follows the dividend, and its magnitude is below the divisor's. */
export function mod(a: IntervalV, b: IntervalV): IntervalV {
  if (a === BOT || b === BOT) return BOT;
  const mag = join(meet(b, { lo: 1n, hi: null }), neg(meet(b, { lo: null, hi: -1n })));
  if (mag === BOT) return BOT;
  const m: Bound = mag.hi === null ? null : mag.hi - 1n;
  const lo: Bound = a.lo !== null && a.lo >= 0n ? 0n : a.lo === null ? (m === null ? null : -m) : m === null ? a.lo : a.lo > -m ? a.lo : -m;
  const hi: Bound = a.hi !== null && a.hi <= 0n ? 0n : a.hi === null ? m : m === null ? a.hi : a.hi < m ? a.hi : m;
  return itv(lo, hi);
}

export const contains = (a: IntervalV, n: bigint) => a !== BOT && (a.lo === null || a.lo <= n) && (a.hi === null || n <= a.hi);

export function show(a: IntervalV): string {
  if (a === BOT) return '⊥';
  if (a.lo !== null && a.hi !== null && a.lo === a.hi) return String(a.lo);
  return `[${a.lo === null ? '−∞' : String(a.lo)}, ${a.hi === null ? '+∞' : String(a.hi)}]`;
}
