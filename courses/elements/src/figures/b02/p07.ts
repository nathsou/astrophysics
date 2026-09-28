import { figure } from '../../geometry/figure';
import { add, area, dist, ll, sub } from '../../geometry/vec';
import { below, frame } from './lib';

// (a + b)² + b² = 2(a + b)·b + a²: the two rectangles AF and CE overlap in the square CF.
// Heath leaves the ends of the parallels on AD and DE unlettered; here they are hidden points X, Y.
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
    g.segment(B, D, { aux: true });
    const G = g.point('G', ll(C, add(C, dn), B, D));
    const Y = g.point('Y', ll(C, G, D, E), { hidden: true });
    const X = g.point('X', ll(G, add(G, sub(B, A)), A, D), { hidden: true });
    const F = g.point('F', ll(X, G, B, E));
    g.segment(C, Y);
    g.segment(X, F);
    const gn = g.polygon([A, B, E, Y, G, X], { name: 'KLM', fill: true });
    const CF = g.polygon([C, B, F, G], { name: 'CF', fill: true });
    const AG = g.polygon([A, C, G, X], { name: 'AG' });
    const GE = g.polygon([G, F, E, Y], { name: 'GE' });
    const AF = g.polygon([A, B, F, X], { name: 'AF', aux: true });
    const CE = g.polygon([C, B, E, Y], { name: 'CE', aux: true });
    const DG = g.polygon([X, G, Y, D], { name: 'DG' });
    const b = dist(B, C);
    const a = dist(A, C);
    const t = Math.min(a, b) * 0.28;
    const gx = a;
    g.text(f(gx - 1.4 * t, a - 0.5 * t), 'K', { from: 6 });
    g.text(f(gx + 0.5 * t, a - 0.5 * t), 'L', { from: 6 });
    g.text(f(gx + 0.5 * t, a + 1.4 * t), 'M', { from: 6 });
    g.equal('AB² + BC² = 2·AB·BC + AC²', s * s + b * b, 2 * s * b + a * a);
    g.equal('AG = GE', area(AG), area(GE));
    g.equal('AF + CE = gnomon KLM + CF', area(AF) + area(CE), area(gn) + area(CF));
    g.equal('KLM + DG = ADEB', area(gn) + area(DG), area(sq));
  },
});
