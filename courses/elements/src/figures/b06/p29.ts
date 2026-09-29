import { figure } from '../../geometry/figure';
import { add, area, dist, mid, mul, perp, rot, sub, unit } from '../../geometry/vec';
import { similar } from './lib';

// Apply to AB a parallelogram equal to C and exceeding by a parallelogram similar to D.
// E bisects AB; BF = EBLF on EB is similar to D. GH (right) is similar to D and equal to BF + C; MN =
// FMON is a copy of it in the corner F, so its diameter FO passes through B. The answer is AO,
// exceeding by QP = BPOQ.
export default figure({
  build(g) {
    const A = g.free('A', -3, 0.4);
    const B = g.free('B', 0, 0.4);
    const phi = g.param('φ', 1.25, { min: 0.7, max: 1.57, label: 'angle of D' });
    const rho = g.param('ρ', 0.9, { min: 0.4, max: 1.2, label: 'sides of D' });
    const c = g.param('c', 1, { min: 0.2, max: 2.5, label: 'C : BF' });
    const e = unit(sub(B, A));
    const E = g.point('E', mid(A, B));
    const d2 = sub(B, E);
    const d1 = mul(rot(e, -phi), dist(E, B) * rho); // from F down to E
    const F = g.point('F', sub(E, d1));
    const L = g.point('L', add(F, d2));
    const el = [E, B, L, F];
    const aEL = area(el);
    const mu = Math.sqrt(1 + c);
    const M = g.point('M', add(F, mul(d2, mu)));
    const N = g.point('N', add(F, mul(d1, mu)));
    const O = g.point('O', add(add(F, mul(d2, mu)), mul(d1, mu)));
    const P = g.point('P', add(add(F, mul(d2, mu)), d1));
    const Q = g.point('Q', add(add(F, d2), mul(d1, mu)));
    const A2 = add(A, mul(d1, mu - 1)); // below A, level with N
    // the given figures, below the construction: C a triangle of area c·BF, D a parallelogram of the required shape
    const down = mul(perp(e), -1);
    const c0 = add(A2, mul(down, 0.45));
    const cs = Math.sqrt((2 * c * aEL) / 0.9);
    const pc = [c0, add(c0, mul(e, cs)), add(add(c0, mul(e, 0.3 * cs)), mul(down, 0.9 * cs))];
    const d0 = add(c0, mul(e, cs + 0.5));
    const pdU = mul(e, 0.8);
    const pdV = mul(d1, (-0.8 / dist(E, B)));
    const pd = [add(d0, pdV), add(add(d0, pdV), pdU), add(d0, pdU), d0].map((p) => add(p, mul(down, 0.8 * rho)));
    g.polygon(pc, { fill: true, name: 'C' });
    g.text(add(pc[0], mul(add(e, mul(down, 0.3)), 0.4 * cs)), 'C');
    g.polygon(pd, { fill: true, name: 'D' });
    g.text(mid(pd[0], pd[2]), 'D');
    // GH, similar to D and equal to BF + C, beside the figure
    const K = g.point('K', add(M, mul(e, 0.8)));
    const H = g.point('H', add(K, mul(d2, mu)));
    const G = g.point('G', add(K, mul(d1, mu)));
    const X = add(G, mul(d2, mu));
    g.polygon([G, K, H, X], { fill: true });
    // the main figure
    g.polygon(el);
    g.segment(A, P);
    g.polygon([F, M, O, N]);
    g.segment(F, O, { dashed: true });
    g.segment(L, Q, { aux: true });
    g.segment(A, A2, { aux: true });
    g.segment(A2, N, { aux: true });
    const gnomon = [L, M, O, N, E, B];
    g.polygon(gnomon, { fill: true, name: 'XWV' });
    g.polygon(gnomon, { aux: true, name: 'VWX' });
    const ao = [A, P, O, A2];
    g.polygon(ao, { fill: true });
    g.polygon([A, E, N, A2], { aux: true });
    g.polygon([E, B, Q, N], { aux: true });
    g.polygon([L, M, P, B], { aux: true });
    g.polygon([E, P, O, N], { aux: true });
    g.polygon([B, P, O, Q], { fill: true });
    g.equal('▱MN = BF + C', area([F, M, O, N]), aEL + area(pc));
    g.equal('gnomon XWV = C', area(gnomon), area(pc));
    g.equal('▱AN = ▱NB = ▱LP', area([A, E, N, A2]), area([L, M, P, B]));
    g.equal('▱AO = C', area(ao), area(pc));
    g.claim('QP ∼ D', similar([B, P, O, Q], [pd[3], pd[2], pd[1], pd[0]]) || similar([B, P, O, Q], pd));
  },
});
