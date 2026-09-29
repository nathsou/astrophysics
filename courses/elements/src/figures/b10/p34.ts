import { figure } from '../../geometry/figure';
import { isSquare, Lines, semicircleSplit } from './lib';

// Against ρ = 1, with s = √(p² + q²) irrational: AB = √(s·p) and BC = p²/AB are medial,
// commensurable in square only, contain the rational rectangle AB·BC = p², and √(AB² − BC²) is
// incommensurable with AB (X.31, end). E bisects BC, AF·FB = BE² is applied to AB, FD is
// perpendicular. Then AD² + DB² = AB² is medial and AD·DB = AB·FD = ½p² is rational.
export default figure({
  caption: 'AD and DB: the sum of their squares is AB², medial; their rectangle is AB·FD = ½·AB·BC, rational. Together they make the line of X.40.',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 3, label: 'p' });
    let q = g.param('q', 1, { min: 1, max: 3, label: 'q' });
    while (isSquare(p * p + q * q)) q++;
    const n = p * p + q * q;
    const s = Math.sqrt(n);
    const ab = Math.sqrt(s * p);
    const bc = (p * p) / ab;
    const L = Lines.fit(g, ab, 8);
    const r = semicircleSplit(L, ab, bc, ['A', 'B', 'C', 'E', 'F', 'D']);
    g.show('AD², DB²', `${p}(√${n} ± ${q})/2`);
    g.equal('AB·BC = p² (rational)', ab * bc, p * p);
    g.equal('AF·FB = BE²', r.ae * r.eb, (bc / 2) ** 2);
    g.equal('AD² + DB² = AB² = p√(p² + q²) (medial)', r.at ** 2 + r.tb ** 2, p * s);
    g.equal('AD·DB = AB·FD = ½p² (rational)', r.at * r.tb, (p * p) / 2);
    g.equal('AD² : DB² = AF : FB', r.at ** 2 / r.tb ** 2, r.ae / r.eb);
    g.claim('p² + q² is not a square', !isSquare(n));
  },
});
