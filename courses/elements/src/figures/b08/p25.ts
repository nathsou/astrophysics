import { figure } from '../../geometry/figure';
import { Nums, continued, isCube, list, lowest, root, same } from './lib';

// C = c³, D = d³. A : B = C : D with A a cube: A, E, F, B = n³·(c'³, c'²d', c'd'², d'³). The two
// unnamed means between C and D are drawn thin.
export default figure({
  caption: 'A : B = C : D, where C, D are cubes, and A is a cube. The thin rods are the two means between C and D; E, F are the two means between A and B. B is a cube.',
  build(g) {
    const c = g.param('c', 4, { min: 2, max: 4, label: '∛C' });
    const d = g.param('d', 6, { min: 2, max: 6, label: '∛D' });
    const n = g.param('n', 1, { min: 1, max: 2, label: 'multiple n' });
    const [c1, d1] = lowest(c, d);
    const [C, D] = [c ** 3, d ** 3];
    const k = n ** 3;
    const [A, E, F, B] = [k * c1 ** 3, k * c1 * c1 * d1, k * c1 * d1 * d1, k * d1 ** 3];
    const R = new Nums(g, '8.25', Math.max(A, B, C, D), 8.5);
    R.num('A', A, 0, 0);
    R.num('E', E, 0, -0.9);
    R.num('F', F, 0, -1.8);
    R.num('B', B, 0, -2.7);
    R.num('C', C, 0, -4.1);
    R.bare(c * c * d, 0, -5, `${c * c * d}`, { aux: true, from: 3 });
    R.bare(c * d * d, 0, -5.9, `${c * d * d}`, { aux: true, from: 3 });
    R.num('D', D, 0, -6.8);
    g.show('A, E, F, B', list(A, E, F, B));
    g.show('∛B', root(B, 3));
    g.claim('A : B = C : D', same(A, B, C, D));
    g.claim('A, E, F, B in continued proportion', continued([A, E, F, B]));
    g.claim('A is a cube', isCube(A));
    g.claim('B is a cube', isCube(B));
  },
});
