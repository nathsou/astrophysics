import { figure } from '../../geometry/figure';
import { area3, box, boxVolume, drawBox, mul, named, prismVolume, sph, v3, add } from './lib';

// Parallelepipeds on the same base ACBL and of the same height, whose tops FDHM and GEKN lie
// between the same two lines FN and DK, are equal: the 3D shear, as in I.35.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: -0.35 },
  build(g) {
    const s = g.param('s', 0.55, { min: 0.15, max: 0.9, label: 'slide of the second top' });
    const lean = g.param('lean', -0.6, { min: -1.2, max: 0.2, label: 'lean of the first' });
    const gam = g.param('gam', 1.35, { min: 1, max: 1.8, label: 'angle of the base' });
    const h = 1.6;
    const p = mul(sph(gam), 1.3); // A → C
    const q = v3(2, 0, 0); // A → L
    const t1 = add(v3(0, 0, h), mul(q, lean / 2));
    const t2 = add(t1, mul(q, s));
    const o = v3(-1.6, -0.4, 0);
    const b1 = box(o, p, q, t1);
    const b2 = box(o, p, q, t2);
    const [A, C, B, L, F, D, H, M] = named(g, ['A', 'C', 'B', 'L', 'F', 'D', 'H', 'M'], b1);
    const [Gp, E, K, N] = named(g, ['G', 'E', 'K', 'N'], b2.slice(4));
    drawBox(g, b1);
    drawBox(g, [A, C, B, L, Gp, E, K, N], { aux: true });
    g.polygon([A, C, B, L], { fill: true, name: 'AB' });
    g.polygon([C, B, H, D], { name: 'CH', aux: true });
    g.polygon([C, B, K, E], { name: 'CK', aux: true });
    g.polygon([D, E, Gp, F], { fill: true, name: 'DG', aux: true });
    g.polygon([H, K, N, M], { fill: true, name: 'HN', aux: true });
    g.polygon([C, D, F, A], { name: ['CF', 'AD'], aux: true });
    g.polygon([B, H, M, L], { name: 'BM', aux: true });
    g.polygon([C, E, Gp, A], { name: 'CG', aux: true });
    g.polygon([B, K, N, L], { name: 'BN', aux: true });
    g.polygon([Gp, E, H, M], { fill: true });
    g.polygon([D, C, E], { fill: true, colour: 'red' });
    g.polygon([H, B, K], { fill: true, colour: 'red' });
    g.polygon([A, F, Gp], { fill: true, colour: 'blue' });
    g.polygon([M, L, N], { fill: true, colour: 'blue' });
    g.segment(F, N, { aux: true });
    g.segment(D, K, { aux: true });
    g.equal('△DCE = △HBK', area3([D, C, E]), area3([H, B, K]));
    g.equal('prism AFG-DCE = prism MLN-HBK', prismVolume([A, F, Gp], [C, D, E]), prismVolume([L, M, N], [B, H, K]));
    g.equal('solid CM = solid CN', boxVolume(b1), boxVolume(b2));
  },
});
