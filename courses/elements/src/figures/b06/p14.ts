import { figure } from '../../geometry/figure';
import { add, area, dist, mul, sub } from '../../geometry/vec';

// Two equiangular parallelograms AB (A, F, B, D) and BC (B, E, C, G) with DB, BE in one line and
// FB, BG in one line. The slider k = BE : DB; GB is then made BF : k, so the two are equal.
export default figure({
  build(g) {
    const B = g.free('B', 0, 0);
    const D = g.free('D', -1.6, 0);
    const F = g.free('F', 0.45, 1.3);
    const k = g.param('k', 1.4, { min: 0.5, max: 2, label: 'BE : DB' });
    const A = g.point('A', add(D, sub(F, B)));
    const E = g.point('E', add(B, mul(sub(B, D), k)));
    const G = g.point('G', add(B, mul(sub(B, F), 1 / k)));
    const C = g.point('C', add(E, sub(G, B)));
    const X = add(F, sub(E, B));
    g.polygon([A, F, B, D], { fill: true });
    g.polygon([B, E, C, G], { fill: true });
    g.polygon([F, B, E, X], { aux: true });
    g.equal('▱AB = ▱BC', area([A, F, B, D]), area([B, E, C, G]));
    g.equal('DB : BE = GB : BF', dist(D, B) / dist(B, E), dist(G, B) / dist(B, F));
  },
});
