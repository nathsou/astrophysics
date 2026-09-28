import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// C is B taken A times; D is A taken B times. The taller marks show the copies.
export default figure({
  caption: 'C is B added to itself as many times as there are units in A; D is A added to itself as many times as there are units in B. E is the unit.',
  build(g) {
    const a = g.param('a', 3, { min: 2, max: 6, label: 'A' });
    const b = g.param('b', 4, { min: 2, max: 6, label: 'B' });
    const R = new Rods(g, a * b);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('E', 1, 0, -2.4);
    R.num('C', a * b, 0, -3.8);
    R.groups(0, -3.8, b, a, 2);
    R.num('D', b * a, 0, -5.2);
    R.groups(0, -5.2, a, b, 5);
    g.show('C = B taken A times', `${a} × ${b}`);
    g.show('D = A taken B times', `${b} × ${a}`);
    g.equal('C = D', a * b, b * a);
  },
});
