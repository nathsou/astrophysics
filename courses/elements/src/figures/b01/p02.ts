import { figure } from '../../geometry/figure';
import { add, cc, dist, mid, mul, polar, rot, sub, unit } from '../../geometry/vec';

// I.2: copy the length BC to the point A, using only the compass that collapses when lifted.
export default figure({
  build(g) {
    const A = g.free('A', -1.3, 0.1);
    const B = g.free('B', 0.4, 0);
    const C = g.free('C', 1.5, -1.1);
    g.segment(B, C);
    g.segment(A, B);
    // the equilateral triangle DAB on AB (I.1), D on the left of A→B
    const D = g.point('D', cc({ c: A, r: dist(A, B) }, { c: B, r: dist(A, B) })[0]);
    g.path(A, D, B);
    const r = dist(B, C);
    const G = g.point('G', add(B, mul(unit(sub(B, D)), r)));
    const R = dist(D, G);
    const L = g.point('L', add(D, mul(unit(sub(A, D)), R)));
    // E and F: the far ends of DA and DB produced
    const E = g.point('E', add(D, mul(unit(sub(A, D)), R * 1.22)));
    const F = g.point('F', add(D, mul(unit(sub(B, D)), R * 1.22)));
    g.segment(A, E);
    g.segment(B, F);
    const k1 = g.circle(B, C, { aux: true });
    const k2 = g.circle(D, G, { aux: true });
    // H and K only name the circles: points on them away from the construction
    const down = unit(sub(mid(A, B), D));
    g.point('H', add(B, mul(rot(unit(sub(G, B)), 2.2), k1.r)));
    g.point('K', polar(D, k2.r, Math.atan2(down.y, down.x)));
        g.equal('AL = BC', dist(A, L), dist(B, C));
    g.equal('BG = BC', dist(B, G), r);
  },
});

