import { figure } from '../../geometry/figure';
import { Nums, continued, list, ratio, same } from './lib';

// A = C², B = D², E = C·D.
export default figure({
  caption: 'A, B are the squares of C, D, and E = C·D. Then A, E, B are in continued proportion in the ratio C : D, and A : B is that ratio duplicated.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 6, label: 'C' });
    const d = g.param('d', 3, { min: 2, max: 7, label: 'D' });
    const [A, E, B] = [c * c, c * d, d * d];
    const R = new Nums(g, '8.11', Math.max(A, B), 9);
    R.num('A', A, 0, 0);
    R.groups(0, 0, c, c);
    R.num('E', E, 0, -1);
    R.groups(0, -1, c, d);
    R.num('B', B, 0, -2);
    R.groups(0, -2, d, d);
    R.num('C', c, 0, -3.4);
    R.num('D', d, 0, -4.4);
    g.show('A, E, B', list(A, E, B));
    g.claim(`A : E = E : B = C : D = ${ratio(c, d)}`, continued([A, E, B]) && same(A, E, c, d));
    g.claim(`A : B = C² : D² = ${ratio(A, B)}`, same(A, B, c * c, d * d));
  },
});
