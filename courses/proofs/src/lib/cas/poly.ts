/**
 * Multivariate polynomials over ℚ in named atoms, and rational functions as num/den pairs.
 * Atoms are opaque keys (a symbol, or a canonicalised non-polynomial subterm such as 2^n).
 */
import { Rat } from './rational';

/** atom key → positive exponent */
export type Mono = Map<string, number>;
export interface Term {
  mono: Mono;
  c: Rat;
}
/** monomial key → term */
export type Poly = Map<string, Term>;

export interface RF {
  num: Poly;
  den: Poly;
}

export function monoKey(m: Mono): string {
  return [...m.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, e]) => (e === 1 ? k : `${k}^${e}`))
    .join('*');
}

export function constPoly(c: Rat): Poly {
  const p: Poly = new Map();
  if (!c.isZero()) p.set('', { mono: new Map(), c });
  return p;
}

export function atomPoly(key: string, e = 1): Poly {
  const mono: Mono = new Map([[key, e]]);
  return new Map([[monoKey(mono), { mono, c: Rat.ONE }]]);
}

export function addTerm(p: Poly, mono: Mono, c: Rat): void {
  if (c.isZero()) return;
  const k = monoKey(mono);
  const t = p.get(k);
  if (!t) p.set(k, { mono, c });
  else {
    const s = t.c.add(c);
    if (s.isZero()) p.delete(k);
    else p.set(k, { mono: t.mono, c: s });
  }
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const out: Poly = new Map(a);
  for (const t of b.values()) addTerm(out, t.mono, t.c);
  return out;
}

export function polyScale(a: Poly, c: Rat): Poly {
  const out: Poly = new Map();
  if (c.isZero()) return out;
  for (const [k, t] of a) out.set(k, { mono: t.mono, c: t.c.mul(c) });
  return out;
}

export function polyNeg(a: Poly): Poly {
  return polyScale(a, Rat.MINUS_ONE);
}

export function monoMul(a: Mono, b: Mono): Mono {
  const m: Mono = new Map(a);
  for (const [k, e] of b) m.set(k, (m.get(k) ?? 0) + e);
  return m;
}

export function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const x of a.values()) for (const y of b.values()) addTerm(out, monoMul(x.mono, y.mono), x.c.mul(y.c));
  return out;
}

export function polyPow(a: Poly, k: number): Poly {
  let r = constPoly(Rat.ONE);
  let base = a;
  while (k > 0) {
    if (k & 1) r = polyMul(r, base);
    base = polyMul(base, base);
    k >>= 1;
  }
  return r;
}

export const isZeroPoly = (p: Poly) => p.size === 0;

/** The constant value of a polynomial, or null if it involves atoms. */
export function polyConst(p: Poly): Rat | null {
  if (p.size === 0) return Rat.ZERO;
  if (p.size === 1 && p.has('')) return p.get('')!.c;
  return null;
}

export function polyAtoms(p: Poly): Set<string> {
  const s = new Set<string>();
  for (const t of p.values()) for (const k of t.mono.keys()) s.add(k);
  return s;
}

export function polyDegree(p: Poly): number {
  let d = 0;
  for (const t of p.values()) d = Math.max(d, [...t.mono.values()].reduce((a, b) => a + b, 0));
  return d;
}

/** Canonical string, independent of insertion order. */
export function polyKey(p: Poly): string {
  if (p.size === 0) return '0';
  return [...p.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, t]) => `${t.c}${k ? `*${k}` : ''}`)
    .join(' + ');
}

// ── Rational functions ────────────────────────────────────────────────────────

export const rfConst = (c: Rat): RF => ({ num: constPoly(c), den: constPoly(Rat.ONE) });
export const rfPoly = (p: Poly): RF => ({ num: p, den: constPoly(Rat.ONE) });

/** Keep denominators tidy: a constant denominator is folded into the numerator. */
export function rfNormal(r: RF): RF {
  const dc = polyConst(r.den);
  if (dc && !dc.isZero() && !dc.isOne()) return { num: polyScale(r.num, dc.inv()), den: constPoly(Rat.ONE) };
  if (isZeroPoly(r.num)) return rfConst(Rat.ZERO);
  return r;
}

export function rfAdd(a: RF, b: RF): RF {
  if (polyKey(a.den) === polyKey(b.den)) return rfNormal({ num: polyAdd(a.num, b.num), den: a.den });
  return rfNormal({ num: polyAdd(polyMul(a.num, b.den), polyMul(b.num, a.den)), den: polyMul(a.den, b.den) });
}

export function rfMul(a: RF, b: RF): RF {
  return rfNormal({ num: polyMul(a.num, b.num), den: polyMul(a.den, b.den) });
}

export function rfInv(a: RF): RF {
  if (isZeroPoly(a.num)) throw new RangeError('Division by zero');
  return rfNormal({ num: a.den, den: a.num });
}

export function rfPow(a: RF, k: number): RF {
  if (k < 0) return rfPow(rfInv(a), -k);
  return rfNormal({ num: polyPow(a.num, k), den: polyPow(a.den, k) });
}

export function rfNeg(a: RF): RF {
  return { num: polyNeg(a.num), den: a.den };
}

export function rfConstValue(a: RF): Rat | null {
  const n = polyConst(a.num);
  const d = polyConst(a.den);
  return n && d && !d.isZero() ? n.div(d) : null;
}

/** The polynomial, if the denominator is constant. */
export function rfAsPoly(a: RF): Poly | null {
  const d = polyConst(a.den);
  return d ? polyScale(a.num, d.inv()) : null;
}

export function rfKey(a: RF): string {
  const p = rfAsPoly(a);
  if (p) return polyKey(p);
  // Make the denominator's first coefficient 1 so equal fractions usually print equally.
  const first = [...a.den.entries()].sort(([x], [y]) => (x < y ? -1 : 1))[0]!;
  const s = first[1].c.inv();
  return `(${polyKey(polyScale(a.num, s))})/(${polyKey(polyScale(a.den, s))})`;
}
