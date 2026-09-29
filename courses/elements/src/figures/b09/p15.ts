import { figure } from '../../geometry/figure';
import { Rods, gcd, primeTo } from './lib';

// DE = x, EF = y prime to one another; A, B, C = x², xy, y².
export default figure({
  caption: 'A, B, C are the least numbers in their continued ratio, so they are DE², DE·EF, EF² with DE, EF prime to one another (VIII.2). Any two of them added together are prime to the third.',
  build(g) {
    const x = g.param('x', 2, { min: 2, max: 5, label: 'DE' });
    const y0 = g.param('y', 3, { min: 2, max: 6, label: 'EF' });
    const y = primeTo(x, y0);
    const a = x * x;
    const b = x * y;
    const c = y * y;
    const R = new Rods(g, Math.max(c, a, x + y));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    const { a: D } = R.seg('D', 'F', x + y, 0, -3.8);
    void D;
    R.mark('E', 0, -3.8, x);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.equal('gcd(DE, EF) = 1', gcd(x, y), 1);
    g.equal('A : B = B : C', a * c, b * b);
    g.equal('gcd(A + B, C) = 1', gcd(a + b, c), 1);
    g.equal('gcd(B + C, A) = 1', gcd(b + c, a), 1);
    g.equal('gcd(A + C, B) = 1', gcd(a + c, b), 1);
  },
});
