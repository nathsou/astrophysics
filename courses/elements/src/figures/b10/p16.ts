import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare } from './lib';

// AB and BC = (√n / 2)·AB, laid end to end. D, dashed, is the supposed common measure of CA, AB.
// The lemma after the proposition (a rectangle applied to a line, falling short by a square) is
// drawn in X.17's figure.
export default figure({
  caption: 'BC : AB = √n : 2 with n not a square, so AB, BC are incommensurable; then AC is incommensurable with each of them.',
  build(g) {
    const n = nonSquare(g.param('n', 3, { min: 2, max: 12, label: 'n (BC : AB = √n : 2)' }));
    const ab = 4;
    const bc = (ab * Math.sqrt(n)) / 2;
    const L = Lines.fit(g, ab + (ab * Math.sqrt(12)) / 2, 10);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 1);
    L.mag('D', 0.37, 0, 0, { dashed: true });
    g.show('AC : AB', `1 + √${n}/2`);
    g.claim('(BC : AB)² = n : 4 is not a ratio of squares', !isSquare(n));
  },
  unresolved: {
    AD: 'the parallelogram of the lemma after X.16; it is drawn in the figure of X.17',
    DB: 'the square of the lemma after X.16; it is drawn in the figure of X.17',
    DC: 'a side of the square in the lemma after X.16 (see X.17)',
    CD: 'a side of the square in the lemma after X.16 (see X.17)',
  },
});
