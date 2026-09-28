import { figure } from '../../geometry/figure';
import { LogRods, isSquare, similarPlaneSides, sqrtInt } from './lib';

// A, B similar plane numbers: sides (p·m, q·m) and (p·n, q·n). D = A², C = A·B.
export default figure({
  caption: 'A and B are similar plane numbers: their sides are in the same ratio. D is A times itself and C is A times B. Rods are drawn on a logarithmic scale, cut at their prime factors, so a product is its factors laid end to end.',
  build(g) {
    const p = g.param('p', 2, { min: 2, max: 3, label: 'side ratio p' });
    const q = g.param('q', 3, { min: 2, max: 4, label: 'side ratio q' });
    const m = g.param('m', 1, { min: 1, max: 3, label: 'A = pm · qm' });
    const n = g.param('n', 2, { min: 1, max: 3, label: 'B = pn · qn' });
    const a = p * m * q * m;
    const b = p * n * q * n;
    const d = a * a;
    const c = a * b;
    const R = new LogRods(g, Math.max(c, d));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('D', d, 0, -2.4);
    R.num('C', c, 0, -3.6);
    g.show('sides of A, B', `${p * m}·${q * m}, ${p * n}·${q * n}`);
    g.claim('A, B are similar plane numbers', similarPlaneSides(a, b) !== null);
    g.equal('A : B = D : C (A·C = B·D)', a * c, b * d);
    g.show('mean proportional between A, B', Math.sqrt(a * b));
    g.claim('D is square', isSquare(d));
    g.claim('C is square', isSquare(c));
    g.show('√C', sqrtInt(c));
  },
});
