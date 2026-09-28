import { figure } from '../../geometry/figure';
import { dist } from '../../geometry/vec';
import { add, box, boxVolume, drawBox, mul, named, sph, v3, type V } from './lib';

// Similar parallelepipeds are in the triplicate ratio (the cube) of corresponding sides. At the
// vertex E of AB, EK, EL, EM continue AE, GE, HE and equal CF, FN, FR; the solids EO, QL, KP
// interpolate between AB and KP (= CD) one edge at a time.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: -0.3 },
  build(g) {
    const k = g.param('k', 0.7, { min: 0.45, max: 0.9, label: 'CF : AE' });
    const gam = g.param('gam', 1.35, { min: 1, max: 1.8, label: 'angle AEG' });
    const lean = g.param('lean', 0.25, { min: -0.3, max: 0.5, label: 'lean of EH' });
    const ea = mul(sph(Math.PI), 1.5);
    const eg = mul(sph(Math.PI + gam), 1.2);
    const eh = v3(lean, 0.1, 1.2);
    const E = g.point('E', v3(0.3, 0.2, 0));
    const P = (n: string, p: V) => g.point(n, p);
    const A = P('A', add(E, ea));
    const Gp = P('G', add(E, eg));
    const H = P('H', add(E, eh));
    const ek = mul(ea, -k);
    const el = mul(eg, -k);
    const em = mul(eh, -k);
    const K = P('K', add(E, ek));
    const L = P('L', add(E, el));
    const M = P('M', add(E, em));
    P('B', add(add(E, eg), eh));
    P('O', add(add(add(E, eg), ek), eh));
    const Q = P('Q', add(add(E, ek), eh));
    const Pp = P('P', add(add(E, el), em));
    const sAB = box(E, ea, eg, eh);
    const sEO = box(E, eg, ek, eh);
    const sQL = box(E, ek, el, eh);
    const sKP = box(E, ek, el, em);
    drawBox(g, sAB);
    drawBox(g, sEO, { aux: true });
    drawBox(g, sQL, { aux: true });
    drawBox(g, sKP);
    // the given similar solid CD, at F: edges FC, FN, FR proportional to EA, EG, EH
    const Fp = v3(3.4, 1.4, 0);
    const [F, C, , N, R, , , D] = named(g, ['F', 'C', '', 'N', 'R', '', '', 'D'], box(Fp, mul(ea, k), mul(eg, k), mul(eh, k)));
    const sCD = box(Fp, mul(ea, k), mul(eg, k), mul(eh, k));
    drawBox(g, sCD);
    const face = (ps: V[], name: string, s = {}) => g.polygon(ps, { fill: true, aux: true, name, ...s });
    face([E, A, add(A, eg), Gp], 'AG');
    face([E, Gp, add(Gp, ek), K], 'GK');
    face([E, K, add(K, el), L], 'KL');
    face([E, K, add(K, em), M], 'KM');
    face([E, K, Q, H], 'QE');
    face([E, L, Pp, M], 'EP');
    face([F, C, add(C, mul(eg, k)), N], 'CN');
    face([F, C, add(C, mul(eh, k)), R], 'CR');
    face([F, N, D, R], 'DF');
    const vAB = boxVolume(sAB);
    const vEO = boxVolume(sEO);
    const vQL = boxVolume(sQL);
    const vKP = boxVolume(sKP);
    g.equal('AB : EO = EO : QL', vAB / vEO, vEO / vQL);
    g.equal('EO : QL = QL : KP', vEO / vQL, vQL / vKP);
    g.equal('solid KP = solid CD', vKP, boxVolume(sCD));
    g.equal('AB : CD = (AE : CF)³', vAB / boxVolume(sCD), (dist(A, E) / dist(C, F)) ** 3);
  },
});
