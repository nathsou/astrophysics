import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A : B = C : D (D computed). E, F = m·A, m·B; G, H = n·C, n·D.
export default figure({
  build(g) {
    const a = g.param('a', 1.5, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1.1, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 0.8, { min: 0.4, max: 2, label: 'C' });
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n' });
    const d = (c * b) / a;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'E', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'F', parts: [m * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'G', parts: [n * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'H', parts: [n * d], unit: d }],
    ]);
    g.equal('E : F = G : H', (m * a) / (m * b), (n * c) / (n * d));
    alike(g, 'E', 'G', [m * a, n * c], 'F', 'H', [m * b, n * d]);
    g.equal('A : C = B : D', a / c, b / d);
  },
});
