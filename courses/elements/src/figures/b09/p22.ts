import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// Four odd numbers AB, BC, CD, DE (an even multitude) laid end to end.
export default figure({
  caption: 'The odd numbers AB, BC, CD, DE, even in multitude, are laid end to end. Take a unit from each (marked): the rest of each is even, and the four units make an even number, so the whole AE is even.',
  build(g) {
    const ks = ['ab', 'bc', 'cd', 'de'].map((n, i) => g.param(n, [1, 2, 1, 3][i], { min: 1, max: 3, label: `${n.toUpperCase()} = 2k + 1` }));
    const ps = ks.map((k) => 2 * k + 1);
    const total = ps.reduce((s, x) => s + x, 0);
    const R = new Rods(g, total);
    let acc = 0;
    const xs = [0, ...ps.map((p) => (acc += p))];
    R.seg('A', 'E', total, 0, 0);
    ['B', 'C', 'D'].forEach((n, i) => R.mark(n, 0, 0, xs[i + 1]));
    // the unit at the end of each, below the rod
    for (let i = 0; i < 4; i++) R.bare(1, R.x(xs[i + 1] - 1), -0.6, undefined, { aux: true });
    g.show('AB, BC, CD, DE', ps.join(', '));
    g.claim('each is odd, four of them', ps.every(isOdd));
    g.claim('each less a unit is even', ps.every((p) => isEven(p - 1)));
    g.claim('AE is even', isEven(total));
  },
});
