import { figure } from '../../geometry/figure';
import { Nums, lcm, list, lowest, ratio, same } from './lib';

// A = C·D and B = E·F. G, H, K are the least numbers continuously in the ratios C : E, D : F
// (VIII.4); L = D·E.
export default figure({
  caption: 'A is the plane number with sides C, D, and B the one with sides E, F. G, H, K are the least numbers in the ratios C : E and D : F, and L = D·E is the go-between: A : L = C : E and L : B = D : F.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 6, label: 'C' });
    const d = g.param('d', 5, { min: 2, max: 6, label: 'D' });
    const e = g.param('e', 3, { min: 2, max: 6, label: 'E' });
    const f = g.param('f', 4, { min: 2, max: 6, label: 'F' });
    const A = c * d;
    const B = e * f;
    const L = d * e;
    const [c1, e1] = lowest(c, e);
    const [d1, f1] = lowest(d, f);
    const H = lcm(e1, d1);
    const G = (c1 * H) / e1;
    const K = (f1 * H) / d1;
    const R = new Nums(g, '8.5', Math.max(A, B, L, G, H, K), 6.5);
    const x2 = 8.6;
    R.num('A', A, 0, 0);
    R.groups(0, 0, c, d);
    R.num('B', B, 0, -1);
    R.groups(0, -1, f, e);
    R.num('L', L, 0, -2);
    R.groups(0, -2, e, d);
    R.num('G', G, 0, -3.3);
    R.num('H', H, 0, -4.3);
    R.num('K', K, 0, -5.3);
    R.num('C', c, x2, 0);
    R.num('D', d, x2, -1);
    R.num('E', e, x2, -2);
    R.num('F', f, x2, -3);
    g.show('A = C·D, B = E·F', list(A, B));
    g.show('G, H, K', list(G, H, K));
    g.claim('G : H = C : E and H : K = D : F', same(G, H, c, e) && same(H, K, d, f));
    g.claim('A : L = C : E', same(A, L, c, e));
    g.claim('L : B = D : F', same(L, B, d, f));
    g.claim(`A : B = G : K = ${ratio(A, B)}`, same(A, B, G, K));
  },
});
