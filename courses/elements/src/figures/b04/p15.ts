import { figure } from '../../geometry/figure';
import { add, angle, cc, deg, dist, lc, sub } from '../../geometry/vec';
import { angles, sides } from './lib';

// The inscribed regular hexagon: the circle with centre D through the centre G cuts off E and C;
// EG and CG produced give B and F. Every side equals the radius.
export default figure({
  build(g) {
    const G = g.free('G', 0, 0);
    const A = g.free('A', -0.3, 2);
    const k = g.circle(G, A);
    const D = g.point('D', lc(A, G, k)[1]);
    const k2 = g.circle(D, G, { aux: true });
    const [e, c] = cc(k, k2);
    const E = g.point('E', e);
    const C = g.point('C', c);
    g.point('H', add(D, sub(D, G)));
    const B = g.point('B', lc(E, G, k)[1]);
    const F = g.point('F', lc(C, G, k)[1]);
    g.segment(A, D);
    g.segment(E, B);
    g.segment(C, F);
    const P = [A, B, C, D, E, F];
    g.polygon(P);
    g.angle(E, G, D);
    g.angle(D, G, C);
    const s = sides(P);
    const r = dist(G, A);
    s.forEach((x, i) => g.equal(`${'ABCDEF'[i]}${'BCDEFA'[i]} = radius`, x, r));
    const a = angles(P).map(deg);
    g.equal('∠EGD = 60°', deg(angle(E, G, D)), 60);
    g.equal('∠AFE = ∠FED', a[5], a[4]);
    g.equal('∠ABC = ∠BCD = 120°', a[1] + a[2], 240);
  },
});
