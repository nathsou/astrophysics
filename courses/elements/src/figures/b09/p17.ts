import { figure } from '../../geometry/figure';
import { Rods, divides, gcd } from './lib';

// A, B, C, D = x³, x²y, xy², y³ with x, y prime to one another; the dashed E = B·D / A.
export default figure({
  caption: 'A, B, C, D are in continued proportion and the extremes A, D are prime to one another. The dashed E, with A : B = D : E, would be B·D / A, which is never a whole number.',
  build(g) {
    const x = g.param('x', 2, { min: 2, max: 3, label: 'x' });
    const k = g.param('k', 1, { min: 1, max: 2, label: 'y − x' });
    let y = x + k;
    while (gcd(x, y) !== 1) y++;
    const [a, b, c, d] = [x ** 3, x * x * y, x * y * y, y ** 3];
    const e = (b * d) / a;
    const R = new Rods(g, Math.max(d, e));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    R.num('E', e, 0, -5, { dashed: true, ticks: false });
    g.show('A, B, C, D', `${a}, ${b}, ${c}, ${d}`);
    g.equal('A : B = B : C', a * c, b * b);
    g.equal('B : C = C : D', b * d, c * c);
    g.equal('gcd(A, D) = 1', gcd(a, d), 1);
    g.show('B·D / A', e.toFixed(2));
    g.claim('A does not measure B·D: no E with A : B = D : E', !divides(a, b * d));
  },
});
