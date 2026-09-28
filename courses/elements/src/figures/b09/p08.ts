import { figure } from '../../geometry/figure';
import { LogRods, isCube, isSquare } from './lib';

// 1, A, B, …, F in continued proportion from the unit: the powers a, a², …, a⁶.
export default figure({
  caption: 'The unit, A, B, C, D, E, F are in continued proportion, so they are the powers of A. On this logarithmic scale each term is one step longer than the one before: every second term (B, D, F) is a square, every third (C, F) a cube, and F, the seventh from the unit, is both.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 7, label: 'A' });
    const seq = [1, 2, 3, 4, 5, 6].map((k) => a ** k);
    const R = new LogRods(g, seq[5]);
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((n, i) => R.num(n, seq[i], 0, -1.1 * i));
    const [A, B, C, D, E, F] = seq;
    g.equal('1 : A = A : B (B = A·A)', B, A * A);
    g.equal('B : C = C : D', B * D, C * C);
    g.claim('B, D, F are squares', isSquare(B) && isSquare(D) && isSquare(F));
    g.claim('C, F are cubes', isCube(C) && isCube(F));
    g.claim('F is square and cube', isSquare(F) && isCube(F));
    g.show('E', E);
  },
});
