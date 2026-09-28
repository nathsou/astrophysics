import { figure } from '../../geometry/figure';
import { along, dist, foot, v } from '../../geometry/vec';
import { degAt, need, onC } from './lib';

// The perpendicular AE to the diameter at its end A falls outside the circle, and no straight line
// can be squeezed between AE and the circumference. Drag F: however close FA comes to AE, the foot
// G of the perpendicular from the centre lies inside the circle, so FA enters it.
export default figure({
  build(g) {
    const D = g.point('D', v(0, 0));
    const k = g.circle(D, 2, { name: 'ABC' });
    const A = g.point('A', v(0, -2));
    const B = g.point('B', v(0, 2));
    const E = g.point('E', v(2.8, -2));
    const C = g.point('C', onC(k, (-20 * Math.PI) / 180));
    const F = g.free('F', 2.7, -0.45);
    need(dist(F, A) > 0.3, 'F away from A');
    const G = g.point('G', foot(D, F, A));
    need(dist(G, D) > 0.05, 'FA not through the centre');
    const H = g.point('H', along(D, G, 2));
    g.segment(A, B);
    g.segment(A, E);
    g.segment(F, A);
    g.segment(D, H);
    g.segment(C, A, { dashed: true });
    g.segment(D, C, { aux: true });
    g.angle(B, A, E, { right: true });
    g.angle(D, G, A, { right: true });
    g.claim('DG < DA: the line FA enters the circle', dist(D, G) < dist(D, A));
    g.equal('∠DAC = ∠ACD (not right)', degAt(D, A, C), degAt(A, C, D));
    g.show('∠FAE', `${degAt(F, A, E).toFixed(2)}°`);
  },
});
