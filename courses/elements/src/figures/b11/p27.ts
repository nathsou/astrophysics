import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { add, box, boxVolume, drawBox, mul, named, rotZ, sph, v3, type V } from './lib';

// On a given line AB, describe a parallelepiped similar and similarly situated to a given one CD.
// The solid angle at A is made equal to the one at C (XI.26), and the edges are made proportional:
// EC : CG = BA : AK and GC : CF = KA : AH.
export default figure({
  dim: 3,
  camera: { yaw: -0.35, pitch: -0.35 },
  build(g) {
    const ab = g.param('ab', 2, { min: 1.2, max: 2.6, label: 'AB' });
    const gam = g.param('gam', 1.3, { min: 0.9, max: 1.9, label: 'angle ECG' });
    const lean = g.param('lean', 0.3, { min: -0.3, max: 0.6, label: 'lean of CF' });
    const turn = g.param('turn', 0.5, { min: -0.3, max: 1.2, label: 'turn of the copy' });
    const ce = 1.6;
    const cg = 1.1;
    const cf = 1.2;
    const e = mul(sph(-0.2), ce);
    const gv = mul(sph(-0.2 + gam), cg);
    const f = v3(lean, 0.15, cf);
    // the given solid CD: vertex C, edges CE, CG, CF; D is the opposite vertex
    const Cb = box(v3(-3.2, 0, 0), e, gv, f);
    const [C, E, , Gp, F, , D] = named(g, ['C', 'E', '', 'G', 'F', '', 'D'], Cb);
    drawBox(g, Cb);
    // the copy: the same directions turned about the vertical, scaled by k = AB : CE
    const k = ab / ce;
    const tr = (w: V) => mul(rotZ(w, turn), k);
    const Ab = box(v3(0.8, -0.2, 0), tr(e), tr(gv), tr(f));
    const [A, B, , K, H, , L] = named(g, ['A', 'B', '', 'K', 'H', '', 'L'], Ab);
    drawBox(g, Ab);
    const face = (bx: V[], ids: number[], name: string) => g.polygon(ids.map((i) => bx[i]), { fill: true, name });
    face(Cb, [0, 1, 2, 3], 'GE');
    face(Cb, [0, 3, 7, 4], 'GF');
    face(Cb, [0, 1, 5, 4], 'FE');
    face(Ab, [0, 1, 2, 3], 'KB');
    face(Ab, [0, 3, 7, 4], 'KH');
    face(Ab, [0, 1, 5, 4], 'HB');
    g.equal('BA : AK = EC : CG', dist(B, A) / dist(A, K), dist(E, C) / dist(C, Gp));
    g.equal('KA : AH = GC : CF', dist(K, A) / dist(A, H), dist(Gp, C) / dist(C, F));
    g.equal('∠BAH = ∠ECF', deg(angle(B, A, H)), deg(angle(E, C, F)));
    g.equal('∠KAH = ∠GCF', deg(angle(K, A, H)), deg(angle(Gp, C, F)));
    g.show('solid AL : solid CD', (boxVolume(Ab) / boxVolume(Cb)).toFixed(3));
    void D;
    void L;
  },
});
