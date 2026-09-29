import { figure } from '../../geometry/figure';
import { add, area, ll, sub } from '../../geometry/vec';

// The complements. ABCD is any parallelogram (A, B, D free), AC its diameter, and K glides on AC.
// Through K, EF is drawn parallel to AD and HG parallel to AB; EH and FG are the parallelograms
// about the diameter, BK and KD the complements.
export default figure({
  build(g) {
    const A = g.free('A', -2.1, 1.5);
    const B = g.free('B', -2.8, -1.3);
    const D = g.free('D', 2.4, 1.5);
    const C = g.point('C', add(B, sub(D, A)));
    const K = g.glider('K', [A, C], 0.4);
    const ad = sub(D, A);
    const ab = sub(B, A);
    const E = g.point('E', ll(K, add(K, ad), A, B));
    const F = g.point('F', ll(K, add(K, ad), D, C));
    const H = g.point('H', ll(K, add(K, ab), A, D));
    const G = g.point('G', ll(K, add(K, ab), B, C));
    g.polygon([B, G, K, E], { fill: true });
    g.polygon([K, F, D, H], { fill: true });
    g.polygon([A, E, K, H], { aux: true });
    g.polygon([K, G, C, F], { aux: true });
    g.polygon([A, B, C, D]);
    g.segment(A, C);
    g.equal('complement BK = complement KD', area([B, G, K, E]), area([K, F, D, H]));
    g.equal('△ABC = △ACD', area([A, B, C]), area([A, C, D]));
  },
});
