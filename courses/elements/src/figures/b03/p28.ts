import { figure } from '../../geometry/figure';
import { cc, dist } from '../../geometry/vec';
import { arcLen, ccw, dirOf, need, onC } from './lib';

// In equal circles, equal chords cut off equal arcs, the greater equal to the greater and the less
// to the less. A, B and D glide; E is where the circle about D with radius AB meets DEF, so DE = AB.
export default figure({
  build(g) {
    const r = g.param('r', 1.5, { min: 1, max: 2, label: 'radius of both circles' });
    const K = g.free('K', -2.1, 0);
    const L = g.free('L', 2.1, 0);
    need(dist(K, L) > 2 * r + 0.1, 'the circles apart');
    const k1 = g.circle(K, r, { name: 'ABC' });
    const k2 = g.circle(L, r, { name: 'DEF' });
    const rad = Math.PI / 180;
    const A = g.glider('A', k1, 205 * rad);
    const B = g.glider('B', k1, 325 * rad);
    const th = ccw(dirOf(K, A), dirOf(K, B));
    need(th > 0.1 && th < Math.PI - 0.1, 'AGB the lesser arc');
    const D = g.glider('D', k2, 230 * rad);
    // of the two points of DEF at distance AB from D, the one reached counter-clockwise
    const [p, q] = cc(k2, { c: D, r: dist(A, B) });
    const E = g.point('E', ccw(dirOf(L, D), dirOf(L, p)) < Math.PI ? p : q);
    g.point('G', onC(k1, dirOf(K, A) + th / 2));
    g.point('C', onC(k1, dirOf(K, A) + th / 2 + Math.PI));
    g.point('H', onC(k2, dirOf(L, D) + th / 2));
    g.point('F', onC(k2, dirOf(L, D) + th / 2 + Math.PI));
    g.arc(K, B, A, { name: 'ACB' });
    g.arc(K, A, B, { name: 'AGB' });
    g.arc(L, E, D, { name: 'DFE' });
    g.arc(L, D, E, { name: 'DHE' });
    g.segment(A, B);
    g.segment(D, E);
    g.path(A, K, B, { aux: true });
    g.path(D, L, E, { aux: true });
    g.equal('AB = DE', dist(A, B), dist(D, E));
    g.equal('arc AGB = arc DHE', arcLen(k1, A, B), arcLen(k2, D, E));
    g.equal('arc ACB = arc DFE', arcLen(k1, B, A), arcLen(k2, E, D));
  },
});
