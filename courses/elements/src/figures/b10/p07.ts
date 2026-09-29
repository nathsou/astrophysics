import { figure } from '../../geometry/figure';
import { cfSqrt, convergents, Lines, nonSquare } from './lib';

// A : B = √n with n not a square: A, B are incommensurable (X.9), so no ratio of numbers equals
// A : B. The readout lists the best candidates, the convergents p/q of √n: p² − n·q² is never 0.
export default figure({
  caption: 'A : B = √n for a non-square n. The best fractions p/q come ever closer, but p² − n·q² is never 0, so none of them is the ratio.',
  build(g) {
    const n = nonSquare(g.param('n', 2, { min: 2, max: 12, label: 'n (A : B = √n)' }));
    const b = 2;
    const a = b * Math.sqrt(n);
    const L = Lines.fit(g, a, 8);
    L.mag('A', a, 0, 1);
    L.mag('B', b, 0, 0);
    const cv = convergents(cfSqrt(n, 6));
    g.show('A : B', `√${n} ≈ ${(a / b).toFixed(6)}`);
    g.show('best fractions p/q', cv.map(([p, q]) => `${p}/${q}`).join(', '));
    g.show('p² − n·q²', cv.map(([p, q]) => p * p - n * q * q).join(', '));
    g.claim('p² − n·q² ≠ 0 for every one of them', cv.every(([p, q]) => p * p !== n * q * q));
  },
});
