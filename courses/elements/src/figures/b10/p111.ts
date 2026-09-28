import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { apotomeOrder } from './apotome';
import { partsSliders } from './kinds';
import { Lines } from './lib';
import { line } from './ring';

// AB = √a − √b is an apotome. Its square, applied to the rational line DC = 1, has breadth
// DE = (a + b) − 2√(ab), a first apotome with annex EF (X.97). The point G that would divide DE
// into the terms of a first binomial (X.60) is the object of the reductio: it cannot exist.
const WHY = 'the point that would divide DE into the terms of a binomial: the reductio shows it cannot exist';

export default figure({
  caption: 'AB = √a − √b is an apotome (a, b integers, ab not a square), and DC = 1 is the rational line. DE is the breadth of AB² applied to DC; EF is its annex. The square on the binomial √a + √b would have breadth DF + FE instead.',
  unresolved: { G: WHY, DG: WHY, GE: WHY, EG: WHY, GF: WHY, FG: WHY },
  build(g) {
    const { u, w, P } = partsSliders(g, 1);
    const a = Math.sqrt(u.value);
    const b = Math.sqrt(w.value);
    const DF = u.add(w);
    const FE = P.scale(2);
    const de = DF.value - FE.value;
    const L = Lines.fit(g, DF.value, 10);
    const h = L.x(1);
    L.row(['A', 'B'], [a - b], 0, h + 1.4);
    const D = L.pt('D', v(0, h), { labelDir: 135 });
    const C = L.pt('C', v(0, 0), { labelDir: 225 });
    const E = L.pt('E', v(L.x(de), h), { labelDir: 90 });
    const F = L.pt('F', v(L.x(DF.value), h), { labelDir: 90 });
    g.polygon([C, v(E.x, 0), E, D], { fill: true });
    g.segment(D, F);
    g.show('AB', `√${u} − √${w}`);
    g.show('DE = DF − FE', `${DF} − ${FE}`);
    g.show('(√a + √b)² = DF + FE', `${DF} + ${FE}`);
    g.equal('DE · DC = AB²', de, (a - b) ** 2);
    g.claim('AB is an apotome', apotomeOrder(u, w) > 0);
    g.claim('DF, FE rational, commensurable in square only', line.rational(DF.mul(DF)) && line.commSqOnly(DF.mul(DF), FE.mul(FE)));
    g.claim('DE is a first apotome (X.97)', apotomeOrder(DF.mul(DF), FE.mul(FE)) === 1);
    g.claim('DE is not rational', !line.rational(DF.sub(FE).mul(DF.sub(FE))));
  },
});
