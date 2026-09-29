import { figure } from '../../geometry/figure';
import { dist, foot, polar, reflect, v } from '../../geometry/vec';

// Circles ABCD and EFGH about the centre K. AC touches the lesser circle at G, at right angles to
// the diameter BD. Halving the semicircle BAD again and again leaves an arc LD less than AD; the
// chord LD, fitted round the greater circle, gives an equilateral polygon with an even number of
// sides that does not touch the lesser circle.
export default figure({
  build(g) {
    const q = g.param('q', 0.6, { min: 0.4, max: 0.97, label: 'EFGH ÷ ABCD (radii)' });
    const R = 2;
    const r = q * R;
    const K = g.point('K', v(0, 0));
    const B = g.point('B', v(-R, 0));
    const D = g.point('D', v(R, 0));
    g.circle(K, R);
    g.circle(K, r);
    g.point('E', polar(K, r, Math.PI / 2));
    g.point('F', polar(K, r, Math.PI));
    const G = g.point('G', v(r, 0));
    g.point('H', polar(K, r, -Math.PI / 2));
    const tA = Math.acos(q);
    const A = g.point('A', polar(K, R, tA));
    const C = g.point('C', polar(K, R, -tA));
    // halve the arc from D until it is less than the arc AD
    let j = 0;
    while (Math.PI / 2 ** j >= tA) j++;
    const tL = Math.PI / 2 ** j;
    const L = g.point('L', polar(K, R, tL));
    const M = g.point('M', foot(L, B, D));
    const N = g.point('N', reflect(L, B, D));
    g.segment(B, D);
    g.segment(A, C);
    g.segment(L, N, { aux: true });
    g.segment(L, D, { colour: 'red' });
    g.segment(D, N, { colour: 'red' });
    const n = 2 ** (j + 1);
    const poly = Array.from({ length: n }, (_, i) => polar(K, R, i * tL));
    g.polygon(poly, { aux: true });
    g.show('halvings of the semicircle', j);
    g.show('sides of the polygon', n);
    g.equal('LD = DN', dist(L, D), dist(D, N));
    g.equal('AC touches EFGH at G', dist(K, G), r);
    g.claim('arc LD < arc AD', tL < tA);
    // the distance from K to the side LD is the least distance from K to the polygon
    const apothem = dist(K, foot(K, L, D));
    g.claim('the side LD does not touch the lesser circle', apothem > r);
    g.claim('KM > KG', dist(K, M) > dist(K, G));
  },
});
