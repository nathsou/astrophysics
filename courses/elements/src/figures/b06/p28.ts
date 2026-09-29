import { figure } from '../../geometry/figure';
import { add, area, dist, mid, mul, perp, rot, sub, unit } from '../../geometry/vec';
import { similar } from './lib';

// Apply to AB a parallelogram equal to C and deficient by a parallelogram similar to D.
// E bisects AB; GB = EBFG on EB is similar to D, and HE = AEGH completes AG. KLMN (right) is similar
// to D and equal to the excess GB − C; GOQP is a copy of it in the corner G, so Q lies on the
// diameter GB. The answer is ST = ASQT, deficient by QB = SBRQ.
export default figure({
  build(g) {
    const A = g.free('A', -2.6, -0.4);
    const B = g.free('B', 1.8, -0.4);
    const phi = g.param('φ', 1.2, { min: 0.7, max: 1.57, label: 'angle of D' });
    const rho = g.param('ρ', 0.8, { min: 0.5, max: 1.3, label: 'sides of D' });
    const c = g.param('c', 0.6, { min: 0.1, max: 1, label: 'C : GB' });
    const e = unit(sub(B, A));
    const E = g.point('E', mid(A, B));
    const eb = sub(B, E);
    const w = mul(rot(e, phi), dist(E, B) * rho);
    const Gp = g.point('G', add(E, w));
    const F = g.point('F', add(B, w));
    const H = g.point('H', add(A, w));
    const gb = [E, B, F, Gp];
    const aGB = area(gb);
    const lam = Math.sqrt(1 - c);
    const O = g.point('O', add(Gp, mul(sub(E, Gp), lam)));
    const P = g.point('P', add(Gp, mul(sub(F, Gp), lam)));
    const Q = g.point('Q', add(Gp, mul(sub(B, Gp), lam)));
    const R = g.point('R', add(O, eb));
    const S = g.point('S', add(E, mul(eb, lam)));
    const T = g.point('T', add(A, sub(O, E)));
    // the given figures, below AB: C a triangle of area c·GB, D a parallelogram of the required shape
    const down = mul(perp(e), -1);
    const c0 = add(A, mul(down, 0.5));
    const cs = Math.sqrt((2 * c * aGB) / 1.1);
    const pc = [c0, add(c0, mul(e, cs)), add(add(c0, mul(e, 0.35 * cs)), mul(down, 1.1 * cs))];
    const d0 = add(add(A, mul(e, 2.8)), mul(down, 0.5 + 0.9 * rho * Math.sin(phi)));
    const pdU = mul(e, 0.9);
    const pdV = mul(rot(e, phi), 0.9 * rho);
    const pd = [d0, add(d0, pdU), add(add(d0, pdU), pdV), add(d0, pdV)];
    g.polygon(pc, { fill: true, name: 'C' });
    g.text(add(pc[0], mul(add(e, mul(down, 0.35)), 0.4 * cs)), 'C');
    g.polygon(pd, { fill: true, name: 'D' });
    g.text(add(d0, mul(add(pdU, pdV), 0.45)), 'D');
    // KLMN, similar to D and equal to GB − C, beside the figure
    const K = g.point('K', add(F, mul(e, 0.7)));
    const L = g.point('L', add(K, mul(sub(E, Gp), lam)));
    const M = g.point('M', add(L, mul(eb, lam)));
    const N = g.point('N', add(K, mul(eb, lam)));
    const klmn = [K, L, M, N];
    g.polygon(klmn, { fill: true });
    // the main figure
    g.polygon([A, E, Gp, H], { aux: true });
    g.polygon(gb);
    g.segment(Gp, B, { dashed: true });
    g.segment(O, R, { aux: true });
    g.segment(P, S, { aux: true });
    g.segment(T, O, { aux: true });
    const gnomon = [O, E, B, F, P, Q];
    g.polygon(gnomon, { fill: true, name: 'UWV' });
    g.polygon(gnomon, { aux: true, name: 'VWU' });
    g.polygon([O, Gp, P, Q], { aux: true });
    g.polygon([P, F, R, Q], { aux: true });
    g.polygon([O, Q, S, E], { aux: true });
    g.polygon([P, F, B, S], { aux: true });
    g.polygon([O, R, B, E], { aux: true });
    g.polygon([A, E, O, T], { aux: true });
    const st = [A, S, Q, T];
    g.polygon(st, { fill: true });
    g.polygon([S, B, R, Q], { fill: true });
    g.equal('▱KLMN = GB − C', area(klmn), aGB - area(pc));
    g.equal('gnomon UWV = C', area(gnomon), area(pc));
    g.equal('▱ST = C', area(st), area(pc));
    g.claim('QB ∼ D', similar([S, B, R, Q], pd));
    g.claim('C ≤ GB (the condition)', area(pc) <= aGB + 1e-9);
  },
});
