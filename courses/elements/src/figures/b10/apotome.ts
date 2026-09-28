// Helpers for X.85–115: the apotomes and the six subtractive irrationals.
//
// Everything is measured against a rational line ρ = 1 and checked exactly with the ring of
// ring.ts: a line is given by its square (a Surd), an area by its value.
//
// An apotome (or a binomial) is given by the squares p > q of its two terms: the terms are √p and
// √q, the apotome is √p − √q, the binomial √p + √q. Its order (Deff. II and III) depends only on
// which of p, q are squares and on whether √(p − q) is commensurable with √p.

import type { G } from '../../geometry/figure';
import { Degenerate, v } from '../../geometry/vec';
import { Lines } from './lib';
import { area, line, Rat, Surd } from './ring';

export const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** X.73–78: the six irrational lines formed by subtraction, in Euclid's order. */
export const KIND = [
  'an apotome',
  'a first apotome of a medial straight line',
  'a second apotome of a medial straight line',
  'minor',
  'that which produces with a rational area a medial whole',
  'that which produces with a medial area a medial whole',
];

/** The order (1–6) of the apotome √p − √q (or of the binomial √p + √q); null if it is not one. */
export function order(p: Surd, q: Surd): number | null {
  if (!line.rational(p) || !line.rational(q) || !line.commSqOnly(p, q) || !(p.value > q.value)) return null;
  const one = Surd.rat(1);
  const base = line.comm(p, one) ? 1 : line.comm(q, one) ? 2 : 3;
  return base + (line.comm(p.sub(q), p) ? 0 : 3);
}

/**
 * The kind (1–6, as in KIND) of the line x − y, given x², y² and the rectangle x·y; null if it is
 * none of the six (X.73–78).
 */
export function kind(x2: Surd, y2: Surd, xy: Surd): number | null {
  if (!(x2.value > y2.value)) return null;
  if (line.rational(x2) && line.rational(y2) && line.commSqOnly(x2, y2)) return 1;
  if (line.medial(x2) && line.medial(y2) && line.commSqOnly(x2, y2)) {
    if (area.rational(xy)) return 2;
    if (area.medial(xy)) return 3;
    return null;
  }
  if (line.incommSq(x2, y2)) {
    const s = x2.add(y2);
    const r = xy.scale(2);
    if (area.rational(s) && area.medial(r)) return 4;
    if (area.medial(s) && area.rational(r)) return 5;
    if (area.medial(s) && area.medial(r) && !area.comm(s, r)) return 6;
  }
  return null;
}

/**
 * Examples of the apotome of each order, as the squares [p, q] of its terms (fractions as [n, d]).
 * The same pairs give binomials of the same order.
 */
const EX: [number, number, number, number][][] = [
  [[9, 1, 5, 1], [16, 1, 7, 1], [16, 1, 12, 1]], // 3 − √5, 4 − √7, 4 − 2√3
  [[36, 5, 4, 1], [64, 7, 4, 1], [36, 11, 1, 1]], // 6/√5 − 2, 8/√7 − 2, 6/√11 − 1
  [[16, 3, 7, 3], [8, 1, 7, 2], [9, 2, 5, 2]], // 4/√3 − √(7/3), 2√2 − √(7/2), 3/√2 − √(5/2)
  [[9, 1, 3, 1], [4, 1, 2, 1], [9, 1, 6, 1]], // 3 − √3, 2 − √2, 3 − √6
  [[8, 1, 4, 1], [5, 1, 1, 1], [3, 1, 1, 1]], // 2√2 − 2, √5 − 1, √3 − 1
  [[6, 1, 2, 1], [5, 1, 2, 1], [7, 1, 3, 1]], // √6 − √2, √5 − √2, √7 − √3
];

export const EXAMPLES = EX[0].length;

export interface Pair {
  p: Rat;
  q: Rat;
}

/** Example `i` (1-based) of the apotome of order `ord` (1–6). */
export function example(ord: number, i: number): Pair {
  const e = EX[ord - 1][Math.max(0, Math.min(EXAMPLES - 1, Math.round(i) - 1))];
  return { p: new Rat(e[0], e[1]), q: new Rat(e[2], e[3]) };
}

/** A line x − y given by x², y² and x·y (all exact), with float lengths. */
export interface Sub {
  x2: Surd;
  y2: Surd;
  xy: Surd;
  x: number;
  y: number;
}

/**
 * X.91–96: the side of the rectangle ρ·(√p − √q). With AF + FG = √p and AF·FG = (√q/2)² (X.17–18),
 * the side is √AF − √FG, so x² = AF, y² = FG, x·y = √q/2.
 */
export function side({ p, q }: Pair): Sub {
  const rp = Surd.root(p);
  const rd = Surd.root(p.sub(q));
  const x2 = rp.add(rd).scale(new Rat(1, 2));
  const y2 = rp.sub(rd).scale(new Rat(1, 2));
  const xy = Surd.root(q).scale(new Rat(1, 2));
  return { x2, y2, xy, x: Math.sqrt(x2.value), y: Math.sqrt(y2.value) };
}

/** The line λ·(x − y). */
export function scaleSub(s: Sub, lam: Rat): Sub {
  const l2 = lam.mul(lam);
  return { x2: s.x2.scale(l2), y2: s.y2.scale(l2), xy: s.xy.scale(l2), x: s.x * lam.value, y: s.y * lam.value };
}

/** An integer slider that picks one of `n` examples. */
export function choose(g: G, name: string, label: string, n: number, value = 1): number {
  return Math.max(1, Math.min(n, Math.round(g.param(name, value, { min: 1, max: n, step: 1, label }))));
}

/** A rational slider value as an exact fraction. */
export const rat = (x: number): Rat => Rat.of(Math.round(x * 100) / 100);

/** Throw Degenerate unless `ok`. */
export function need(ok: boolean, why: string): void {
  if (!ok) throw new Degenerate(why);
}

/** "√p" as text for a rational square p. */
export const rootText = (p: Rat | Surd): string => {
  const s = p instanceof Surd ? p : Surd.rat(p);
  const r = s.rational;
  if (!r) return `√(${s})`;
  return Surd.root(r).toString();
};

/** A line given by its square, as text: "3", "√5", "√(3/2 + √5/2)". */
export const lineOf = (m: Surd): string => {
  const r = m.rational;
  if (r) return Surd.root(r).toString();
  if (m.t.size === 1) {
    // c·√n: its square root is ⁴√(c²n)
    const [[k, c]] = [...m.t];
    const c2n = c.mul(c).mul(new Rat(BigInt(k)));
    return `⁴√${c2n.q === 1n ? c2n.toString() : `(${c2n})`}`;
  }
  return `√(${m})`;
};

/** Numbers m, n with m : n not the ratio of a square number to a square number. */
export function squareRatio(m: number, n: number): boolean {
  return new Rat(m, n).square;
}

// ------------------------------------------------------------------ X.85–90: finding the apotomes

/**
 * X.85, 86, 88, 89. A is the rational line, BC = BG − GC the apotome, H the line whose square is
 * BG² − GC², and D, F, E the numbers (DE = DF + FE). Lengths are raw (A = 1).
 */
export function drawFind(g: G, bg: number, gc: number, h: number, df: number, fe: number): void {
  const L = Lines.fit(g, Math.max(1, bg), 6);
  L.mag('A', 1, 0, 3.6);
  L.row(['B', 'C', 'G'], [bg - gc, gc], 0, 2.6);
  L.mag('H', h, 0, 1.6);
  const N = Lines.fit(g, df + fe, 6);
  const [D, , E] = N.row(['D', 'F', 'E'], [df, fe], 0, 0.4);
  g.segment(D, E, { ticks: N.u });
}

/**
 * X.87, 90. A is the rational line, FH = FG − GH the apotome, K the line whose square is
 * FG² − GH², and E, BC, CD numbers with BD = BC − CD.
 */
export function drawFind3(g: G, fg: number, gh: number, k: number, e: number, bc: number, cd: number): void {
  const L = Lines.fit(g, Math.max(1, fg), 6);
  L.mag('A', 1, 0, 4.6);
  L.row(['F', 'H', 'G'], [fg - gh, gh], 0, 3.6);
  L.mag('K', k, 0, 2.6);
  const N = Lines.fit(g, Math.max(e, bc), 6);
  N.mag('E', e, 0, 1.4, { ticks: 1 });
  const [B, , C] = N.row(['B', 'D', 'C'], [bc - cd, cd], 0, 0.4);
  g.segment(B, C, { ticks: N.u });
}

/** Pairs of numbers [DF, FE] such that DE = DF + FE has to neither the ratio of square numbers. */
export const NONSQUARE_PAIRS: [number, number][] = [
  [2, 1],
  [3, 2],
  [4, 1],
  [4, 3],
  [5, 2],
  [5, 3],
];

/** Pairs [m, n] with m² − n² not a square: DE = m², EF = n², DF = m² − n². */
export const SQUARE_PAIRS: [number, number][] = [
  [3, 2],
  [4, 3],
  [3, 1],
  [4, 1],
  [4, 2],
  [6, 5],
];

// ------------------------------------------------------------------ X.91–96: the side of ρ · apotome

/**
 * The rectangle AB = AC · AD with AC = ρ = 1 and AD = AG − GD an apotome of order `ord` (the
 * slider picks one of the examples). E bisects DG, the rectangle AF·FG = EG² is applied to AG
 * (so F divides AG as in X.17–18), and EH, FI, GK are parallel to AC. The squares LM = AI and
 * NO = FK stand about the same angle LPM, and the square ST on LN = LP − PN equals AB.
 */
export function drawSide(g: G, ord: number): void {
  const pr = example(ord, choose(g, 'k', `${ORDINAL[ord - 1]} apotome AD`, EXAMPLES));
  const sd = side(pr);
  const ag = Math.sqrt(pr.p.value);
  const gd = Math.sqrt(pr.q.value);
  const ad = ag - gd;
  const eg = gd / 2;
  const af = sd.x2.value;
  const fg = sd.y2.value;
  const s = sd.x;
  const t = sd.y;
  const u = 9 / (ag + 0.6 + s);
  const X = (k: number) => k * u;
  const h = X(1);
  const P2 = (n: string, x: number, y: number, dir: number, o: { hidden?: boolean } = {}) => g.point(n, v(x, y), { labelDir: dir, ...o });
  // the rectangle on AC
  const A = P2('A', 0, 0, 225);
  const D = P2('D', X(ad), 0, 270);
  const E = P2('E', X(ad + eg), 0, 270);
  const F = P2('F', X(af), 0, 270);
  const Gp = P2('G', X(ag), 0, 315);
  const C = P2('C', 0, h, 135);
  const B = P2('B', X(ad), h, 90);
  const H = P2('H', X(ad + eg), h, 90);
  const I = P2('I', X(af), h, 90);
  const K = P2('K', X(ag), h, 45);
  g.polygon([A, D, B, C], { fill: true });
  g.polygon([A, Gp, K, C]);
  g.segment(D, B);
  g.segment(E, H);
  g.segment(F, I);
  // the named rectangles, for the text (outlines coincide with the lines above)
  g.polygon([A, F, I, C], { aux: true });
  g.polygon([F, Gp, K, I], { aux: true });
  g.polygon([D, E, H, B], { aux: true });
  g.polygon([E, Gp, K, H], { aux: true });
  g.polygon([D, Gp, K, B], { aux: true });
  // the squares
  const x0 = X(ag + 0.6);
  const Pp = P2('P', x0, 0, 225);
  const L = P2('L', x0 + X(s), 0, 315);
  const R = P2('R', x0 + X(s), X(s), 45);
  const M = P2('M', x0, X(s), 135);
  const N = P2('N', x0 + X(t), 0, 270);
  const O = P2('O', x0, X(t), 180);
  const Q = v(x0 + X(t), X(t));
  const S = P2('S', x0 + X(s), X(t), 0);
  const T = P2('T', x0 + X(t), X(s), 90);
  g.polygon([Pp, L, S, Q, T, M], { name: 'UVW', aux: true });
  g.polygon([Pp, L, R, M]);
  g.polygon([Pp, N, Q, O]);
  g.polygon([Q, S, R, T], { fill: true });
  g.polygon([Pp, L, S, O], { aux: true });
  g.polygon([Pp, N, T, M], { aux: true });
  g.segment(Pp, R, { aux: true });
  g.text(v(x0 + X((s + t) / 2), X(t / 2)), 'U');
  g.text(v(x0 + X(t / 2), X(t / 2)), 'V');
  g.text(v(x0 + X(t / 2), X((s + t) / 2)), 'W');

  g.show('AD = AG − GD', `${rootText(pr.p)} − ${rootText(pr.q)}`);
  g.show('AF, FG', `${sd.x2}, ${sd.y2}`);
  g.show('LN = LP − PN', `${lineOf(sd.x2)} − ${lineOf(sd.y2)}`);
  g.equal('AF + FG = AG', af + fg, ag);
  g.equal('AF · FG = EG²', af * fg, eg * eg);
  g.equal('square LM = AI', s * s, af);
  g.equal('square NO = FK', t * t, fg);
  g.equal('MN = EK (the mean proportional)', s * t, eg);
  g.equal('square ST on LN = area AB', (s - t) ** 2, ad);
  g.claim(`AD is a ${ORDINAL[ord - 1]} apotome`, order(Surd.rat(pr.p), Surd.rat(pr.q)) === ord);
  g.claim(`LN is ${KIND[ord - 1]}`, kind(sd.x2, sd.y2, sd.xy) === ord);
}
