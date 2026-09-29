import { figure } from '../../geometry/figure';
import { angle, rotAbout, v } from '../../geometry/vec';

// Two equal circles, centres G and H. The arcs CK, KL are laid off equal to BC, and FM, MN equal to EF.
// The sliders set the arcs BC and EF (as angles at the centre, in radians).
export default figure({
  build(g) {
    const r = g.param('r', 1.6, { min: 0.8, max: 2, label: 'radius' });
    const al = g.param('α', 0.6, { min: 0.25, max: 0.95, label: 'arc BC (rad)' });
    const be = g.param('β', 0.42, { min: 0.25, max: 0.95, label: 'arc EF (rad)' });
    const G = g.point('G', v(-2.1, 0));
    const H = g.point('H', v(2.1, 0));
    const k1 = g.circle(G, r);
    const k2 = g.circle(H, r);
    const B = g.glider('B', k1, -0.9);
    const C = g.point('C', rotAbout(B, G, al));
    const K = g.point('K', rotAbout(C, G, al));
    const L = g.point('L', rotAbout(K, G, al));
    const A = g.glider('A', k1, Math.PI);
    const E = g.glider('E', k2, -0.7);
    const F = g.point('F', rotAbout(E, H, be));
    const M = g.point('M', rotAbout(F, H, be));
    const N = g.point('N', rotAbout(M, H, be));
    const D = g.glider('D', k2, Math.PI);
    g.arc(G, B, C, { colour: 'red' });
    g.arc(H, E, F, { colour: 'blue' });
    for (const P of [B, C, K, L]) g.segment(G, P, { aux: P !== B && P !== C });
    for (const P of [E, F, M, N]) g.segment(H, P, { aux: P !== E && P !== F });
    g.path(B, A, C);
    g.path(E, D, F);
    g.angle(B, G, C);
    g.angle(E, H, F);
    g.angle(B, A, C);
    g.angle(E, D, F);
    const arcBC = r * al;
    const arcEF = r * be;
    g.equal('arc BC : arc EF = ∠BGC : ∠EHF', arcBC / arcEF, angle(B, G, C) / angle(E, H, F));
    g.equal('arc BC : arc EF = ∠BAC : ∠EDF', arcBC / arcEF, angle(B, A, C) / angle(E, D, F));
    g.equal('∠BGL = 3·∠BGC', angle(B, G, L), 3 * angle(B, G, C));
    g.show('∠BGC in radians = arc BC : radius', (arcBC / r).toFixed(3));
  },
});
