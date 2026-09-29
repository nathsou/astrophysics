import { figure } from '../../geometry/figure';
import { LogRods, isSquare, similarPlaneSides, sqrtInt } from './lib';

// A·B square: A = k·a², B = k·b² (every pair with a square product has this form). D = A².
export default figure({
  caption: 'A times B is the square number C, and D is A times itself. Then A is to B as D is to C, one mean proportional falls between D and C, and so also between A and B. Logarithmic scale, as in IX.1.',
  build(g) {
    const k = g.param('k', 2, { min: 1, max: 3, label: 'k' });
    const s = g.param('a', 2, { min: 2, max: 3, label: 'A = k·a²' });
    const t = g.param('b', 3, { min: 2, max: 4, label: 'B = k·b²' });
    const a = k * s * s;
    const b = k * t * t;
    const c = a * b;
    const d = a * a;
    const R = new LogRods(g, Math.max(c, d));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    g.claim('C = A·B is square', isSquare(c));
    g.equal('A : B = D : C (A·C = B·D)', a * c, b * d);
    g.show('mean between D, C', `${sqrtInt(d * c)}`);
    g.show('mean between A, B', `${sqrtInt(a * b)}`);
    const sides = similarPlaneSides(a, b);
    g.claim('A, B are similar plane numbers', sides !== null);
    if (sides) g.show('sides', `${a} = ${sides[0]}·${sides[1]}, ${b} = ${sides[2]}·${sides[3]}`);
  },
});
