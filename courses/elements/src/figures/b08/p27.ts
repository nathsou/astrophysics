import { figure } from '../../geometry/figure';
import { Nums, continued, isCube, list, lowest, same } from './lib';

// Similar solid numbers A, B with sides (s, s, s·k) and (t, t, t·k). C, D are the two means;
// E, F, G, H are the least numbers in the ratio of A, C, D, B.
export default figure({
  caption: 'A, B are similar solid numbers and C, D the two means between them. E, F, G, H are the least numbers in the ratio of A, C, D, B; their extremes E, H are cubes.',
  build(g) {
    const s = g.param('s', 2, { min: 2, max: 3, label: 'side of A' });
    const t = g.param('t', 3, { min: 2, max: 4, label: 'side of B' });
    const k = g.param('k', 2, { min: 1, max: 3, label: 'shape k' });
    const [A, C, D, B] = [s ** 3 * k, s * s * t * k, s * t * t * k, t ** 3 * k];
    const [s1, t1] = lowest(s, t);
    const [E, F, G, H] = [s1 ** 3, s1 * s1 * t1, s1 * t1 * t1, t1 ** 3];
    const R = new Nums(g, '8.27', Math.max(A, B), 8.5);
    R.num('A', A, 0, 0);
    R.num('C', C, 0, -1);
    R.num('D', D, 0, -2);
    R.num('B', B, 0, -3);
    R.num('E', E, 0, -4.4);
    R.num('F', F, 0, -5.4);
    R.num('G', G, 0, -6.4);
    R.num('H', H, 0, -7.4);
    g.show('sides of A; of B', `${list(s, s, s * k)}; ${list(t, t, t * k)}`);
    g.show('A, C, D, B', list(A, C, D, B));
    g.claim('A, C, D, B in continued proportion', continued([A, C, D, B]));
    g.claim('E, F, G, H in the ratio of A, C, D, B', continued([E, F, G, H]) && same(A, C, E, F));
    g.claim('E, H are cubes', isCube(E) && isCube(H));
    g.claim('A : B = E : H', same(A, B, E, H));
  },
});
