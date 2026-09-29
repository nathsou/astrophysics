import { figure } from '../../geometry/figure';
import { isSquare, Lines } from './lib';

// A = 1 and B = √(1 − q²/p²) are rational, commensurable in square only, and √(A² − B²) = q/p is
// commensurable with A (X.29). C² = A·B and C·D = B². Then A : B = C : D, so C, D are medial,
// commensurable in square only, contain the rational rectangle B², and √(C² − D²) : C = q : p.
export default figure({
  caption: 'From the pair A, B of X.29, C is the mean proportional of A and B, and D is chosen with C·D = B². C and D are medial and contain a rational rectangle.',
  build(g) {
    const p = g.param('p', 3, { min: 2, max: 6, label: 'p' });
    let q = Math.min(p - 1, g.param('q', 2, { min: 1, max: 5, label: 'q' }));
    while (q > 1 && isSquare(p * p - q * q)) q--;
    const A = 1;
    const B = Math.sqrt(1 - (q * q) / (p * p));
    const C = Math.sqrt(A * B);
    const D = (B * B) / C;
    const L = Lines.fit(g, 1, 8);
    L.mag('A', A, 0, 3);
    L.mag('B', B, 0, 2);
    L.mag('C', C, 0, 1);
    L.mag('D', D, 0, 0);
    g.show('A², B² (in ρ²)', `1, ${p * p - q * q}/${p * p}`);
    g.equal('C² = A·B', C * C, A * B);
    g.equal('C·D = B² (rational)', C * D, (p * p - q * q) / (p * p));
    g.equal('A : B = C : D', A / B, C / D);
    g.equal('√(C² − D²) : C = q : p', Math.sqrt(C * C - D * D) / C, q / p);
  },
});
