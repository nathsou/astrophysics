import { figure } from '../../geometry/figure';
import { add, area, dist, ll, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// (a + b)² = a² + b² + 2ab. The diagonal BD cuts the parallel through C at G, and the parallel
// to AB through G finishes the four pieces: two squares on the diagonal and two equal rectangles.
export default figure({
  build(g) {
    const A = g.free('A', -2, 1.8);
    const B = g.free('B', 2, 1.8);
    const C = g.glider('C', [A, B], 0.58);
    const s = dist(A, B);
    const f = frame(A, B);
    const dn = below(A, B);
    const { D, E } = g.points({ D: f(0, s), E: f(s, s) });
    const sq = g.polygon([A, D, E, B]);
    g.segment(B, D);
    const G = g.point('G', ll(C, add(C, dn), B, D));
    const F = g.point('F', ll(C, G, D, E));
    const H = g.point('H', ll(G, add(G, sub(B, A)), A, D));
    const K = g.point('K', ll(G, H, B, E));
    g.segment(C, F);
    g.segment(H, K);
    const HF = g.polygon([H, G, F, D], { name: 'HF', fill: true });
    const CK = g.polygon([C, B, K, G], { name: 'CK', fill: true });
    const AG = g.polygon([A, C, G, H], { name: 'AG' });
    const GE = g.polygon([G, K, E, F], { name: 'GE' });
    const a = dist(A, C);
    const b = dist(C, B);
    g.equal('AB² = AC² + CB² + 2·AC·CB', s * s, a * a + b * b + 2 * a * b);
    g.equal('ADEB = HF + CK + AG + GE', area(sq), area(HF) + area(CK) + area(AG) + area(GE));
    g.equal('CG = CB (CGKB is a square)', dist(C, G), b);
    g.equal('AG = GE = AC·CB', area(AG), area(GE));
  },
});
