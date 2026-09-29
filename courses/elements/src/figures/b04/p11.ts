import { figure } from '../../geometry/figure';
import { angle, deg, dist, v } from '../../geometry/vec';
import { angles, bisectorMeets, goldenTriangle, inscribeEquiangular, sides } from './lib';

// The inscribed regular pentagon. FGH is a golden triangle (IV.10); ACD is inscribed equiangular
// with it (IV.2); the bisectors of the base angles give E and B.
export default figure({
  build(g) {
    const k = g.circle(v(0, 0), 2);
    const A = g.glider('A', k, Math.PI / 2);
    const F = g.free('F', 4.3, 1.7);
    const G = g.free('G', 3.5, -1.2);
    const H = g.point('H', goldenTriangle(F, G).D);
    g.polygon([F, G, H]);
    const t = inscribeEquiangular(k, A, angle(F, G, H), angle(F, H, G));
    const C = g.point('C', t.left);
    const D = g.point('D', t.right);
    const E = g.point('E', bisectorMeets(k, A, C, D));
    const B = g.point('B', bisectorMeets(k, A, D, C));
    g.polygon([A, C, D], { aux: true });
    g.segment(C, E, { aux: true });
    g.segment(D, B, { aux: true });
    const P = [A, B, C, D, E];
    g.polygon(P);
    g.angle(C, A, D);
    g.angle(G, F, H);
    const s = sides(P);
    const a = angles(P).map(deg);
    g.equal('∠CAD = ∠F', deg(angle(C, A, D)), deg(angle(G, F, H)));
    g.equal('AB = BC', s[0], s[1]);
    g.equal('CD = DE', s[2], s[3]);
    g.equal('DE = EA', s[3], s[4]);
    g.equal('AB = CD', s[0], s[2]);
    g.equal('∠BAE = ∠AED', a[0], a[4]);
    g.equal('∠ABC = ∠BCD', a[1], a[2]);
    g.equal('∠BCD = ∠CDE', a[2], a[3]);
    g.equal('∠BAE = ∠ABC', a[0], a[1]);
    g.equal('each angle = 108°', a[0], 108);
    void dist;
  },
});
