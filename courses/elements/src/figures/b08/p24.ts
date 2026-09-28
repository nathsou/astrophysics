import { figure } from '../../geometry/figure';
import { Nums, continued, isSquare, list, lowest, root, same } from './lib';

// C = c², D = d². A : B = C : D with A square: A, B = n²·c'², n²·d'², where c' : d' is c : d in
// least terms. The unnamed means c·d and n²·c'·d' are drawn thin.
export default figure({
  caption: 'A : B = C : D, where C, D are squares, and A is a square. The thin rods are the mean proportionals between C and D and between A and B. B is a square.',
  build(g) {
    const c = g.param('c', 4, { min: 2, max: 6, label: '√C' });
    const d = g.param('d', 6, { min: 2, max: 7, label: '√D' });
    const n = g.param('n', 1, { min: 1, max: 2, label: 'multiple n' });
    const [c1, d1] = lowest(c, d);
    const [C, D] = [c * c, d * d];
    const [A, B] = [n * n * c1 * c1, n * n * d1 * d1];
    const [mCD, mAB] = [c * d, n * n * c1 * d1];
    const R = new Nums(g, '8.24', Math.max(A, B, C, D), 8.5);
    R.num('A', A, 0, 0);
    R.bare(mAB, 0, -0.8, `${mAB}`, { aux: true, from: 4 });
    R.num('B', B, 0, -1.6);
    R.num('C', C, 0, -3);
    R.bare(mCD, 0, -3.8, `${mCD}`, { aux: true, from: 3 });
    R.num('D', D, 0, -4.6);
    g.show('A, B; C, D', `${list(A, B)}; ${list(C, D)}`);
    g.show('√B', root(B, 2));
    g.claim('A : B = C : D', same(A, B, C, D));
    g.claim('C, cd, D and A, mean, B in continued proportion', continued([C, mCD, D]) && continued([A, mAB, B]));
    g.claim('A is square', isSquare(A));
    g.claim('B is square', isSquare(B));
  },
});
