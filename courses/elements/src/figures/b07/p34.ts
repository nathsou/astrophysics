import { figure } from '../../geometry/figure';
import { Rods, gcd, lcm, leastMeasured, primeTo } from './lib';

// The second case: A = h·F, B = h·E with F, E the least numbers in the ratio of A to B.
export default figure({
  caption: 'The second case: A, B are not prime to one another. F, E are the least numbers in the ratio of A to B, and C = A·E = B·F. The dashed D (a smaller common multiple) and its quotients G, H cannot exist.',
  build(g) {
    const h = g.param('h', 2, { min: 2, max: 3, label: 'gcd(A, B)' });
    const f = g.param('f', 2, { min: 2, max: 4, label: 'F' });
    const e0 = g.param('e', 3, { min: 2, max: 5, label: 'E' });
    const e = primeTo(f, e0);
    const A = h * f;
    const B = h * e;
    const C = A * e;
    const R = new Rods(g, C);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('F', f, 0, -2.4);
    R.num('E', e, 0, -3.6);
    R.num('C', C, 0, -5);
    R.groups(0, -5, A, e, 15);
    R.num('D', C - 1, 0, -6.4, { dashed: true });
    R.num('G', Math.max(1, e - 1), 0, -7.6, { dashed: true });
    R.num('H', Math.max(1, f - 1), 0, -8.8, { dashed: true });
    g.show('A, B, C', `${A}, ${B}, ${C}`);
    g.equal('gcd(F, E) = 1', gcd(f, e), 1);
    g.equal('A·E = B·F', A * e, B * f);
    g.equal('C = lcm(A, B)', C, lcm(A, B));
    g.equal('no smaller number is measured by A and B', leastMeasured(A, B), C);
  },
});
