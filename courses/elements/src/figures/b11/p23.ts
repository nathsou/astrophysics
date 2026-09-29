import { figure } from '../../geometry/figure';
import { angle, cc, circumcircle, deg, dist, v } from '../../geometry/vec';
import { add, mul, sub, v3, Z3, type V } from './lib';

// Build a solid angle out of three given plane angles (any two exceeding the third, all three less
// than four right angles). The chords AC, DF, GK form the triangle LMN; O is the centre of its
// circle, and R stands above O with RL equal to the arms AB.
export default figure({
  dim: 3,
  camera: { yaw: -0.15, pitch: -0.42 },
  unresolved: {
    ABC: 'as a semicircle: the lemma reuses the letters A, B, C for a separate diagram (a semicircle on AB)',
    ACB: 'as a semicircle: the lemma reuses the letters A, B, C for a separate diagram',
  },
  build(g) {
    const a = g.param('a', 75, { min: 50, max: 110, label: 'angle ABC (°)' });
    const b = g.param('b', 60, { min: 50, max: 110, label: 'angle DEF (°)' });
    const t = g.param('t', 0.4, { min: 0.1, max: 0.9, label: 'angle GHK (between the limits)' });
    const lo = Math.abs(a - b);
    const c = lo + t * (Math.min(a + b, 350 - a - b) - lo);
    const r = 1;
    const rad = Math.PI / 180;
    // the three given angles, laid out behind
    const up = (phi: number) => v3(Math.cos(phi), 0, Math.sin(phi));
    const fan = (V0: V, ang: number): [V, V] => [add(V0, mul(up(Math.PI / 2 + (ang * rad) / 2), r)), add(V0, mul(up(Math.PI / 2 - (ang * rad) / 2), r))];
    const B = g.point('B', v3(-2, 1.4, 0.4));
    const [A0, C0] = fan(B, a);
    const A = g.point('A', A0);
    const C = g.point('C', C0);
    const E = g.point('E', v3(0, 1.4, 0.4));
    const [D0, F0] = fan(E, b);
    const D = g.point('D', D0);
    const F = g.point('F', F0);
    const H = g.point('H', v3(2, 1.4, 0.4));
    const [G0, K0] = fan(H, c);
    const Gp = g.point('G', G0);
    const K = g.point('K', K0);
    for (const [x, y, z] of [[A, B, C], [D, E, F], [Gp, H, K]]) {
      g.path(x, y, z);
      g.segment(x, z, { aux: true });
      g.angle(x, y, z);
    }
    const ac = dist(A, C);
    const df = dist(D, F);
    const gk = dist(Gp, K);
    // the triangle LMN with LM = AC, MN = DF, NL = GK (XI.22), placed with its centre O in front
    const l2 = v(0, 0);
    const m2 = v(ac, 0);
    const [, n2] = cc({ c: l2, r: gk }, { c: m2, r: df });
    const k = circumcircle(l2, m2, n2);
    const at = (p: V) => v3(p.x - k.c.x, p.y - k.c.y - 0.6, 0);
    const L = g.point('L', at(l2));
    const M = g.point('M', at(m2));
    const N = g.point('N', at(n2));
    const O = g.point('O', at(k.c));
    g.circle3(O, Z3, k.r, { aux: true });
    const lo2 = k.r;
    const R = g.point('R', add(O, mul(Z3, Math.sqrt(Math.max(0, r * r - lo2 * lo2)))));
    // the impossible case AB < LO: P, Q on OL, OM with OP = OQ = AB (here they fall beyond L, M)
    g.point('P', add(O, mul(sub(L, O), r / lo2)), { hidden: true });
    g.point('Q', add(O, mul(sub(M, O), r / lo2)), { hidden: true });
    g.polygon([L, M, N]);
    g.segment(L, O, { aux: true });
    g.segment(M, O, { aux: true });
    g.segment(N, O, { aux: true });
    g.segment(O, R, { aux: true });
    g.polygon([R, L, M], { fill: true });
    g.polygon([R, M, N], { fill: true });
    g.polygon([R, N, L], { fill: true });
    g.claim('AB > LO (because the three angles are less than 360°)', r > lo2);
    g.equal('RL = AB', dist(R, L), r);
    g.equal('∠LRM = ∠ABC', deg(angle(L, R, M)), a);
    g.equal('∠MRN = ∠DEF', deg(angle(M, R, N)), b);
    g.equal('∠NRL = ∠GHK', deg(angle(N, R, L)), deg(angle(Gp, H, K)));
  },
});
