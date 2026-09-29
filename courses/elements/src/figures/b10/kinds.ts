// The twelve irrationals of Book X (X.36–41 and X.73–78) and the six binomials (Definitions II),
// with exact classification in the ring of ring.ts. The rational line set out is ρ = 1.
//
// A binomial x + y has terms with rational squares X = x², Y = y² (X > Y, X : Y not a ratio of
// squares). Its order (Definitions II) depends on whether √(X − Y) is commensurable with x, and on
// which term, if any, is commensurable with ρ.
//
// The six additive irrationals are the sides of the rectangles ρ · (binomial of order k),
// k = 1…6 (X.54–59). Following Euclid's construction, the side of ρ·(x + y) splits into two parts
// with squares u = (x + s)/2 and w = (x − s)/2, where s = √(X − Y), and rectangle u·w = (y/2)².
// So every additive irrational here is built exactly as Euclid builds it, and the six subtractive
// irrationals (X.73–78) are the differences of the same two parts.

import type { G } from '../../geometry/figure';
import { area, line, need, isSquareInt, Rat, Surd } from './ring';

export const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

export const ADDITIVE = ['', 'binomial', 'first bimedial', 'second bimedial', 'major', 'side of a rational plus a medial area', 'side of the sum of two medial areas'];
export const SUBTRACTIVE = [
  '',
  'apotome',
  'first apotome of a medial',
  'second apotome of a medial',
  'minor',
  'that which produces with a rational area a medial whole',
  'that which produces with a medial area a medial whole',
];

/** The squares of the terms of a binomial: X (greater) and Y (lesser). */
export interface Binomial {
  X: Rat;
  Y: Rat;
}

/**
 * Sliders for a binomial of the given order, with the hypotheses enforced (a slider value that
 * breaks them is refused). `pre` prefixes the slider names, so that a figure can have two.
 */
export function binomialSliders(g: G, order: number, pre = ''): Binomial {
  const P = (n: string, value: number, min: number, max: number, label?: string) => g.param(pre + n, value, { min, max, label: label ?? pre + n });
  let X: Rat;
  let Y: Rat;
  if (order === 1 || order === 2 || order === 3) {
    // X : (X − Y) = p² : q², so √(X − Y) is commensurable with x
    const k = order === 3 ? P('k', 2, 2, 7) : 1;
    const p = P('p', 3, 2, 5);
    const q = P('q', 2, 1, 4);
    need(q < p, 'q < p');
    need(!isSquareInt(p * p - q * q), 'p² − q² is not a square');
    if (order === 3) need(!isSquareInt(k), 'k is not a square');
    if (order === 1) {
      X = new Rat(p * p);
      Y = new Rat(p * p - q * q);
    } else if (order === 2) {
      X = new Rat(p * p, p * p - q * q);
      Y = new Rat(1);
    } else {
      need(!isSquareInt(k * (p * p - q * q)), 'k(p² − q²) is not a square');
      X = new Rat(k);
      Y = new Rat(k * (p * p - q * q), p * p);
    }
  } else if (order === 4) {
    const p = P('p', 3, 2, 4);
    const r = P('r', 7, 2, 15);
    need(r < p * p && !isSquareInt(r) && !isSquareInt(p * p - r), 'r < p², r and p² − r not squares');
    X = new Rat(p * p);
    Y = new Rat(r);
  } else if (order === 5) {
    const q = P('q', 1, 1, 3);
    const a = P('a', 3, 2, 15);
    need(a > q * q && !isSquareInt(a) && !isSquareInt(a * (a - q * q)), 'a > q², a and a(a − q²) not squares');
    X = new Rat(a);
    Y = new Rat(q * q);
  } else {
    const a = P('a', 5, 3, 15);
    const b = P('b', 2, 2, 14);
    need(a > b && !isSquareInt(a) && !isSquareInt(b) && !isSquareInt(a * b) && !isSquareInt(a * (a - b)), 'a > b; a, b, ab, a(a − b) not squares');
    X = new Rat(a);
    Y = new Rat(b);
  }
  return { X, Y };
}

/** The formula of the binomial chosen by binomialSliders, for captions. */
export const BINOMIAL_FORMULA = [
  '',
  'p + √(p² − q²)',
  'p/√(p² − q²) + 1',
  '√k + √(k(p² − q²))/p',
  'p + √r',
  '√a + q',
  '√a + √b',
];

/** The order (1–6) of the binomial with squared terms X > Y, or 0 if it is not a binomial. */
export function binomialOrder(X: Surd, Y: Surd): number {
  if (!line.rational(X) || !line.rational(Y) || !line.commSqOnly(X, Y) || !(X.value > Y.value)) return 0;
  const d = X.sub(Y);
  const comm = line.comm(d, X);
  const big = line.comm(X, Surd.rat(1));
  const small = line.comm(Y, Surd.rat(1));
  if (comm) return big ? 1 : small ? 2 : 3;
  return big ? 4 : small ? 5 : 6;
}

/** Two lines (by their squares u ≥ w) and the rectangle they contain. */
export interface Parts {
  u: Surd;
  w: Surd;
  P: Surd;
}

/**
 * Euclid's split of the side of ρ·(x + y) (X.54–59): the parts have squares (x ± √(X − Y))/2 and
 * contain the rectangle y/2.
 */
export function sideParts(b: Binomial): Parts & { x: Surd; y: Surd; s: Surd } {
  const x = Surd.root(b.X);
  const y = Surd.root(b.Y);
  const s = Surd.root(b.X.sub(b.Y));
  const u = x.add(s).scale(new Rat(1, 2));
  const w = x.sub(s).scale(new Rat(1, 2));
  const P = y.scale(new Rat(1, 2));
  return { u, w, P, x, y, s };
}

/**
 * Sliders for the two parts of an additive irrational of the given kind (1–6), or equally of the
 * whole and annex of a subtractive one. Kind 1 (binomial, apotome) has the squares a > b of its
 * terms as sliders; kinds 2–6 come from a binomial of the same order by X.55–59.
 */
export function partsSliders(g: G, kind: number, pre = ''): Parts {
  if (kind === 1) {
    const a = g.param(pre + 'a', 5, { min: 2, max: 12, label: pre + 'a' });
    const b = g.param(pre + 'b', 2, { min: 1, max: 11, label: pre + 'b' });
    need(a > b && !isSquareInt(a * b), 'a > b and ab not a square');
    return { u: Surd.rat(a), w: Surd.rat(b), P: Surd.root(a * b) };
  }
  const { u, w, P } = sideParts(binomialSliders(g, kind, pre));
  return { u, w, P };
}

/** What the sliders of partsSliders mean, for captions. */
export function partsFormula(kind: number, parts: [string, string]): string {
  if (kind === 1) return `${parts[0]}² = a and ${parts[1]}² = b (integers, ab not a square)`;
  return `${parts[0]} and ${parts[1]} are the parts Euclid finds in X.${53 + kind} for the ${ORDINAL[kind]} binomial ${BINOMIAL_FORMULA[kind]}`;
}

/**
 * The kind (1–6) of a pair of lines with squares u > w containing the rectangle P, as in X.36–41
 * (for their sum) and X.73–78 (for their difference); 0 if none.
 */
export function pairKind({ u, w, P }: Parts): number {
  if (!P.mul(P).eq(u.mul(w))) throw new Error('P² ≠ u·w');
  const S = u.add(w);
  if (line.commSqOnly(u, w)) {
    if (line.rational(u) && line.rational(w)) return 1;
    if (line.medial(u) && line.medial(w)) {
      if (area.rational(P)) return 2;
      if (area.medial(P)) return 3;
    }
    return 0;
  }
  if (!line.incommSq(u, w)) return 0;
  if (area.rational(S) && area.medial(P)) return 4;
  if (area.medial(S) && area.rational(P)) return 5;
  if (area.medial(S) && area.medial(P) && !area.comm(S, P)) return 6;
  return 0;
}

/** √ of a positive float, refusing negatives. */
export const sq = (x: number) => Math.sqrt(Math.max(0, x));

/** The default binomial of each order chosen by binomialSliders (for figures that pick an order). */
export function binomialPreset(order: number): Binomial {
  const t: [number, number, number, number][] = [
    [0, 1, 0, 1],
    [9, 1, 5, 1],
    [9, 5, 1, 1],
    [2, 1, 10, 9],
    [9, 1, 7, 1],
    [3, 1, 1, 1],
    [5, 1, 2, 1],
  ];
  const [a, b, c, d] = t[order];
  return { X: new Rat(a, b), Y: new Rat(c, d) };
}

/** The hypothesis on the two parts of an irrational of the given kind, in words and checked exactly. */
export function kindHypothesis(kind: number, [a, b]: [string, string], { u, w, P }: Parts): [string, boolean] {
  const S = u.add(w);
  const sq2 = `${a}² + ${b}²`;
  const rect = `${a}·${b}`;
  switch (kind) {
    case 1:
      return [`${a}, ${b} rational, commensurable in square only`, line.rational(u) && line.rational(w) && line.commSqOnly(u, w)];
    case 2:
      return [`${a}, ${b} medial, commensurable in square only; ${rect} rational`, line.medial(u) && line.medial(w) && line.commSqOnly(u, w) && area.rational(P)];
    case 3:
      return [`${a}, ${b} medial, commensurable in square only; ${rect} medial`, line.medial(u) && line.medial(w) && line.commSqOnly(u, w) && area.medial(P)];
    case 4:
      return [`${a}, ${b} incommensurable in square; ${sq2} rational; ${rect} medial`, line.incommSq(u, w) && area.rational(S) && area.medial(P)];
    case 5:
      return [`${a}, ${b} incommensurable in square; ${sq2} medial; ${rect} rational`, line.incommSq(u, w) && area.medial(S) && area.rational(P)];
    default:
      return [`${a}, ${b} incommensurable in square; ${sq2} and ${rect} medial, incommensurable`, line.incommSq(u, w) && area.medial(S) && area.medial(P) && !area.comm(S, P)];
  }
}
