import { figure } from '../../geometry/figure';
import { LogRods, isCube, isSquare } from './lib';

// A is a square (or, second part, a cube); the terms are its powers.
export default figure({
  caption: 'The unit, A, B, …, F in continued proportion, with A a square (or, with the second slider at 1, a cube). Every term is then a square (a cube): on this logarithmic scale A is cut into two (three) equal pieces, and every term is made of copies of A.',
  build(g) {
    const cube = g.param('cube', 0, { min: 0, max: 1, label: 'A square (0) or cube (1)' });
    const s = g.param('s', 2, { min: 2, max: 3, label: 'side of A' });
    const a = cube ? s ** 3 : s ** 2;
    const seq = [1, 2, 3, 4, 5, 6].map((k) => a ** k);
    const R = new LogRods(g, seq[5]);
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((n, i) => R.num(n, seq[i], 0, -1.1 * i));
    const test = cube ? isCube : isSquare;
    g.claim(cube ? 'A is cube' : 'A is square', test(a));
    g.claim(cube ? 'every term is cube' : 'every term is square', seq.every(test));
  },
});
