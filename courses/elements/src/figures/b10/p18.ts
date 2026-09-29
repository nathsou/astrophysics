import { figure } from '../../geometry/figure';
import { deficientApplication, isSquare, Lines, nonSquare } from './lib';

// As in X.17, but BD : DC = √n : 1 with n not a square, so BD, DC are incommensurable; then DF is
// incommensurable with BC.
export default figure({
  caption: 'BD : DC = √n. The shaded rectangle BD·DC equals the square on half of A. DF : BC = (√n − 1) : (√n + 1), which is not a ratio of numbers.',
  build(g) {
    const n = nonSquare(g.param('n', 3, { min: 2, max: 10, label: 'n (BD : DC = √n)' }));
    const dc = 8 / (1 + Math.sqrt(n));
    const bd = dc * Math.sqrt(n);
    const bc = bd + dc;
    const a = 2 * Math.sqrt(bd * dc);
    const L = Lines.fit(g, Math.max(bc, a), 10);
    L.mag('A', a, 0, -1.4);
    const { B, F, D, C } = deficientApplication(L, bd, dc, 0);
    const df = (D.x - F.x) / L.u;
    g.equal('BD·DC = (½A)²', bd * dc, (a / 2) ** 2);
    g.equal('BF = DC', (F.x - B.x) / L.u, (C.x - D.x) / L.u);
    g.equal('BC² = A² + DF²', bc * bc, a * a + df * df);
    g.equal('DF : BC = (√n − 1) : (√n + 1)', df / bc, (Math.sqrt(n) - 1) / (Math.sqrt(n) + 1));
    g.claim('n is not a square, so BD, DC are incommensurable', !isSquare(n));
  },
});
