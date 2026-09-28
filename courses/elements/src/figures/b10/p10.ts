import { figure } from '../../geometry/figure';
import { gcd, isSquare, Lines, surd, root4 } from './lib';

// B : C numbers not in the ratio of squares; A² : D² = B : C (X.6 Por.), E the mean proportional
// between A and D.
export default figure({
  caption: 'With A = 1: D = √(C/B) is incommensurable with A in length only, and E = ⁴√(C/B), the mean proportional, is incommensurable with A in square too.',
  build(g) {
    let b = g.param('b', 2, { min: 1, max: 9, label: 'B' });
    const c = g.param('c', 3, { min: 1, max: 9, label: 'C' });
    // B : C must not be a ratio of squares
    while (isSquare(b / gcd(b, c)) && isSquare(c / gcd(b, c))) b++;
    const a = 1;
    const d = a * Math.sqrt(c / b);
    const e = Math.sqrt(a * d);
    const L = Lines.fit(g, Math.max(a, d, e), 6);
    L.mag('A', a, 0, 4);
    L.mag('D', d, 0, 3);
    L.mag('E', e, 0, 2);
    const N = Lines.fit(g, 10, 6);
    N.mag('B', b, 0, 1, { ticks: 1 });
    N.mag('C', c, 0, 0, { ticks: 1 });
    g.show('with A = 1', `D = ${surd(c, b)}, E = ${root4(c, b)}`);
    g.equal('A² : D² = B : C', (a * a) / (d * d), b / c);
    g.equal('E² = A·D', e * e, a * d);
    g.claim('B : C is not a ratio of squares, so A, D are incommensurable in length (X.9)', !(isSquare(b / gcd(b, c)) && isSquare(c / gcd(b, c))));
    g.equal('A² : E² = A : D', (a * a) / (e * e), a / d);
  },
});
