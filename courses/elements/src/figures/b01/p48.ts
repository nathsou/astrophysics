import { figure } from '../../geometry/figure';
import { add, angle, cc, deg, dist, mul, perp, side, sub, unit } from '../../geometry/vec';

// Converse of Pythagoras. The hypothesis is built from lengths only, with no angle in sight: B and
// C are free, the slider sets BA as a fraction of BC, and A is where the circle about B with that
// radius meets the circle about C with radius √(BC² − BA²). AD is drawn at right angles to AC,
// on the other side of AC from B, with AD = AB.
export default figure({
  build(g) {
    const B = g.free('B', 0.6, 2);
    const C = g.free('C', -2.6, -0.6);
    const kk = g.param('k', 0.56, { min: 0.2, max: 0.95, step: 0.01, label: 'BA : BC' });
    const bc = dist(B, C);
    const ba = kk * bc;
    const ac = Math.sqrt(bc * bc - ba * ba);
    const A = g.point('A', cc({ c: B, r: ba }, { c: C, r: ac })[0]);
    const n = unit(perp(sub(C, A)));
    const sgn = -side(A, C, B);
    const D = g.point('D', add(A, mul(n, sgn * dist(A, B))));
    g.polygon([A, B, C]);
    g.segment(A, D);
    g.segment(D, C);
    g.angle(D, A, C, { right: true });
    g.angle(B, A, C, { right: true });
    g.equal('BC² = BA² + AC² (hypothesis)', bc * bc, ba * ba + dist(A, C) ** 2);
    g.equal('DC = BC', dist(D, C), bc);
    g.equal('∠BAC = right', angle(B, A, C), Math.PI / 2);
    g.show('∠BAC', `${deg(angle(B, A, C)).toFixed(1)}°`);
  },
});
