import { figure } from '../../geometry/figure';
import { binomialOrder, partsFormula, partsSliders, pairKind, sq } from './kinds';
import { Lines } from './lib';
import { area, line, lineText } from './ring';
import { strip } from './strips';

// AB and BC are the two parts of X.59 for a sixth binomial, so they satisfy X.35: incommensurable
// in square, the sum of their squares medial, their rectangle medial and incommensurable with that
// sum. DF = AB² + BC² and GH = 2·AB·BC are applied to the rational line DE = 1.
// The lemma at the end (letters reused for a different line) is not drawn separately.
export default figure({
  caption: `${partsFormula(6, ['AB', 'BC'])}. The rectangles on the rational line DE are AB² + BC² and 2·AB·BC; together they make the square on AC.`,
  build(g) {
    const { u, w, P } = partsSliders(g, 6);
    const ab = sq(u.value);
    const bc = sq(w.value);
    const dg = u.add(w); // breadth of DF (DE = 1)
    const gk = P.scale(2); // breadth of GH
    const L = Lines.fit(g, Math.max(ab + bc, dg.value + gk.value), 8);
    L.row(['A', 'B', 'C'], [ab, bc], 0, L.x(1) + 1.4);
    strip(L, 0, 0, 1, ['D', 'G', 'K'], ['E', 'F', 'H'], [dg.value, gk.value], [[0, 1], [1, 2], [0, 2]]);
    g.show('AB²', u.toString());
    g.show('BC²', w.toString());
    g.show('AB·BC', P.toString());
    g.show('DG, GK', `${dg}, ${gk}`);
    g.claim('AB, BC incommensurable in square', line.incommSq(u, w));
    g.claim('AB² + BC² medial', area.medial(dg));
    g.claim('AB·BC medial, incommensurable with AB² + BC²', area.medial(P) && !area.comm(P, dg));
    g.equal('DH = AC²', dg.value + gk.value, (ab + bc) ** 2);
    g.claim('DG, GK rational, commensurable in square only', line.rational(dg.mul(dg)) && line.rational(gk.mul(gk)) && line.commSqOnly(dg.mul(dg), gk.mul(gk)));
    g.claim('DK binomial', binomialOrder(dg.mul(dg), gk.mul(gk)) > 0 || binomialOrder(gk.mul(gk), dg.mul(dg)) > 0);
    g.claim('AC irrational', !line.rational(u.add(w).add(P.scale(2))));
    g.show('AC', lineText(u.add(w).add(P.scale(2))));
    g.claim('AC is the side of the sum of two medial areas', pairKind({ u, w, P }) === 6);
  },
});
