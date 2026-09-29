import { figure } from '../../geometry/figure';
import { add, area3, boxVolume, drawBox, mul, sph, v3, X3, type V } from './lib';

// Parallelepipeds of the same height are to one another as their bases. A parallelogram FH equal to
// the base AE is applied to FG, the solid GK is completed on it, and XI.25 and XI.31 do the rest.
export default figure({
  dim: 3,
  camera: { yaw: -0.3, pitch: -0.4 },
  build(g) {
    const gam = g.param('gam', 1.25, { min: 0.9, max: 1.9, label: 'angle of the base AE' });
    const ae1 = g.param('ae1', 1.3, { min: 0.8, max: 1.8, label: 'side of AE' });
    const lean = g.param('lean', 0.4, { min: -0.4, max: 0.8, label: 'lean of AB' });
    const h = 1.4;
    const P = (n: string, p: V) => g.point(n, p);
    // the solid AB on the base AE
    const A = P('A', v3(-3.2, -0.4, 0));
    const f1 = mul(X3, ae1);
    const f2 = mul(sph(gam), 1.1);
    const sAB = [A, add(A, f1), add(add(A, f1), f2), add(A, f2)];
    P('E', sAB[2]);
    const t2 = v3(lean, 0.2, h);
    const topAB = sAB.map((p) => add(p, t2));
    P('B', topAB[2]);
    // the solid CD on the base CF (C G F ·); FH, equal to AE, applied to FG
    const C = P('C', v3(-0.6, -0.5, 0));
    const e1 = mul(X3, 1.2);
    const e2 = mul(sph(1.35), 1.2);
    const Gp = P('G', add(C, e1));
    const F = P('F', add(Gp, e2));
    const C2 = add(C, e2);
    const areaAE = area3(sAB);
    const areaCF = area3([C, Gp, F, C2]);
    const H = P('H', add(Gp, mul(e1, areaAE / areaCF)));
    const H2 = add(H, e2);
    const t = v3(-0.2, 0.25, h);
    const D = P('D', add(F, t));
    P('K', add(H, t));
    const sCD = [C, Gp, F, C2, ...[C, Gp, F, C2].map((p) => add(p, t))];
    const sGK = [Gp, H, H2, F, ...[Gp, H, H2, F].map((p) => add(p, t))];
    drawBox(g, [...sAB, ...topAB]);
    drawBox(g, sCD);
    drawBox(g, sGK, { aux: true });
    g.polygon(sAB, { fill: true, name: 'AE' });
    g.polygon([C, Gp, F, C2], { fill: true, name: 'CF' });
    g.polygon([Gp, H, H2, F], { fill: true, name: 'FH' });
    g.polygon([Gp, F, D, add(Gp, t)], { fill: true, aux: true, name: 'DG' });
    const vAB = boxVolume([...sAB, ...topAB]);
    g.equal('base FH = base AE', area3([Gp, H, H2, F]), areaAE);
    g.equal('solid GK = solid AB', boxVolume(sGK), vAB);
    g.equal('AB : CD = base AE : base CF', vAB / boxVolume(sCD), areaAE / areaCF);
  },
});
