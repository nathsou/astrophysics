import { figure } from '../../geometry/figure';
import { Rods, isEven } from './lib';

// Four even numbers AB, BC, CD, DE laid end to end.
export default figure({
  caption: 'The even numbers AB, BC, CD, DE are laid end to end. Each has a half, and the halves together are a half of the whole AE.',
  build(g) {
    const ks = ['ab', 'bc', 'cd', 'de'].map((n, i) => g.param(n, [2, 1, 3, 2][i], { min: 1, max: 4, label: `${n.toUpperCase()} ÷ 2` }));
    const ps = ks.map((k) => 2 * k);
    const total = ps.reduce((s, x) => s + x, 0);
    const R = new Rods(g, total);
    const names = ['A', 'B', 'C', 'D', 'E'];
    let acc = 0;
    const xs = [0, ...ps.map((p) => (acc += p))];
    R.seg('A', 'E', total, 0, 0);
    names.slice(1, 4).forEach((n, i) => R.mark(n, 0, 0, xs[i + 1]));
    // the halves, below
    acc = 0;
    for (const p of ps) {
      R.bare(p / 2, R.x(acc), -1, undefined, { aux: true });
      acc += p;
    }
    g.show('AB, BC, CD, DE', ps.join(', '));
    g.claim('each is even', ps.every(isEven));
    g.equal('half of AE = sum of the halves', total / 2, ps.reduce((s, x) => s + x / 2, 0));
    g.claim('AE is even', isEven(total));
  },
});
