import { figure } from '../../geometry/figure';
import { LogRods, isCube, isSquare } from './lib';

const NOT_SQUARE_OR_CUBE = [2, 3, 5, 6, 7, 10, 12];

// A neither square nor cube; its powers.
export default figure({
  caption: 'A, the number after the unit, is neither square nor cube. Then the only squares among the terms are B, D, F (every second one) and the only cubes are C, F (every third one). The dashed reductio of the text supposes C square, or D cube.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: NOT_SQUARE_OR_CUBE.length - 1, label: 'which A' });
    const a = NOT_SQUARE_OR_CUBE[i];
    const seq = [1, 2, 3, 4, 5, 6].map((k) => a ** k);
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const R = new LogRods(g, seq[5]);
    names.forEach((n, k) => R.num(n, seq[k], 0, -1.1 * k));
    const squares = names.filter((_, k) => isSquare(seq[k]));
    const cubes = names.filter((_, k) => isCube(seq[k]));
    g.claim('A is neither square nor cube', !isSquare(a) && !isCube(a));
    g.show('squares', squares.join(', '));
    g.show('cubes', cubes.join(', '));
    g.claim('the squares are B, D, F only', squares.join() === 'B,D,F');
    g.claim('the cubes are C, F only', cubes.join() === 'C,F');
  },
});
