import { figure } from '../../geometry/figure';
import { gcd, isSquare, Lines, root4 } from './lib';

// Against ρ = 1: A = √a and B = √b are rational and commensurable in square only. C is the mean
// proportional (C² = A·B, so C = ⁴√(ab) is medial) and D the fourth proportional, A : B = C : D.
// Then C, D are medial, commensurable in square only, and C·D = B² is rational.
export default figure({
  caption: 'A, B rational and commensurable in square only; C = ⁴√(ab), D = C·B/A. The rectangle C·D equals B² = b·ρ², a rational area.',
  build(g) {
    let a = g.param('a', 3, { min: 1, max: 8, label: 'A = √a: a' });
    const b = g.param('b', 2, { min: 1, max: 8, label: 'B = √b: b' });
    while (isSquare((a * b) / gcd(a, b) ** 2)) a++;
    const [A, B] = [Math.sqrt(a), Math.sqrt(b)];
    const C = Math.sqrt(A * B);
    const D = (C * B) / A;
    const L = Lines.fit(g, 3.2, 8);
    L.mag('A', A, 0, 3);
    L.mag('B', B, 0, 2);
    L.mag('C', C, 0, 1);
    L.mag('D', D, 0, 0);
    g.show('C, D', `${root4(a * b)}, ${root4(b ** 3, a)}`);
    g.equal('C² = A·B', C * C, A * B);
    g.equal('A : B = C : D', A / B, C / D);
    g.equal('C·D = B² = b', C * D, b);
  },
});
