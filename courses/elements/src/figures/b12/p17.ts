import { figure } from '../../geometry/figure';
import { add, cross, dist, dot, mul, sub, unit, type V } from '../../geometry/vec';
import { globe, planeDist, v3 } from './lib';

// Spheres about the centre A. BCDE is a great circle of the greater sphere and FGH one of the
// lesser; BD, CE are perpendicular diameters. BK, KL, LM, ME are sides of the polygon of XII.16 in
// the quadrant BE (sixteen sides in all); O is the pole. The quadrants BO, KO are divided in the
// same way at P, Q, R and S, T, U, and the quadrilaterals KBPS, SPQT, TQRU and the triangle URO are
// faces of the inscribed polyhedron. X is the foot of the perpendicular from A to the plane KBPS,
// and Z the foot of the perpendicular from K to BD.
export default figure({
  dim: 3,
  camera: { yaw: 1.4, pitch: 0.5 },
  build(g) {
    const q = g.param('q', 0.72, { min: 0.4, max: 0.9, label: 'lesser ÷ greater sphere' });
    const whole = g.param('whole', 1, { min: 0, max: 1, label: 'draw the whole polyhedron' });
    const Rr = 2;
    const r = q * Rr;
    const A = g.point('A', v3(0, 0, 0));
    const eq = (t: number, rad = Rr) => v3(rad * Math.cos(t), rad * Math.sin(t), 0);
    const deg = Math.PI / 180;
    const B = g.point('B', eq(180 * deg), { labelDir: 235 });
    g.point('C', eq(270 * deg));
    const D = g.point('D', eq(0));
    g.point('E', eq(90 * deg));
    const K = g.point('K', eq(157.5 * deg));
    g.point('L', eq(135 * deg));
    g.point('M', eq(112.5 * deg));
    const N = g.point('N', eq(-22.5 * deg));
    g.point('F', eq(240 * deg, r));
    const G = g.point('G', eq(168.75 * deg, r));
    g.point('H', eq(40 * deg, r));
    const O = g.point('O', v3(0, 0, Rr));
    // a point on the quarter meridian over the equator point e, at elevation j/4 of a right angle
    const up = (e: V, j: number) => add(mul(e, Math.cos((j * Math.PI) / 8)), v3(0, 0, Rr * Math.sin((j * Math.PI) / 8)));
    const P = g.point('P', up(B, 1));
    const Q = g.point('Q', up(B, 2));
    const R = g.point('R', up(B, 3));
    const S = g.point('S', up(K, 1));
    const T = g.point('T', up(K, 2));
    const U = g.point('U', up(K, 3));
    const Vv = g.point('V', v3(P.x, P.y, 0), { labelDir: 290 });
    const W = g.point('W', v3(S.x, S.y, 0));
    // X: the foot of the perpendicular from A on the plane KBPS
    const nrm = unit(cross(sub(B, K), sub(S, K)));
    const X = g.point('X', mul(nrm, dot(K, nrm)));
    const Z = g.point('Z', v3(K.x, 0, 0), { labelDir: 10 });
    g.sphere(A, Rr, { name: 'BCDE' });
    g.sphere(A, r, { aux: true, dashed: true });
    const zUp = v3(0, 0, 1);
    g.circle3(A, zUp, Rr);
    g.circle3(A, zUp, r, { aux: true });
    // the semicircles BOD and KON
    const semi = (e: V) => Array.from({ length: 49 }, (_, i) => add(mul(e, Math.cos((i * Math.PI) / 48)), v3(0, 0, Rr * Math.sin((i * Math.PI) / 48))));
    g.curve(semi(B));
    g.curve(semi(K));
    // the polygon of sixteen sides in the circle BCDE
    const glb = globe(A, Rr, 4);
    g.polygon(Array.from({ length: 16 }, (_, i) => glb.P(i, 0)), { aux: true });
    if (whole >= 0.5) {
      // the rest of the upper half of the polyhedron, as a wireframe
      for (let i = 0; i < 16; i++) g.curve([0, 1, 2, 3, 4].map((j) => glb.P(i, j)), { aux: true });
      for (let j = 1; j < 4; j++) g.curve(Array.from({ length: 16 }, (_, i) => glb.P(i, j)), { aux: true, closed: true });
    }
    g.polygon([K, B, P, S], { fill: true });
    g.polygon([S, P, Q, T], { fill: true });
    g.polygon([T, Q, R, U], { fill: true });
    g.polygon([U, R, O], { fill: true });
    g.segment(B, D, { aux: true });
    g.segment(K, N, { aux: true });
    g.segment(A, O, { aux: true });
    g.segment(P, Vv, { aux: true });
    g.segment(S, W, { aux: true });
    g.segment(W, Vv, { aux: true });
    g.segment(A, X, { colour: 'red' });
    g.segment(X, B, { aux: true });
    g.segment(X, K, { aux: true });
    g.segment(K, Z, { aux: true });
    g.segment(A, G, { colour: 'blue' });
    // claims
    g.claim('KBPS is in one plane', planeDist(S, K, B, P) < 1e-9);
    g.equal('BX = XK', dist(B, X), dist(X, K));
    g.equal('XP = XS = XB', dist(X, P) + dist(X, S), 2 * dist(X, B));
    g.claim('KB > SP', dist(K, B) > dist(S, P));
    g.claim('□KB > 2 □BX', dist(K, B) ** 2 > 2 * dist(B, X) ** 2);
    g.claim('□KZ > □BX', dist(K, Z) ** 2 > dist(B, X) ** 2);
    g.claim('AX > AZ > AG', dist(A, X) > dist(A, Z) && dist(A, Z) > dist(A, G));
    const faces = [
      [K, B, P, S],
      [S, P, Q, T],
      [T, Q, R, U],
    ];
    const least = Math.min(...faces.map((f) => planeDist(A, f[0], f[1], f[2])), planeDist(A, U, R, O));
    g.show('least distance from A to a face ÷ AG', (least / r).toFixed(4));
    g.claim('no face touches the lesser sphere', least > r);
    g.show('polyhedron ÷ greater sphere', (glb.vol / ((4 / 3) * Math.PI * Rr ** 3)).toFixed(4));
  },
});
