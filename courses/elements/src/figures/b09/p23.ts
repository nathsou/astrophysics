import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// Three odd numbers AB, BC, CD; E is a unit before D.
export default figure({
  caption: 'The odd numbers AB, BC, CD, odd in multitude, laid end to end. Take the unit DE from CD: CE is even, CA is even (IX.22), so AE is even and AD, one more, is odd.',
  build(g) {
    const ks = ['ab', 'bc', 'cd'].map((n, i) => g.param(n, [1, 2, 2][i], { min: 1, max: 3, label: `${n.toUpperCase()} = 2k + 1` }));
    const ps = ks.map((k) => 2 * k + 1);
    const total = ps.reduce((s, x) => s + x, 0);
    const R = new Rods(g, total);
    R.seg('A', 'D', total, 0, 0);
    R.mark('B', 0, 0, ps[0]);
    R.mark('C', 0, 0, ps[0] + ps[1]);
    R.mark('E', 0, 0, total - 1, { below: true });
    const ce = ps[2] - 1;
    const ca = ps[0] + ps[1];
    g.show('AB, BC, CD', ps.join(', '));
    g.claim('AB, BC, CD odd', ps.every(isOdd));
    g.claim('CE is even', isEven(ce));
    g.claim('CA is even', isEven(ca));
    g.claim('AE is even', isEven(total - 1));
    g.claim('AD is odd', isOdd(total));
  },
});
