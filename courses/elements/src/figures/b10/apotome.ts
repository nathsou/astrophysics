// Helpers for X.85–115: the apotomes and the six irrationals formed by subtraction.
//
// Everything is measured against a rational line ρ = 1 and checked exactly with the ring of
// ring.ts: a line is given by its square (a Surd), an area by its value. The apotome √X − √Y has the
// same terms as the binomial √X + √Y, and the conditions of Definitions III on its terms are those
// of Definitions II, so the sliders and the order test of kinds.ts (binomialSliders,
// binomialOrder) serve for the apotomes too, and pairKind classifies the subtractive irrationals
// x − y by x², y² and x·y exactly as it does the additive ones.

import type { G } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { BINOMIAL_FORMULA, binomialOrder, binomialPreset, binomialSliders, kindHypothesis, ORDINAL, pairKind, partsFormula, partsSliders, sideParts, SUBTRACTIVE, type Parts } from './kinds';
import { Lines } from './lib';
import { line, Rat, Surd } from './ring';
import { strip } from './strips';

/** "a first apotome of a medial straight line", "minor" … as Euclid names the subtractive kinds. */
export const KIND = [
  '',
  'an apotome',
  'a first apotome of a medial straight line',
  'a second apotome of a medial straight line',
  'minor',
  'that which produces with a rational area a medial whole',
  'that which produces with a medial area a medial whole',
];

/** The formula of the apotome chosen by binomialSliders (the binomial's, with − for +). */
export const APOTOME_FORMULA = BINOMIAL_FORMULA.map((f) => f.replace(' + ', ' − '));

/** The order (1–6) of the apotome √X − √Y, given X, Y; 0 if it is not one. */
export const apotomeOrder = (X: Surd, Y: Surd): number => binomialOrder(X, Y);

/** An integer slider that picks one of `n` cases. */
export function choose(g: G, name: string, label: string, n: number, value = 1): number {
  return Math.max(1, Math.min(n, Math.round(g.param(name, value, { min: 1, max: n, step: 1, label }))));
}

/** A slider value with at most two decimals, as an exact fraction. */
export const rat = (x: number): Rat => Rat.of(Math.round(x * 100) / 100);

/** A line given by its (rational) square, as text: "3", "√5", "2√3/3". */
export const rootText = (p: Rat): string => Surd.root(p).toString();

/** A line given by its square, as text: "3", "√5", "⁴√20", "√(3/2 + √6/2)". */
export const lineOf = (m: Surd): string => {
  const r = m.rational;
  if (r) return Surd.root(r).toString();
  if (m.t.size === 1) {
    const [[k, c]] = [...m.t];
    const c2n = c.mul(c).mul(new Rat(BigInt(k)));
    return c2n.q === 1n ? `⁴√${c2n}` : `⁴√(${c2n})`;
  }
  return `√(${m})`;
};

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
 * The rectangle AB = AC · AD with AC = ρ = 1 and AD = AG − GD an apotome of order `ord` (chosen
 * with the sliders of binomialSliders). E bisects DG, the rectangle AF·FG = EG² is applied to AG
 * (X.17–18), and EH, FI, GK are parallel to AC. The squares LM = AI and NO = FK stand about the
 * same angle LPM; ST, the square on LN = LP − PN, equals AB.
 */
export function drawSide(g: G, ord: number): void {
  const b = binomialSliders(g, ord);
  const { u, w, P, x, y } = sideParts(b);
  const ag = x.value;
  const gd = y.value;
  const ad = ag - gd;
  const eg = gd / 2;
  const af = u.value;
  const fg = w.value;
  const s = Math.sqrt(af);
  const t = Math.sqrt(fg);
  const L = Lines.fit(g, ag + 0.8 + s, 10);
  const X = (k: number) => L.x(k);
  strip(L, 0, 0, 1, ['C', 'B', 'H', 'I', 'K'], ['A', 'D', 'E', 'F', 'G'], [ad, eg, af - ad - eg, fg], [
    [0, 1, { fill: true }],
    [0, 3],
    [3, 4],
    [1, 2],
    [2, 4],
    [1, 4],
    [0, 4],
  ]);
  // the squares about the angle LPM
  const x0 = X(ag + 0.8);
  const pt = (n: string, px: number, py: number, dir: number) => L.pt(n, v(px, py), { labelDir: dir });
  const Pp = pt('P', x0, 0, 225);
  const Lp = pt('L', x0 + X(s), 0, 315);
  const R = pt('R', x0 + X(s), X(s), 45);
  const M = pt('M', x0, X(s), 135);
  const N = pt('N', x0 + X(t), 0, 270);
  const O = pt('O', x0, X(t), 180);
  const Q = v(x0 + X(t), X(t));
  const S = pt('S', x0 + X(s), X(t), 0);
  const T = pt('T', x0 + X(t), X(s), 90);
  g.polygon([Pp, Lp, S, Q, T, M], { name: 'UVW', aux: true });
  g.polygon([Pp, Lp, R, M]);
  g.polygon([Pp, N, Q, O]);
  g.polygon([Q, S, R, T], { fill: true });
  g.polygon([Pp, Lp, S, O], { aux: true });
  g.polygon([Pp, N, T, M], { aux: true });
  g.segment(Pp, R, { aux: true, dashed: true });
  g.text(v(x0 + X((s + t) / 2), X(t / 2)), 'U');
  g.text(v(x0 + X(t / 2), X(t / 2)), 'V');
  g.text(v(x0 + X(t / 2), X((s + t) / 2)), 'W');

  g.show('AD = AG − GD', `${x} − ${y}`);
  g.show('AF, FG', `${u}, ${w}`);
  g.show('LN = LP − PN', `${lineOf(u)} − ${lineOf(w)}`);
  g.claim(`AD is a ${ORDINAL[ord]} apotome`, apotomeOrder(Surd.rat(b.X), Surd.rat(b.Y)) === ord);
  g.equal('AF + FG = AG', af + fg, ag);
  g.equal('AF · FG = EG²', af * fg, eg * eg);
  g.equal('square LM = AI', s * s, af);
  g.equal('square NO = FK', t * t, fg);
  g.equal('MN = EK (mean proportional)', s * t, eg);
  g.equal('square ST on LN = area AB', (s - t) ** 2, ad);
  g.claim(`LN is ${KIND[ord]}`, pairKind({ u, w, P }) === ord);
}

/** The subtractive irrational x − y of the given kind, as the parts x² = u, y² = w with x·y = P. */
export type { Parts };
export { ORDINAL, SUBTRACTIVE };

// ------------------------------------------------------------------ X.97–102: the square applied

/**
 * AB = AG − GB is a subtractive irrational of the given kind with annex BG; its square is applied
 * to the rational line CD = 1 as CE, with breadth CF. CH = AG², KL = GB², so CM = AG² + GB² and
 * FM = 2·AG·GB, bisected at N by NO.
 */
export function drawApplied(g: G, kind: number): void {
  const parts = partsSliders(g, kind);
  const { u, w, P } = parts;
  const ag = Math.sqrt(u.value);
  const gb = Math.sqrt(w.value);
  const ab = ag - gb;
  const cf = u.value + w.value - 2 * P.value;
  const L = Lines.fit(g, Math.max(u.value + w.value, ag), 10);
  L.row(['A', 'B', 'G'], [ab, gb], 0, L.x(1) + 1.2);
  strip(L, 0, 0, 1, ['D', 'E', 'O', 'H', 'L'], ['C', 'F', 'N', 'K', 'M'], [cf, P.value, P.value - w.value, w.value], [
    [0, 1, { fill: true }],
    [0, 3],
    [3, 4],
    [0, 4],
    [1, 4],
    [1, 2],
    [2, 4],
  ]);
  const CM = u.add(w);
  const MF = P.scale(2);
  g.show('AG², GB²', `${u}, ${w}`);
  g.show('CF = CM − MF', `${CM} − ${MF}`);
  const [h, ok] = kindHypothesis(kind, ['AG', 'GB'], parts);
  g.claim(`AB is ${KIND[kind]}: ${h}`, ok && pairKind(parts) === kind);
  g.equal('CE = AB²', cf, ab * ab);
  g.equal('CL = AG² + GB²', CM.value, ag * ag + gb * gb);
  g.equal('FL = 2·AG·GB (II.7)', MF.value, 2 * ag * gb);
  g.equal('CK·KM = NM²', u.value * w.value, (MF.value / 2) ** 2);
  g.claim(kind <= 3 ? 'CK, KM commensurable (X.17)' : 'CK, KM incommensurable (X.18)', (u.ratio(w) !== null) === kind <= 3);
  g.claim(`CF is a ${ORDINAL[kind]} apotome`, apotomeOrder(CM.mul(CM), MF.mul(MF)) === kind);
}

/** The caption of the figures of X.97–102. */
export const appliedCaption = (kind: number) => `${partsCaption(kind, ['AG', 'GB'])}. AB = AG − GB, and the rectangle CE = AB² is applied to the rational line CD = 1.`;

/** What the sliders of partsSliders mean for a subtractive irrational x − y. */
export function partsCaption(kind: number, [a, b]: [string, string]): string {
  if (kind === 1) return partsFormula(1, [a, b]);
  return `${a} and ${b} are the lines Euclid finds in X.${90 + kind} for the ${ORDINAL[kind]} apotome ${APOTOME_FORMULA[kind]}`;
}

// ------------------------------------------------------------------ X.103–107: commensurable lines

/**
 * AB = AE − EB is a subtractive line with annex BE, and CD = λ·AB (λ rational), with DF the
 * annex made so that BE : DF = AB : CD. `choose` lets a slider pick the kind (X.103: the order of
 * the apotome; X.104: first or second apotome of a medial); otherwise partsSliders gives AE, EB.
 */
export function drawComm(g: G, kind: number, o: { choose?: number[]; apotome?: boolean } = {}): void {
  let k = kind;
  let parts: Parts;
  if (o.choose) {
    const i = g.param('kind', 1, { min: 1, max: o.choose.length, label: o.apotome ? 'order of AB' : 'first (1) or second (2)' });
    k = o.choose[Math.round(i) - 1];
    const b = binomialPreset(k);
    parts = o.apotome ? { u: Surd.rat(b.X), w: Surd.rat(b.Y), P: Surd.root(b.X.mul(b.Y)) } : sideParts(b);
  } else parts = partsSliders(g, kind);
  const lam = g.param('λ', 1.5, { min: 0.5, max: 2, step: 0.25, label: 'λ = CD : AB' });
  const l2 = rat(lam).mul(rat(lam));
  const { u, w, P } = parts;
  const scaled: Parts = { u: u.scale(l2), w: w.scale(l2), P: P.scale(l2) };
  const ae = Math.sqrt(u.value);
  const eb = Math.sqrt(w.value);
  const L = Lines.fit(g, Math.max(1, lam) * ae, 8);
  L.row(['A', 'B', 'E'], [ae - eb, eb], 0, 1.4);
  L.row(['C', 'D', 'F'], [lam * (ae - eb), lam * eb], 0, 0);
  const noun = (j: number) => (o.apotome ? `a ${ORDINAL[j]} apotome` : KIND[j]);
  g.show('AE², EB²', `${u}, ${w}`);
  g.show('CF², FD²', `${scaled.u}, ${scaled.w}`);
  g.equal('BE : DF = AB : CD', eb / (lam * eb), (ae - eb) / (lam * (ae - eb)));
  g.equal('AE : CF = AB : CD (V.12)', ae / (lam * ae), 1 / lam);
  g.equal('AE : EB = CF : FD (V.16)', ae / eb, (lam * ae) / (lam * eb));
  if (o.apotome) {
    g.claim(`AB is ${noun(k)}`, apotomeOrder(u, w) === k);
    g.claim('CF, FD rational, commensurable in square only', line.rational(scaled.u) && line.rational(scaled.w) && line.commSqOnly(scaled.u, scaled.w));
    g.claim(`CD is ${noun(k)}`, apotomeOrder(scaled.u, scaled.w) === k);
  } else {
    const [h0, ok0] = kindHypothesis(k, ['AE', 'EB'], parts);
    g.claim(`AB is ${noun(k)}: ${h0}`, ok0 && pairKind(parts) === k);
    const [h, ok] = kindHypothesis(k, ['CF', 'FD'], scaled);
    g.claim(h, ok);
    g.claim(`CD is ${noun(k)}`, pairKind(scaled) === k);
  }
}
