import { figure } from '../../geometry/figure';
import { rods } from './lib';

// A = m·B and C = m·D; EF = n·A and GH = n·C, with EK = A and GL = C the first copies.
export default figure({
  build(g) {
    const b = g.param('b', 0.7, { min: 0.3, max: 1.5, label: 'B' });
    const d = g.param('d', 0.5, { min: 0.3, max: 1.5, label: 'D' });
    const m = g.param('m', 3, { min: 1, max: 4, label: 'm (A = m·B)' });
    const n = g.param('n', 2, { min: 2, max: 4, label: 'n (EF = n·A)' });
    const a = m * b;
    const c = m * d;
    rods(g, [
      [{ name: 'A', parts: [a], unit: b }],
      [{ name: 'B', parts: [b] }],
      [{ pts: ['E', 'K', 'F'], parts: [a, (n - 1) * a], unit: b }],
      [{ name: 'C', parts: [c], unit: d }],
      [{ name: 'D', parts: [d] }],
      [{ pts: ['G', 'L', 'H'], parts: [c, (n - 1) * c], unit: d }],
    ]);
    g.equal('EF ÷ B = m·n', (n * a) / b, m * n);
    g.equal('EF ÷ B = GH ÷ D', (n * a) / b, (n * c) / d);
  },
});
