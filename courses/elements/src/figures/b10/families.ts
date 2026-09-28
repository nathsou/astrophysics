// Figure factories for the families of X.41–84, which repeat one argument six times (once for
// each kind of irrational). Each proposition's file calls one of these with its kind.
//
// Everything is measured against the rational line ρ = 1. Lengths are drawn to scale; the exact
// values (as sums of square roots) are shown as readouts, and Euclid's classifications are checked
// exactly by ring.ts, not guessed from floating-point numbers.

import { figure, type FigureDef } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import {
  ADDITIVE,
  binomialOrder,
  binomialPreset,
  binomialSliders,
  BINOMIAL_FORMULA,
  kindHypothesis,
  ORDINAL,
  pairKind,
  partsFormula,
  partsSliders,
  sideParts,
  sq,
  SUBTRACTIVE,
  type Parts,
} from './kinds';
import { Lines } from './lib';
import { area, line, lineText, Rat, Surd } from './ring';
import { lemmaSquare, strip } from './strips';

const an = (s: string) => (/^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);

// ------------------------------------------------------------------ X.42–47

/**
 * X.42–47: AB is an irrational of the given kind, divided at C into its two parts (AC > CB). D is
 * another point, between the reflection of C in the midpoint and C, so that AC > DB as in X.44.
 * With `strip`, the rectangles of X.44 and X.47 are applied to the rational line EF.
 */
export function uniqueDivision(kind: number, o: { strip?: boolean; caption?: string } = {}): FigureDef {
  return figure({
    caption: `${partsFormula(kind, ['AC', 'CB'])}. D is any other point with DB < AC: drag it.${o.caption ? ' ' + o.caption : ''}`,
    build(g) {
      const parts = partsSliders(g, kind);
      const { u, w, P } = parts;
      const ac = sq(u.value);
      const cb = sq(w.value);
      const ab = ac + cb;
      const L = Lines.fit(g, o.strip ? Math.max(ab, ab * ab) : ab, 8);
      const y0 = o.strip ? L.x(1) + 1.6 : 0;
      const [A, C, B] = L.row(['A', 'C', 'B'], [ac, cb], 0, y0);
      void B;
      const Cp = v(A.x + L.x(cb), y0);
      const D = g.glider('D', [Cp, C], 0.45, { labelDir: 270 });
      const ad = (D.x - A.x) / L.u;
      const db = ab - ad;
      const S = u.add(w);
      const sD = ad * ad + db * db;
      g.show('AC², CB²', `${u}, ${w}`);
      g.show('AC·CB', P.toString());
      g.show('AD² + DB²', sD.toFixed(4));
      const [h, ok] = kindHypothesis(kind, ['AC', 'CB'], parts);
      g.claim(h, ok);
      g.equal('(AC² + CB²) − (AD² + DB²) = 2·AD·DB − 2·AC·CB', S.value - sD, 2 * ad * db - 2 * P.value);
      if (kind === 1) g.claim('AC² + CB² rational, 2·AC·CB medial', area.rational(S) && area.medial(P));
      if (kind === 2 || kind === 5) g.claim('2·AC·CB rational, AC² + CB² medial', area.rational(P) && area.medial(S));
      g.claim('AD² + DB² < AC² + CB² (lemma after X.41)', sD < S.value);
      if (o.strip) {
        const em = sD;
        const mh = S.value - sD;
        const hn = 2 * P.value;
        strip(L, 0, 0, 1, ['E', 'M', 'H', 'N'], ['F', 'L', 'G', 'K'], [em, mh, hn], [[0, 3], [0, 2], [2, 3], [0, 1], [1, 3]]);
        g.equal('EK = AB²', em + mh + hn, ab * ab);
        g.equal('MK = 2·AD·DB', mh + hn, 2 * ad * db);
        const EH = S.mul(S);
        const HN = P.mul(P).scale(4);
        g.claim('EH, HN rational, commensurable in square only', line.rational(EH) && line.rational(HN) && line.commSqOnly(EH, HN));
        g.claim('EN binomial, divided at H', binomialOrder(EH, HN) > 0 || binomialOrder(HN, EH) > 0);
        g.claim('EH > MN', S.value > mh + hn);
      }
      g.claim(`AB is ${an(ADDITIVE[kind])}`, pairKind(parts) === kind);
    },
  });
}

// ------------------------------------------------------------------ X.54–59

/**
 * X.54–59: the area AC is contained by the rational line AB = 1 and a binomial AD of the given
 * order, cut at E into its terms. F bisects ED; AG·GE = EF² (X.17, 18); the squares SN = AH and
 * NQ = GK are placed as in the lemma after X.53, and MO is the side of AC.
 */
export function sideOfArea(order: number): FigureDef {
  return figure({
    caption: `AB = 1 is the rational line and AD = ${BINOMIAL_FORMULA[order]} is a ${ORDINAL[order]} binomial (choose it with the sliders). The square SQ on MO equals the rectangle AC.`,
    build(g) {
      const b = binomialSliders(g, order);
      const { u, w, P, x, y } = sideParts(b);
      const mn = sq(u.value);
      const no = sq(w.value);
      const ad = x.value + y.value;
      const L = Lines.fit(g, ad, 10);
      strip(L, 0, 0, 1, ['A', 'G', 'E', 'F', 'D'], ['B', 'H', 'K', 'L', 'C'], [u.value, w.value, y.value / 2, y.value / 2], [[0, 4], [0, 1], [1, 2], [2, 3], [0, 2]]);
      lemmaSquare(L, L.x(mn) + 0.2 * L.x(ad), -1.2 - L.x(mn), mn, no);
      g.show('AE, ED', `${x}, ${y}`);
      g.show('AG, GE', `${u}, ${w}`);
      g.show('MN, NO', `${lineText(u)}, ${lineText(w)}`);
      g.claim(`AD is a ${ORDINAL[order]} binomial`, binomialOrder(Surd.rat(b.X), Surd.rat(b.Y)) === order);
      g.equal('AG·GE = EF²', u.value * w.value, (y.value / 2) ** 2);
      g.claim(order <= 3 ? 'AG, GE commensurable (X.17)' : 'AG, GE incommensurable (X.18)', area.comm(u, w) === order <= 3);
      g.equal('SN = AH', mn * mn, u.value);
      g.equal('NQ = GK', no * no, w.value);
      g.equal('MR = EL', mn * no, y.value / 2);
      g.equal('square on MO = AC', (mn + no) ** 2, ad);
      const parts = { u, w, P };
      const [h, ok] = kindHypothesis(order, ['MN', 'NO'], parts);
      g.claim(h, ok);
      g.claim(`MO is ${an(ADDITIVE[order])}`, pairKind(parts) === order);
    },
  });
}

// ------------------------------------------------------------------ X.60–65

/**
 * X.60–65: AB, an irrational of the given kind divided at C (AC > CB); DG is the breadth of AB²
 * applied to the rational line DE = 1. DH = AC², KL = CB², MF = 2·AC·CB, bisected by NO.
 */
export function squareApplied(kind: number): FigureDef {
  return figure({
    caption: `${partsFormula(kind, ['AC', 'CB'])}. The rectangle DF = AB² is applied to the rational line DE = 1.`,
    build(g) {
      const parts = partsSliders(g, kind);
      const { u, w, P } = parts;
      const ac = sq(u.value);
      const cb = sq(w.value);
      const ab = ac + cb;
      const dg = ab * ab;
      const L = Lines.fit(g, Math.max(dg, ab), 10);
      L.row(['A', 'C', 'B'], [ac, cb], 0, L.x(1) + 1.4);
      strip(L, 0, 0, 1, ['D', 'K', 'M', 'N', 'G'], ['E', 'H', 'L', 'O', 'F'], [u.value, w.value, P.value, P.value], [[0, 4], [0, 1], [1, 2], [2, 4], [2, 3], [3, 4], [0, 2]]);
      const DM = u.add(w);
      const MG = P.scale(2);
      g.show('AC², CB²', `${u}, ${w}`);
      g.show('DM, MG', `${DM}, ${MG}`);
      const [h, ok] = kindHypothesis(kind, ['AC', 'CB'], parts);
      g.claim(h, ok);
      g.equal('DG·DE = AB²', DM.value + MG.value, dg);
      g.equal('DK·KM = MN²', u.value * w.value, P.value * P.value);
      g.claim('DM > MG (AC² + CB² > 2·AC·CB)', DM.value > MG.value);
      g.claim(kind <= 3 ? 'DK, KM commensurable' : 'DK, KM incommensurable', area.comm(u, w) === kind <= 3);
      g.claim(`DG is a ${ORDINAL[kind]} binomial`, binomialOrder(DM.mul(DM), MG.mul(MG)) === kind);
    },
  });
}

// ------------------------------------------------------------------ X.66–70

/**
 * X.66–70: CD = λ·AB with λ rational, and CF : FD = AE : EB. `choose` lists the kinds the reader
 * can pick with a slider (X.66: the six orders of binomial; X.67: first or second bimedial);
 * otherwise the parts come from partsSliders.
 */
export function commensurableWith(kind: number, o: { choose?: number[]; binomial?: boolean } = {}): FigureDef {
  const noun = (k: number) => (o.binomial ? `a ${ORDINAL[k]} binomial` : an(ADDITIVE[k]));
  return figure({
    caption: o.choose
      ? `Choose the ${o.binomial ? 'order' : 'kind'} of AB with the first slider, and the rational ratio λ = CD : AB with the second.`
      : `${partsFormula(kind, ['AE', 'EB'])}. λ = CD : AB is a rational number.`,
    build(g) {
      let k = kind;
      let parts: Parts;
      if (o.choose) {
        const i = g.param('kind', 1, { min: 1, max: o.choose.length, label: o.binomial ? 'order' : 'first (1) or second (2)' });
        k = o.choose[i - 1];
        const b = binomialPreset(k);
        if (o.binomial) {
          const X = Surd.rat(b.X);
          const Y = Surd.rat(b.Y);
          parts = { u: X, w: Y, P: Surd.root(b.X.mul(b.Y)) };
        } else parts = sideParts(b);
      } else parts = partsSliders(g, kind);
      const lam = g.param('λ', 1.5, { min: 0.5, max: 2, step: 0.25, label: 'λ = CD : AB' });
      const l2 = Rat.of(lam).mul(Rat.of(lam));
      const { u, w, P } = parts;
      const scaled: Parts = { u: u.scale(l2), w: w.scale(l2), P: P.scale(l2) };
      const ae = sq(u.value);
      const eb = sq(w.value);
      const L = Lines.fit(g, Math.max(1, lam) * (ae + eb), 8);
      L.row(['A', 'E', 'B'], [ae, eb], 0, 1.2);
      L.row(['C', 'F', 'D'], [lam * ae, lam * eb], 0, 0);
      g.show('AE², EB²', `${u}, ${w}`);
      g.show('CF², FD²', `${scaled.u}, ${scaled.w}`);
      g.equal('AE : CF = EB : FD', ae / (lam * ae), eb / (lam * eb));
      g.equal('CD : AB = λ', (lam * (ae + eb)) / (ae + eb), lam);
      if (o.binomial) {
        g.claim(`AB is ${noun(k)}`, binomialOrder(u, w) === k);
        g.claim(`CF, FD rational, commensurable in square only`, line.rational(scaled.u) && line.rational(scaled.w) && line.commSqOnly(scaled.u, scaled.w));
        g.claim(`CD is ${noun(k)}`, binomialOrder(scaled.u, scaled.w) === k);
      } else {
        g.claim(`AB is ${noun(k)}`, pairKind(parts) === k);
        const [h, ok] = kindHypothesis(k, ['CF', 'FD'], scaled);
        g.claim(h, ok);
        g.claim(`CD is ${noun(k)}`, pairKind(scaled) === k);
      }
    },
  });
}

// ------------------------------------------------------------------ X.73–78

/**
 * X.73–78: from AB take away BC, where AB, BC are the two parts of an irrational of the given kind
 * (AB > BC); the remainder AC is the corresponding subtractive irrational. With `strip`, the
 * rectangles of X.75 and X.78 are applied to the rational line DI = 1.
 */
export function remainder(kind: number, o: { strip?: boolean } = {}): FigureDef {
  return figure({
    caption: `${partsFormula(kind, ['AB', 'BC'])}. AC is what is left when BC is taken from AB.`,
    build(g) {
      const parts = partsSliders(g, kind);
      const { u, w, P } = parts;
      const ab = sq(u.value);
      const bc = sq(w.value);
      const ac = ab - bc;
      const S = u.add(w);
      const AC2 = S.sub(P.scale(2));
      const L = Lines.fit(g, o.strip ? Math.max(ab, S.value) : ab, 8);
      L.row(['A', 'C', 'B'], [ac, bc], 0, o.strip ? L.x(1) + 1.4 : 0);
      g.show('AB², BC²', `${u}, ${w}`);
      g.show('AB·BC', P.toString());
      g.show('AC', `√(${AC2})`);
      const [h, ok] = kindHypothesis(kind, ['AB', 'BC'], parts);
      g.claim(h, ok);
      g.equal('AB² + BC² = 2·AB·BC + AC² (II.7)', S.value, 2 * P.value + ac * ac);
      if (kind === 1 || kind === 4) g.claim('AB² + BC² incommensurable with AC²', !area.comm(S, AC2));
      if (kind === 2 || kind === 5) g.claim('2·AB·BC incommensurable with AC²', !area.comm(P, AC2));
      if (o.strip) {
        strip(L, 0, 0, 1, ['D', 'F', 'G'], ['I', 'H', 'E'], [2 * P.value, S.value - 2 * P.value], [[0, 2], [0, 1], [1, 2]]);
        g.equal('FE = AC²', S.value - 2 * P.value, ac * ac);
        const DG = S.mul(S);
        const DF = P.mul(P).scale(4);
        g.claim('DG, DF rational, commensurable in square only', line.rational(DG) && line.rational(DF) && line.commSqOnly(DG, DF));
        g.claim('FG an apotome', pairKind({ u: DG, w: DF, P: S.mul(P).scale(2) }) === 1);
      }
      g.claim('AC irrational', !line.rational(AC2));
      g.claim(`AC is ${an(SUBTRACTIVE[kind])}`, pairKind(parts) === kind);
    },
  });
}

// ------------------------------------------------------------------ X.79–84

/**
 * X.79–84: AB is a subtractive irrational of the given kind with annex BC (so AC, CB are its whole
 * and annex); D is a supposed second annex, beyond C. With `strip`, the rectangles of X.81 and
 * X.84 are applied to the rational line EF = 1.
 */
export function uniqueAnnex(kind: number, o: { strip?: boolean } = {}): FigureDef {
  return figure({
    caption: `${partsFormula(kind, ['AC', 'CB'])}. AB = AC − CB, and D is a supposed second annex: drag it.`,
    build(g) {
      const parts = partsSliders(g, kind);
      const { u, w, P } = parts;
      const ac = sq(u.value);
      const cb = sq(w.value);
      const abl = ac - cb;
      const S = u.add(w);
      const sMax = (ac + 0.8 * cb) ** 2 + (1.8 * cb) ** 2;
      const L = Lines.fit(g, o.strip ? Math.max(ac + cb, sMax - S.value + abl * abl + 2 * P.value) : ac + cb, 8);
      const y0 = o.strip ? L.x(1) + 1.6 : 0;
      const [, , C] = L.row(['A', 'B', 'C'], [abl, cb], 0, y0);
      const D = g.glider('D', [C, v(C.x + L.x(0.8 * cb), y0)], 0.5);
      g.segment(C, D, { dashed: true });
      const cd = (D.x - C.x) / L.u;
      const ad = ac + cd;
      const db = cb + cd;
      const sD = ad * ad + db * db;
      g.show('AC², CB²', `${u}, ${w}`);
      g.show('AC·CB', P.toString());
      g.show('AD² + DB²', sD.toFixed(4));
      const [h, ok] = kindHypothesis(kind, ['AC', 'CB'], parts);
      g.claim(h, ok);
      g.equal('AC² + CB² − 2·AC·CB = AB²', S.value - 2 * P.value, abl * abl);
      g.equal('AD² + DB² − 2·AD·DB = AB²', sD - 2 * ad * db, abl * abl);
      g.equal('(AD² + DB²) − (AC² + CB²) = 2·AD·DB − 2·AC·CB', sD - S.value, 2 * ad * db - 2 * P.value);
      if (o.strip) {
        const eh = abl * abl;
        const hm = 2 * P.value;
        const mn = sD - S.value;
        strip(L, 0, 0, 1, ['E', 'H', 'M', 'N'], ['F', 'L', 'G', 'I'], [eh, hm, mn], [[0, 2], [1, 2], [0, 1], [0, 3], [1, 3]]);
        g.equal('HI = 2·AD·DB', hm + mn, 2 * ad * db);
        const EM = S.mul(S);
        const MH = P.mul(P).scale(4);
        g.claim('EM, MH rational, commensurable in square only', line.rational(EM) && line.rational(MH) && line.commSqOnly(EM, MH));
        g.claim('EH an apotome with annex HM', pairKind({ u: EM, w: MH, P: S.mul(P).scale(2) }) === 1);
      }
      g.claim(`AB is ${an(SUBTRACTIVE[kind])}`, pairKind(parts) === kind);
    },
  });
}
