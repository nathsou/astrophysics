import { figure } from '../../geometry/figure';
import { add, dist, ll, mul, polar, sub, v } from '../../geometry/vec';
import { rod } from './lib';

// The fourth proportional HF to the magnitudes A, B, C (rods on the left): DG = A, GE = B, DH = C, EF ∥ GH.
export default figure({
  build(g) {
    const a = g.param('a', 1.2, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 0.8, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 1, { min: 0.4, max: 2, label: 'C' });
    const th = g.param('θ', 0.6, { min: 0.3, max: 1.3, label: 'angle EDF' });
    rod(g, 'A', v(-1.1, 1.9), a, { colour: 'red' });
    rod(g, 'B', v(-1.1, 1.5), b, { colour: 'blue' });
    rod(g, 'C', v(-1.1, 1.1), c, { colour: 'yellow' });
    const D = g.free('D', -1.2, -1);
    const e = polar(D, 1, 0);
    const f = polar(D, 1, th);
    const G = g.point('G', add(D, mul(sub(e, D), a)));
    const E = g.point('E', add(D, mul(sub(e, D), a + b)));
    const H = g.point('H', add(D, mul(sub(f, D), c)));
    const F = g.point('F', ll(E, add(E, sub(H, G)), D, H));
    g.segment(D, E);
    g.segment(D, F);
    g.segment(G, H);
    g.segment(E, F, { colour: 'red' });
    g.angle(E, D, F);
    g.equal('A : B = C : HF', a / b, c / dist(H, F));
  },
});
