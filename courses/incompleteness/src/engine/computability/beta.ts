// Gödel's β-function (section "The Beta Function Lemma") and the simulation of primitive
// recursion by regular minimization (section "Simulating Primitive Recursion").
//
//   J(x, y)         = ½[(x + y)(x + y + 1)] + x                  (pairing)
//   K(z), L(z)      = the x and the y with z = J(x, y)
//   rem(x, y)       = the remainder when y is divided by x
//   β*(d₀, d₁, i)   = rem(1 + (i + 1)·d₁, d₀)
//   β(d, i)         = β*(K(d), L(d), i)
//
// To code a₀, …, aₙ the book takes j = max(n, a₀ + 1, …, aₙ + 1), d₁ = lcm(1, …, j); the moduli
// xᵢ = 1 + (i + 1)·d₁ are pairwise relatively prime and xᵢ > aᵢ, so by Sunzi's theorem (the
// Chinese Remainder Theorem) there is d₀ with d₀ ≡ aᵢ mod xᵢ for all i; then d = J(d₀, d₁).
// (Gödel's original proof used j! in place of lcm(1, …, j); both work, since all that matters
// is that every number ≤ j divides d₁. The option `d1Rule: 'factorial'` shows that variant.)

import { evaluate, type RF } from '../recursive/rf.ts';

// ------------------------------------------------------------------ arithmetic helpers

export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a / gcd(a, b)) * b;
}

/** lcm(1, …, j) (= 1 for j = 0). */
export function lcmUpTo(j: bigint): bigint {
  let m = 1n;
  for (let k = 2n; k <= j; k++) m = lcm(m, k);
  return m;
}

export function factorial(j: bigint): bigint {
  let m = 1n;
  for (let k = 2n; k <= j; k++) m *= k;
  return m;
}

/** ⌊√n⌋ for n ≥ 0. */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('square root of a negative number');
  if (n < 2n) return n;
  // Newton's method from a power of two above √n; the iterates decrease to ⌊√n⌋.
  let x = 1n << BigInt((n.toString(2).length >> 1) + 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** The inverse of a modulo m (a and m relatively prime, m ≥ 1). */
export function modInverse(a: bigint, m: bigint): bigint {
  if (m === 1n) return 0n;
  let [r0, r1] = [((a % m) + m) % m, m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new RangeError(`${a} has no inverse modulo ${m}`);
  return ((s0 % m) + m) % m;
}

// ------------------------------------------------------------------ pairing and β

/** The book's pairing function J(x, y) = ½[(x + y)(x + y + 1)] + x. */
export function J(x: bigint, y: bigint): bigint {
  return ((x + y) * (x + y + 1n)) / 2n + x;
}

/**
 * K(z) and L(z): the unique x, y with J(x, y) = z. (The book defines them by bounded
 * minimization, K(z) = μx ≤ z ∃y ≤ z (z = J(x, y)); this computes the same numbers directly.)
 */
export function unpair(z: bigint): { x: bigint; y: bigint } {
  if (z < 0n) throw new RangeError('J is defined on natural numbers');
  const w = (isqrt(8n * z + 1n) - 1n) / 2n; // w = x + y
  const x = z - (w * (w + 1n)) / 2n;
  return { x, y: w - x };
}

export const K = (z: bigint): bigint => unpair(z).x;
export const L = (z: bigint): bigint => unpair(z).y;

/** rem(x, y): the remainder when y is divided by x (by convention rem(0, y) = y). */
export function rem(x: bigint, y: bigint): bigint {
  return x === 0n ? y : y % x;
}

export function betaStar(d0: bigint, d1: bigint, i: bigint): bigint {
  return rem(1n + (i + 1n) * d1, d0);
}

export function beta(d: bigint, i: bigint | number): bigint {
  const { x: d0, y: d1 } = unpair(d);
  return betaStar(d0, d1, BigInt(i));
}

export interface BetaDecodeStep {
  d: bigint;
  i: bigint;
  d0: bigint;
  d1: bigint;
  /** 1 + (i + 1)·d₁ */
  modulus: bigint;
  /** rem(modulus, d₀) = β(d, i) */
  value: bigint;
}

/** β(d, i), showing the intermediate numbers K(d), L(d) and the modulus. */
export function betaTrace(d: bigint, i: bigint | number): BetaDecodeStep {
  const { x: d0, y: d1 } = unpair(d);
  const ib = BigInt(i);
  const modulus = 1n + (ib + 1n) * d1;
  return { d, i: ib, d0, d1, modulus, value: rem(modulus, d0) };
}

// ------------------------------------------------------------------ encoding (the proof of the lemma)

export interface CrtStep {
  i: number;
  /** xᵢ */
  modulus: bigint;
  /** aᵢ */
  target: bigint;
  /** the solution so far: s ≡ a₀, …, aᵢ₋₁ modulo M = x₀ · … · xᵢ₋₁ */
  before: { s: bigint; M: bigint };
  /** s + t·M ≡ aᵢ (mod xᵢ) */
  t: bigint;
  after: { s: bigint; M: bigint };
}

export interface BetaEncoding {
  seq: bigint[];
  /** the sequence is a₀, …, aₙ */
  n: number;
  /** j = max(n, a₀ + 1, …, aₙ + 1) */
  j: bigint;
  d1Rule: 'lcm' | 'factorial';
  /** lcm(1, …, j) (or j!) */
  d1: bigint;
  /** xᵢ = 1 + (i + 1)·d₁ */
  moduli: bigint[];
  /** gcd of every pair of moduli (all 1: pairwise relatively prime) */
  pairs: { i: number; k: number; gcd: bigint }[];
  pairwiseCoprime: boolean;
  /** aᵢ < xᵢ for each i */
  bounds: { i: number; a: bigint; x: bigint; ok: boolean }[];
  crt: CrtStep[];
  /** the least d₀ with d₀ ≡ aᵢ mod xᵢ for all i */
  d0: bigint;
  /** d = J(d₀, d₁) */
  d: bigint;
  /** β(d, i) for each i, compared with aᵢ */
  checks: (BetaDecodeStep & { expected: bigint; ok: boolean })[];
  ok: boolean;
  /** the construction, step by step, in words */
  explanation: string[];
}

export interface EncodeOptions {
  /** 'lcm' (the book, default) or 'factorial' (Gödel's original choice j!). */
  d1Rule?: 'lcm' | 'factorial';
}

/** Finds a β-code d for a₀, …, aₙ by the construction in the proof of the β-function lemma. */
export function encodeWithBeta(seqIn: readonly (bigint | number)[], opt: EncodeOptions = {}): BetaEncoding {
  const seq = seqIn.map((a) => BigInt(a));
  if (seq.length === 0) throw new RangeError('the lemma codes nonempty sequences a₀, …, aₙ');
  if (seq.some((a) => a < 0n)) throw new RangeError('β codes sequences of natural numbers');
  const n = seq.length - 1;
  const d1Rule = opt.d1Rule ?? 'lcm';
  let j = BigInt(n);
  for (const a of seq) if (a + 1n > j) j = a + 1n;
  const d1 = d1Rule === 'lcm' ? lcmUpTo(j) : factorial(j);
  const moduli = seq.map((_, i) => 1n + BigInt(i + 1) * d1);

  const pairs: BetaEncoding['pairs'] = [];
  for (let i = 0; i < moduli.length; i++) for (let k = i + 1; k < moduli.length; k++) pairs.push({ i, k, gcd: gcd(moduli[i], moduli[k]) });
  const pairwiseCoprime = pairs.every((p) => p.gcd === 1n);
  const bounds = seq.map((a, i) => ({ i, a, x: moduli[i], ok: a < moduli[i] }));

  // Sunzi's theorem, constructively: extend a solution one congruence at a time.
  const crt: CrtStep[] = [];
  let s = 0n;
  let M = 1n;
  seq.forEach((a, i) => {
    const x = moduli[i];
    const t = ((((a - s) % x) + x) % x) * modInverse(M % x, x) % x;
    const next = { s: s + t * M, M: M * x };
    crt.push({ i, modulus: x, target: a, before: { s, M }, t, after: next });
    s = next.s;
    M = next.M;
  });
  const d0 = s;
  const d = J(d0, d1);
  const checks = seq.map((a, i) => {
    const step = betaTrace(d, i);
    return { ...step, expected: a, ok: step.value === a };
  });

  const d1Name = d1Rule === 'lcm' ? `lcm(1, …, ${j})` : `${j}!`;
  const explanation = [
    `The sequence has n + 1 = ${seq.length} element${seq.length === 1 ? '' : 's'}; j = max(n, a₀ + 1, …, aₙ + 1) = ${j}.`,
    `d₁ = ${d1Name} = ${d1}.`,
    `Moduli xᵢ = 1 + (i + 1)·d₁: ${moduli.join(', ')}.`,
    pairs.length === 0
      ? 'There is only one modulus, so pairwise relative primality is trivial.'
      : pairwiseCoprime
        ? `All ${pairs.length} pair${pairs.length === 1 ? ' has' : 's have'} greatest common divisor 1: the moduli are pairwise relatively prime.`
        : `Some pair of moduli has a common divisor: ${pairs.filter((p) => p.gcd !== 1n).map((p) => `gcd(x${p.i}, x${p.k}) = ${p.gcd}`).join(', ')}.`,
    `Each aᵢ < j ≤ d₁ < xᵢ, so aᵢ is its own remainder modulo xᵢ.`,
    `By Sunzi's theorem, d₀ = ${d0} satisfies d₀ ≡ aᵢ (mod xᵢ) for every i (the least such number, below ${M}).`,
    `d = J(d₀, d₁) = ${d}.`,
    `Check: β(d, i) = rem(1 + (i + 1)·L(d), K(d)) gives ${checks.map((c) => c.value).join(', ')}${checks.every((c) => c.ok) ? ', the sequence' : ', which is NOT the sequence'}.`,
  ];
  return {
    seq,
    n,
    j,
    d1Rule,
    d1,
    moduli,
    pairs,
    pairwiseCoprime,
    bounds,
    crt,
    d0,
    d,
    checks,
    ok: pairwiseCoprime && bounds.every((b) => b.ok) && checks.every((c) => c.ok),
    explanation,
  };
}

/** Does d code a₀, …, aₙ, i.e., β(d, i) = aᵢ for all i ≤ n? */
export function betaCodes(d: bigint, seq: readonly (bigint | number)[]): boolean {
  const { x: d0, y: d1 } = unpair(d);
  return seq.every((a, i) => betaStar(d0, d1, BigInt(i)) === BigInt(a));
}

/**
 * The least d with β(d, i) = aᵢ for all i ≤ n, searching d = 0, 1, 2, … below `limit`. The
 * minimization in the book returns exactly this number; the construction above gives some
 * code, usually far from the least. `found: false` only means none exists below the limit.
 */
export function leastBetaCode(seq: readonly (bigint | number)[], limit: bigint = 1_000_000n): { found: true; d: bigint } | { found: false; searchedBelow: bigint } {
  for (let d = 0n; d < limit; d++) if (betaCodes(d, seq)) return { found: true, d };
  return { found: false, searchedBelow: limit };
}

// ------------------------------------------------------------------ primitive recursion via β

export interface PrimRecCondition {
  i: number;
  /** β(d, i + 1) */
  next: bigint;
  /** g(x⃗, i, β(d, i)) */
  step: bigint;
  ok: boolean;
}

export type PrimRecViaBeta =
  | {
      ok: true;
      /** the parameters x⃗ and the recursion argument y */
      xs: bigint[];
      y: bigint;
      f: RF;
      g: RF;
      /** h(x⃗, 0), …, h(x⃗, y), computed by the recursion equations */
      values: bigint[];
      /** the β-code of the values, found by the construction of the lemma */
      encoding: BetaEncoding;
      d: bigint;
      /** β(d, 0) = f(x⃗) */
      base: { beta0: bigint; f: bigint; ok: boolean };
      /** for each i < y: β(d, i + 1) = g(x⃗, i, β(d, i)) */
      conditions: PrimRecCondition[];
      /** h(x⃗, y) = β(ĥ(x⃗, y), y), read off with the witness d */
      value: bigint;
      /** ĥ(x⃗, y) itself: the least d satisfying the conditions, if a search was requested and succeeded */
      least?: { found: true; d: bigint } | { found: false; searchedBelow: bigint };
      /** all conditions hold and β(d, y) is the value */
      verified: boolean;
    }
  | { ok: false; reason: string };

export interface PrimRecViaBetaOptions {
  /** fuel for each evaluation of f and g */
  fuel?: number;
  /** also search for the least code ĥ(x⃗, y) below this bound */
  searchLeastBelow?: bigint;
  /** largest y accepted (the code has y + 1 elements) */
  maxY?: number;
  d1Rule?: 'lcm' | 'factorial';
}

/** The f and g of a definition by primitive recursion (looking through named definitions). */
export function recParts(h: RF): { f: RF; g: RF } | null {
  let t = h;
  while (t.k === 'def') t = t.body;
  return t.k === 'rec' ? { f: t.f, g: t.g } : null;
}

/**
 * Lemma "Simulating Primitive Recursion": for h = Rec(f, g),
 *   ĥ(x⃗, y) = μd (β(d, 0) = f(x⃗) ∧ ∀i < y β(d, i + 1) = g(x⃗, i, β(d, i))),   h(x⃗, y) = β(ĥ(x⃗, y), y).
 * `args` are x⃗ followed by y. Computes the values h(x⃗, 0..y), a code d for them, and checks the
 * conditions that the minimization tests.
 */
export function primRecViaBeta(h: RF, args: readonly bigint[], opt: PrimRecViaBetaOptions = {}): PrimRecViaBeta {
  const parts = recParts(h);
  if (!parts) return { ok: false, reason: 'the function is not defined by primitive recursion' };
  if (args.length < 2) return { ok: false, reason: 'h(x⃗, y) needs at least one parameter x and the recursion argument y' };
  const xs = args.slice(0, -1);
  const y = args[args.length - 1];
  const maxY = opt.maxY ?? 64;
  if (y > BigInt(maxY)) return { ok: false, reason: `y = ${y} is too large to show here (at most ${maxY})` };
  const fuel = opt.fuel ?? 200_000;
  const run = (fn: RF, as: bigint[]): bigint | null => {
    const r = evaluate(fn, as, { fuel, maxTraceDepth: -1 });
    return r.status === 'ok' && r.value !== undefined ? r.value : null;
  };
  const f0 = run(parts.f, xs);
  if (f0 === null) return { ok: false, reason: 'evaluating f ran out of fuel' };
  const values = [f0];
  for (let i = 0n; i < y; i++) {
    const v = run(parts.g, [...xs, i, values[values.length - 1]]);
    if (v === null) return { ok: false, reason: `evaluating g(x⃗, ${i}, …) ran out of fuel` };
    values.push(v);
  }
  const encoding = encodeWithBeta(values, { d1Rule: opt.d1Rule });
  const d = encoding.d;
  const b0 = beta(d, 0);
  const base = { beta0: b0, f: f0, ok: b0 === f0 };
  const conditions: PrimRecCondition[] = [];
  for (let i = 0; i < Number(y); i++) {
    const next = beta(d, i + 1);
    const step = run(parts.g, [...xs, BigInt(i), beta(d, i)]);
    if (step === null) return { ok: false, reason: `evaluating g(x⃗, ${i}, β(d, ${i})) ran out of fuel` };
    conditions.push({ i, next, step, ok: next === step });
  }
  const value = beta(d, y);
  const least = opt.searchLeastBelow !== undefined ? leastBetaCode(values, opt.searchLeastBelow) : undefined;
  return {
    ok: true,
    xs,
    y,
    f: parts.f,
    g: parts.g,
    values,
    encoding,
    d,
    base,
    conditions,
    value,
    least,
    verified: base.ok && conditions.every((c) => c.ok) && value === values[values.length - 1],
  };
}
