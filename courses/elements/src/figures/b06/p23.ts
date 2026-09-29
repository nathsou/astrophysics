import { figure } from '../../geometry/figure';
import { add, area, dist, mul, sub, unit, v } from '../../geometry/vec';
import { rod } from './lib';

// Equiangular parallelograms AC (A, B, C, D) and CF (C, E, F, G), with BC, CG in one line and DC, CE
// in one line; DG (also called CH) completes the figure. The rods K, L, M are made so that
// K : L = BC : CG and L : M = DC : CE, so K : M is the ratio compounded of the ratios of the sides.
export default figure({
  build(g) {
    const C = g.free('C', 0, 0);
    const B = g.free('B', -2, 0);
    const D = g.free('D', 0.5, 1.4);
    const cg = g.param('CG', 1.4, { min: 0.5, max: 2.4 });
    const ce = g.param('CE', 0.8, { min: 0.4, max: 1.8 });
    const Gp = g.point('G', add(C, mul(unit(sub(C, B)), cg)));
    const E = g.point('E', add(C, mul(unit(sub(C, D)), ce)));
    const A = g.point('A', add(B, sub(D, C)));
    const F = g.point('F', add(E, sub(Gp, C)));
    const H = g.point('H', add(D, sub(Gp, C)));
    const pAC = [A, B, C, D];
    const pCF = [C, E, F, Gp];
    g.polygon(pAC, { fill: true });
    g.polygon(pCF, { fill: true });
    g.polygon([D, C, Gp, H], { aux: true });
    const k = 1;
    const l = (k * cg) / dist(B, C);
    const m = (l * ce) / dist(D, C);
    const base = v(Math.min(B.x, A.x, E.x) - 0.2, Math.min(E.y, B.y, F.y) - 0.9);
    rod(g, 'K', base, k, { colour: 'red' });
    rod(g, 'L', add(base, v(0, -0.45)), l, { colour: 'blue' });
    rod(g, 'M', add(base, v(0, -0.9)), m, { colour: 'yellow' });
    const compound = (dist(B, C) / cg) * (dist(D, C) / ce);
    g.equal('AC : CF = (BC : CG)·(DC : CE)', area(pAC) / area(pCF), compound);
    g.equal('AC : CF = K : M', area(pAC) / area(pCF), k / m);
  },
});
