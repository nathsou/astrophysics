import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A = B; D, E = m·A, m·B; F = n·C.
export default figure({
  build(g) {
    const a = g.param('a', 1.3, { min: 0.4, max: 2, label: 'A = B' });
    const c = g.param('c', 1, { min: 0.4, max: 2, label: 'C' });
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm (D = m·A)' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n (F = n·C)' });
    const b = a;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'D', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'E', parts: [m * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'F', parts: [n * c], unit: c }],
    ]);
    g.equal('D = E', m * a, m * b);
    alike(g, 'D', 'F', [m * a, n * c], 'E', 'F', [m * b, n * c]);
    g.equal('A : C = B : C', a / c, b / c);
    g.equal('C : A = C : B', c / a, c / b);
  },
});
