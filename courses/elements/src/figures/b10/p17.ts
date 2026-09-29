import { figure } from '../../geometry/figure';
import { deficientApplication, Lines } from './lib';

// BD : DC = p : q (commensurable). A is the line with (A/2)² = BD·DC: the rectangle BD·DC (shaded)
// is applied to BC falling short by the square on DC (dashed). Then BC² = A² + DF², and DF is
// commensurable with BC.
export default figure({
  caption: 'BD : DC = p : q. The shaded rectangle BD·DC equals the square on half of A, and falls short of BC by the dashed square. DF = BD − DC, and BC² − A² = DF².',
  build(g) {
    const q = g.param('q', 1, { min: 1, max: 4, label: 'DC ÷ unit' });
    const p = Math.max(q + 1, g.param('p', 3, { min: 2, max: 6, label: 'BD ÷ unit' }));
    const w = 8 / (p + q);
    const [bd, dc] = [p * w, q * w];
    const bc = bd + dc;
    const a = 2 * Math.sqrt(bd * dc);
    const L = Lines.fit(g, Math.max(bc, a), 10);
    L.mag('A', a, 0, -1.4);
    const { B, F, D, C } = deficientApplication(L, bd, dc, 0);
    const df = (D.x - F.x) / L.u;
    const bf = (F.x - B.x) / L.u;
    g.equal('BD·DC = (½A)²', bd * dc, (a / 2) ** 2);
    g.equal('BF = DC', bf, (C.x - D.x) / L.u);
    g.equal('BC² = A² + DF²', bc * bc, a * a + df * df);
    g.equal('DF : BC = (p − q) : (p + q), a ratio of numbers', df / bc, (p - q) / (p + q));
  },
});
