import { figure } from '../../geometry/figure';
import { Rods, divides, lcm, leastMeasured } from './lib';

// The second case: C does not measure D = lcm(A, B); E = lcm(D, C).
export default figure({
  caption: 'The second case: C does not measure D, the least number measured by A and B, and E is the least number measured by C and D. The dashed F is a supposed smaller number measured by A, B, C.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'A' });
    const b = g.param('b', 3, { min: 2, max: 5, label: 'B' });
    const c0 = g.param('c', 4, { min: 2, max: 8, label: 'C' });
    const d = lcm(a, b);
    let c = c0;
    while (divides(c, d)) c++;
    const e = lcm(d, c);
    const R = new Rods(g, e);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.8);
    R.num('E', e, 0, -5.2);
    R.groups(0, -5.2, d, e / d, 13);
    R.num('F', Math.ceil(e / 2), 0, -6.6, { dashed: true });
    g.show('A, B, C, D, E', `${a}, ${b}, ${c}, ${d}, ${e}`);
    g.equal('D = lcm(A, B)', d, leastMeasured(a, b));
    g.claim('C does not measure D', !divides(c, d));
    g.equal('E = lcm(D, C)', e, leastMeasured(d, c));
    g.equal('E = lcm(A, B, C)', e, leastMeasured(a, b, c));
  },
});
