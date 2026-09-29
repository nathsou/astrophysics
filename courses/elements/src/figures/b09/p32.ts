import { figure } from '../../geometry/figure';
import { Rods, divisors, evenTimesEven, evenTimesOdd } from './lib';

// The doubles of the dyad A: B, C, D = 4, 8, 16.
export default figure({
  caption: 'B, C, D are doubled in turn from the dyad A. D is measured only by A, B, C (IX.13), all even, so every way of measuring D is an even number an even number of times: D is even-times even only. The copies of A are marked on D.',
  build(g) {
    const [a, b, c, d] = [2, 4, 8, 16];
    const R = new Rods(g, d);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    R.groups(0, -3.6, a, d / a);
    g.show('divisors of D', divisors(d).join(', '));
    g.claim('D is measured only by A, B, C (and the unit)', divisors(d).slice(1, -1).join() === [a, b, c].join());
    g.claim('B, C, D are even-times even', [b, c, d].every(evenTimesEven));
    g.claim('none is even-times odd', ![b, c, d].some(evenTimesOdd));
  },
});
