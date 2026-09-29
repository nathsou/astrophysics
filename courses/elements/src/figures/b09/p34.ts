import { figure } from '../../geometry/figure';
import { Rods, evenTimesEven, evenTimesOdd, isEven } from './lib';

const ODDS = [3, 5, 7];

// A = 2^j · o with j ≥ 2 and o odd ≥ 3: not a power of 2, and its half is even.
export default figure({
  caption: 'A is not doubled from a dyad, and its half is not odd. Halving A again and again (the rods below it) must reach an odd number before the dyad; that odd number measures A an even number of times. So A is both even-times even and even-times odd.',
  build(g) {
    const j = g.param('j', 2, { min: 2, max: 3, label: 'halvings' });
    const i = g.param('i', 0, { min: 0, max: 2, label: 'odd part' });
    const o = ODDS[i];
    const a = 2 ** j * o;
    const R = new Rods(g, a);
    R.num('A', a, 0, 0);
    const chain: number[] = [];
    for (let h = a / 2, y = -1.1; ; h /= 2, y -= 1.1) {
      chain.push(h);
      R.bare(h, 0, y, String(h), { aux: true });
      if (!isEven(h)) break;
    }
    g.show('halvings of A', [a, ...chain].join(' → '));
    g.claim('A is not a power of 2, and its half is even', o > 1 && isEven(a / 2));
    g.claim('A is even-times even', evenTimesEven(a));
    g.claim('A is even-times odd', evenTimesOdd(a));
  },
});
