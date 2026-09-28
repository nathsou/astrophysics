import { figure } from '../../geometry/figure';
import { add, dist, lc, ll, mid, perp, sub, v } from '../../geometry/vec';
import { need } from './lib';

// A point inside a circle from which three equal lines fall on the circle is its centre: it lies
// on the perpendicular bisectors GK of AB and HL of BC, which meet only at the centre.
export default figure({
  build(g) {
    const D = g.point('D', v(0, 0));
    const k = g.circle(D, 2, { name: 'ABC' });
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 165 * rad);
    const B = g.glider('B', k, 75 * rad);
    const C = g.glider('C', k, -20 * rad);
    need(dist(A, B) > 0.3 && dist(B, C) > 0.3 && dist(A, C) > 0.3, 'three distinct points');
    const E = g.point('E', mid(A, B));
    const F = g.point('F', mid(B, C));
    // the perpendicular bisectors, carried through to the circle: G, H on the side of E, F
    const [g1, k1] = lc(E, D, k);
    const [h1, l1] = lc(F, D, k);
    g.points({ G: g1, K: k1, H: h1, L: l1 });
    g.path(A, B, C);
    for (const P of [A, B, C]) g.segment(D, P);
    g.segment(g1, k1, { aux: true });
    g.segment(h1, l1, { aux: true });
    g.angle(A, E, D, { right: true });
    g.angle(B, F, D, { right: true });
    const X = ll(E, add(E, perp(sub(B, A))), F, add(F, perp(sub(C, B))));
    g.equal('the bisectors meet at D', dist(X, D), 0);
    g.equal('DA = DB = DC', dist(D, A), dist(D, C));
  },
});
