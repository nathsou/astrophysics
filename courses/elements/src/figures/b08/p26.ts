import { figure } from '../../geometry/figure';
import { Nums, continued, isSquare, list, lowest, same } from './lib';

// Similar plane numbers A, B with sides (s, s·k) and (t, t·k). C = s·t·k is the mean; D, E, F
// are the least numbers in the ratio of A, C, B.
export default figure({
  caption: 'A, B are similar plane numbers and C is the mean proportional between them. D, E, F are the least numbers in the ratio of A, C, B; their extremes D, F are squares.',
  build(g) {
    const s = g.param('s', 2, { min: 2, max: 3, label: 'side of A' });
    const t = g.param('t', 3, { min: 2, max: 4, label: 'side of B' });
    const k = g.param('k', 6, { min: 2, max: 6, label: 'shape k' });
    const [A, C, B] = [s * s * k, s * t * k, t * t * k];
    const [s1, t1] = lowest(s, t);
    const [D, E, F] = [s1 * s1, s1 * t1, t1 * t1];
    const R = new Nums(g, '8.26', Math.max(A, B), 8.5);
    R.num('A', A, 0, 0);
    R.groups(0, 0, s * k, s);
    R.num('C', C, 0, -1);
    R.num('B', B, 0, -2);
    R.groups(0, -2, t * k, t);
    R.num('D', D, 0, -3.4);
    R.num('E', E, 0, -4.4);
    R.num('F', F, 0, -5.4);
    g.show('sides of A; of B', `${list(s, s * k)}; ${list(t, t * k)}`);
    g.show('A, C, B', list(A, C, B));
    g.claim('A, C, B in continued proportion', continued([A, C, B]));
    g.claim('D, E, F in the ratio of A, C, B', continued([D, E, F]) && same(A, C, D, E));
    g.claim('D, F are squares', isSquare(D) && isSquare(F));
    g.claim('A : B = D : F', same(A, B, D, F));
  },
});
