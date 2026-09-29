import { figure } from '../../geometry/figure';
import { lerp } from '../../geometry/vec';
import { add, dot, footLine, isParallel, mul, sph, sub, v3 } from './lib';

// Two lines parallel to a third (not in one plane with it) are parallel to each other.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.3 },
  build(g) {
    const el = g.param('el', 1.2, { min: 0.95, max: 1.45, label: 'slope of the lines' });
    const spread = g.param('spread', 0.9, { min: 0.4, max: 1.4, label: 'spread' });
    const s = g.param('s', 0.45, { min: 0.2, max: 0.8, label: 'G on EF' });
    const d = sph(0.5, el);
    const L = 2;
    const E0 = v3(0, 0.7, 0);
    const A0 = add(E0, mul(sph(Math.PI + 0.3 + spread / 3), 1.5));
    const C0 = add(E0, mul(sph(-0.2 - spread / 2), 1.5));
    const E = g.point('E', E0);
    const F = g.point('F', add(E0, mul(d, L)));
    const A = g.point('A', A0);
    const B = g.point('B', add(A0, mul(d, L)));
    const C = g.point('C', C0);
    const D = g.point('D', add(C0, mul(d, L)));
    g.polygon([E, F, B, A], { fill: true, aux: true });
    g.polygon([E, F, D, C], { fill: true, aux: true });
    g.segment(A, B, { colour: 'red' });
    g.segment(C, D, { colour: 'red' });
    g.segment(E, F, { colour: 'blue' });
    const Gp = g.point('G', lerp(E, F, s));
    const H = g.point('H', footLine(Gp, A, B));
    const K = g.point('K', footLine(Gp, C, D));
    g.polygon([H, Gp, K], { fill: true });
    g.angle(F, Gp, H, { right: true });
    g.angle(F, Gp, K, { right: true });
    g.equal('EF · GH = 0', dot(sub(F, E), sub(H, Gp)), 0);
    g.equal('EF · GK = 0', dot(sub(F, E), sub(K, Gp)), 0);
    g.equal('AB · HK = 0 (AB ⊥ plane HGK)', dot(sub(B, A), sub(K, H)), 0);
    g.claim('AB ∥ CD', isParallel(sub(B, A), sub(D, C)));
  },
});
