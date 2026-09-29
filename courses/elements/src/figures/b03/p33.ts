import { figure } from '../../geometry/figure';
import { add, dist, ll, mid, mul, perp, rot, sub, unit, v } from '../../geometry/vec';
import { degAt } from './lib';

// On AB, a segment of a circle admitting a given angle C. Make ∠BAD = ∠C, draw AE ⟂ AD and the
// perpendicular bisector FG of AB; G is the centre. The slider sets the given angle: acute
// (Heath's first figure), right (G falls on F) or obtuse (the segment AHB is the lesser one).
export default figure({
  build(g) {
    const th = g.param('C', 62, { min: 20, max: 160, step: 1, label: 'the given angle C (°)' });
    const a = (th * Math.PI) / 180;
    const C = g.free('C', -3.6, -2.4);
    const arm = 1.1;
    g.segment(C, add(C, v(arm, 0)));
    g.segment(C, add(C, rot(v(arm, 0), a)));
    g.angle(add(C, v(arm, 0)), C, add(C, rot(v(arm, 0), a)));
    const A = g.free('A', -1.6, 0);
    const B = g.free('B', 1.6, 0);
    const u = unit(sub(B, A));
    const D = g.point('D', add(A, mul(rot(u, -a), 1.6)));
    const F = g.point('F', mid(A, B));
    const Gp = ll(F, add(F, perp(u)), A, add(A, perp(sub(D, A))));
    const G = g.point('G', Gp);
    const r = dist(G, A);
    const E = g.point('E', sub(mul(G, 2), A));
    // H: the middle of the arc AB on the side opposite E
    const n = unit(perp(u));
    const h1 = add(G, mul(n, r));
    const h2 = sub(G, mul(n, r));
    const H = g.point('H', dist(h1, E) > dist(h2, E) ? h1 : h2);
    g.circle(G, r, { name: 'ABE' });
    g.segment(A, B);
    g.segment(A, D);
    g.segment(A, E);
    g.segment(F, G, { aux: true });
    g.segment(G, B, { aux: true });
    g.segment(E, B);
    g.path(A, H, B, { aux: true });
    g.angle(B, A, D);
    g.angle(A, E, B);
    const inSeg = th <= 90 ? degAt(A, E, B) : degAt(A, H, B);
    g.equal(th <= 90 ? '∠AEB = ∠C' : '∠AHB = ∠C', inSeg, th);
    g.equal('∠AEB + ∠AHB = 180°', degAt(A, E, B) + degAt(A, H, B), 180);
  },
});
