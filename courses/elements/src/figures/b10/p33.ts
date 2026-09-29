import { figure } from '../../geometry/figure';
import { isSquare, Lines, semicircleSplit } from './lib';

// Against ρ = 1: AB = √(p² + q²) and BC = p are rational, commensurable in square only, and
// AB² − BC² = q² with q incommensurable with AB (X.30). D bisects BC; AE·EB = BD² is applied to
// AB; EF is perpendicular, meeting the semicircle at F. Then AF² + FB² = AB² is rational and
// AF·FB = AB·EF = ½·AB·BC is medial, while AF, FB are incommensurable in square.
export default figure({
  caption: 'AF and FB: the sum of their squares is AB², rational; their rectangle is AB·EF = ½·AB·BC, medial. Together they make the major line of X.39.',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 4, label: 'BC = p: p' });
    let q = g.param('q', 1, { min: 1, max: 4, label: 'q' });
    while (isSquare(p * p + q * q)) q++;
    const s = p * p + q * q;
    const ab = Math.sqrt(s);
    const bc = p;
    const L = Lines.fit(g, ab, 8);
    const r = semicircleSplit(L, ab, bc, ['A', 'B', 'C', 'D', 'E', 'F']);
    g.show('AF², FB²', `(${s} ± ${q === 1 ? '' : q}√${s})/2`);
    g.equal('AE·EB = BD²', r.ae * r.eb, (bc / 2) ** 2);
    g.equal('EF = BD', r.ft, bc / 2);
    g.equal('AF² + FB² = AB² (rational)', r.at ** 2 + r.tb ** 2, s);
    g.equal('AF·FB = AB·EF', r.at * r.tb, ab * r.ft);
    g.equal('AF² : FB² = AE : EB', r.at ** 2 / r.tb ** 2, r.ae / r.eb);
    g.claim('p² + q² is not a square: AE, EB incommensurable, AF·FB medial', !isSquare(s));
  },
});
