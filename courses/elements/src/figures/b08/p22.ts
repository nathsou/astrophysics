import { figure } from '../../geometry/figure';
import { Nums, continued, isSquare, list, primeToOther, root } from './lib';

// A, B, C = n²·(d², de, e²): A is square for every slider value.
export default figure({
  caption: 'A, B, C are in continued proportion and A is a square. Then C is a square too.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 4, label: 'ratio d' });
    const e = primeToOther(d, g.param('e', 3, { min: 2, max: 5, label: 'ratio e' }));
    const n = g.param('n', 1, { min: 1, max: 2, label: 'multiple n' });
    const [A, B, C] = [n * n * d * d, n * n * d * e, n * n * e * e];
    const R = new Nums(g, '8.22', Math.max(A, C), 9);
    R.num('A', A, 0, 0);
    R.groups(0, 0, root(A, 2), root(A, 2));
    R.num('B', B, 0, -1);
    R.num('C', C, 0, -2);
    R.groups(0, -2, root(C, 2), root(C, 2));
    g.show('A, B, C', list(A, B, C));
    g.show('√A, √C', list(root(A, 2), root(C, 2)));
    g.claim('A, B, C in continued proportion', continued([A, B, C]));
    g.claim('A is square', isSquare(A));
    g.claim('C is square', isSquare(C));
  },
});
