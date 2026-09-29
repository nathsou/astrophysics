import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare, root4, surd } from './lib';

// Against ρ = 1. A = ⁴√k is medial, and B = (r/s)·A is commensurable with it. On the rational line
// CD = 3/2, the square on A is applied as CE (breadth ED = ⅔√k) and the square on B as CF (breadth
// DF = ⅔(r/s)²·√k). ED, DF are commensurable, so DF is rational and incommensurable with CD, and B
// is the side of a rectangle of rationals commensurable in square only: medial.
export default figure({
  caption: 'CE = A² and CF = B², both applied to the rational line CD. Since B : A = r : s, the breadths are in the ratio of the numbers r² : s², and B is medial like A.',
  build(g) {
    const k = nonSquare(g.param('k', 2, { min: 2, max: 7, label: 'A = ⁴√k: k' }));
    const r = g.param('r', 3, { min: 1, max: 4, label: 'B = (r/s)·A: r' });
    const s = g.param('s', 2, { min: 2, max: 3, label: 's' });
    const a = Math.pow(k, 0.25);
    const b = (a * r) / s;
    const cd = 1.5;
    const ed = (a * a) / cd;
    const df = (b * b) / cd;
    const M = Lines.fit(g, 9, 10);
    M.rect(['E', 'D', 'C', '~1'], -ed, 0, ed, cd, { fill: true, aux: true }, [225, 270, 90, 135]);
    M.rect(['D', 'F', '~2', 'C'], 0, 0, df, cd, { fill: true, aux: true }, [270, 315, 45, 90]);
    M.mag('A', a, M.x(-ed), -0.9);
    M.mag('B', b, M.x(-ed), -1.6);
    g.show('A, B', `${root4(k)}, ${root4(k * r ** 4, s ** 4)}`);
    g.show('ED, DF', `${surd(4 * k, 9)}, ${surd(4 * k * r ** 4, 9 * s ** 4)}`);
    g.equal('CE = A², CF = B²', cd * ed + cd * df, a * a + b * b);
    g.equal('ED : DF = s² : r²', ed / df, (s * s) / (r * r));
    g.claim('k is not a square: DF is incommensurable in length with CD', !isSquare(k));
    g.equal('B² = CD·DF', b * b, cd * df);
  },
});
