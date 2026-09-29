import { figure } from '../../geometry/figure';
import { cc, dist, polar, rad, v, type V } from '../../geometry/vec';

// Three angles, any two greater than the third, with equal arms: the chords AC, DF, GK satisfy the
// triangle inequality. At H the angle KHL is made equal to ABC, with HL equal to the arms.
export default figure({
  build(g) {
    const a = g.param('a', 60, { min: 30, max: 80, label: 'angle ABC (°)' });
    const b = g.param('b', 45, { min: 30, max: 80, label: 'angle DEF (°)' });
    const t = g.param('t', 0.55, { min: 0.15, max: 0.85, label: 'angle GHK (between the limits)' });
    const lo = Math.abs(a - b);
    const c = lo + t * (Math.min(a + b, 95) - lo);
    const r = 1.5;
    const fan = (V0: V, dir: number, ang: number) => [polar(V0, r, rad(dir + ang / 2)), polar(V0, r, rad(dir - ang / 2))];
    const B = g.point('B', v(-3.6, 0));
    const [A0, C0] = fan(B, 90, a);
    const A = g.point('A', A0);
    const C = g.point('C', C0);
    const E = g.point('E', v(-0.9, 0));
    const [D0, F0] = fan(E, 90, b);
    const D = g.point('D', D0);
    const F = g.point('F', F0);
    const H = g.point('H', v(1.8, 0));
    const K = g.point('K', polar(H, r, rad(70)));
    const Gp = g.point('G', polar(H, r, rad(70 + c)));
    const L = g.point('L', polar(H, r, rad(70 - a)));
    g.path(A, B, C);
    g.path(D, E, F);
    g.path(Gp, H, K);
    g.segment(H, L, { aux: true });
    g.angle(A, B, C);
    g.angle(D, E, F);
    g.angle(Gp, H, K);
    g.segment(A, C, { colour: 'red' });
    g.segment(D, F, { colour: 'blue' });
    g.segment(Gp, K, { colour: 'yellow' });
    g.segment(K, L, { aux: true });
    g.segment(Gp, L, { aux: true });
    const ac = dist(A, C);
    const df = dist(D, F);
    const gk = dist(Gp, K);
    // the triangle out of AC, DF, GK, set out below
    const P = v(-0.6, -2.4);
    const Q = v(-0.6 + ac, -2.4);
    const [R] = cc({ c: P, r: gk }, { c: Q, r: df });
    g.polygon([P, Q, R], { fill: true, aux: true });
    g.equal('KL = AC', dist(K, L), ac);
    g.claim('GL > DF', dist(Gp, L) > df);
    g.claim('AC + GK > DF, AC + DF > GK, DF + GK > AC', ac + gk > df && ac + df > gk && df + gk > ac);
  },
});
