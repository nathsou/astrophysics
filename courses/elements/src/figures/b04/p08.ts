import { figure } from '../../geometry/figure';
import { add, dist, foot, ll, mid, squareOn, sub } from '../../geometry/vec';

// The circle inscribed in a square: the lines joining the midpoints of opposite sides meet at the centre G.
export default figure({
  build(g) {
    const A = g.free('A', -1.7, 1.6);
    const B = g.free('B', -1.6, -1.7);
    const [, , c, d] = squareOn(A, B);
    const C = g.point('C', c);
    const D = g.point('D', d);
    g.polygon([A, B, C, D]);
    const E = g.point('E', mid(A, D));
    const F = g.point('F', mid(A, B));
    const H = g.point('H', ll(E, add(E, sub(B, A)), B, C));
    const K = g.point('K', ll(F, add(F, sub(D, A)), C, D));
    const G = g.point('G', ll(E, H, F, K));
    g.segment(E, H);
    g.segment(F, K);
    g.polygon([A, F, K, D], { name: 'AK', aux: true });
    g.polygon([F, B, C, K], { name: 'KB', aux: true });
    g.polygon([A, B, H, E], { name: 'AH', aux: true });
    g.polygon([E, H, C, D], { name: 'HD', aux: true });
    g.polygon([A, F, G, E], { name: 'AG', aux: true });
    g.polygon([G, H, C, K], { name: 'GC', aux: true });
    g.polygon([F, B, H, G], { name: 'BG', aux: true });
    g.polygon([E, G, K, D], { name: 'GD', aux: true });
    g.circle(G, E);
    g.equal('GE = GF', dist(G, E), dist(G, F));
    g.equal('GH = GK', dist(G, H), dist(G, K));
    g.equal('GE = GH', dist(G, E), dist(G, H));
    g.equal('GE ⟂ AD (the circle touches AD at E)', dist(foot(G, A, D), E), 0);
  },
});
