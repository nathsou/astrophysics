import { figure } from '../../geometry/figure';
import { add, cc, dist, lc, mid, mul, sub, unit, v, type V } from '../../geometry/vec';
import { pentagon } from './lib';

// The regular 15-gon: AC is a side of the inscribed equilateral triangle ACD (found, as in IV.15,
// with the circle about the far end of the diameter through A), AB a side of the inscribed
// pentagon (IV.11). The arc BC is 1/3 − 1/5 = 2/15 of the circle; E bisects it.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = g.circle(O, 2);
    const A = g.glider('A', k, Math.PI / 2);
    const Ap = lc(A, O, k)[1];
    const [d, c] = cc(k, { c: Ap, r: k.r });
    const C = g.point('C', c);
    const D = g.point('D', d);
    const B = g.point('B', pentagon(k, A)[1]);
    const E = g.point('E', add(O, mul(unit(sub(mid(B, C), O)), k.r)));
    g.polygon([A, C, D], { aux: true });
    g.segment(A, B);
    g.segment(B, E);
    g.segment(E, C);
    // fit chords equal to BE into the circle one after another (IV.1)
    const side = dist(B, E);
    const P: V[] = [A];
    for (let i = 1; i < 15; i++) P.push(cc(k, { c: P[i - 1], r: side })[0]);
    g.polygon(P, { aux: true });
    const last = cc(k, { c: P[14], r: side })[0];
    g.equal('BE = EC', dist(B, E), dist(E, C));
    g.equal('AC = √3 · radius (triangle side)', dist(A, C), Math.sqrt(3) * k.r);
    g.equal('AB = pentagon side', dist(A, B), 2 * k.r * Math.sin(Math.PI / 5));
    g.equal('15 chords BE close up at A', dist(last, A), 0);
    g.equal('the third chord ends at B', dist(P[3], B), 0);
  },
});
