import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A : B = C : D and C : D = E : F (D and F are computed). G, H, K = m·A, m·C, m·E; L, M, N = n·B, n·D, n·F.
export default figure({
  build(g) {
    const a = g.param('a', 1.1, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1.5, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 0.7, { min: 0.4, max: 2, label: 'C' });
    const e = g.param('e', 1.4, { min: 0.4, max: 2, label: 'E' });
    const m = g.param('m', 3, { min: 1, max: 6, label: 'm' });
    const n = g.param('n', 2, { min: 1, max: 6, label: 'n' });
    const d = (c * b) / a;
    const f = (e * d) / c;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'G', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'L', parts: [n * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'H', parts: [m * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'M', parts: [n * d], unit: d }],
      [{ name: 'E', parts: [e] }, { name: 'K', parts: [m * e], unit: e }],
      [{ name: 'F', parts: [f] }, { name: 'N', parts: [n * f], unit: f }],
    ], { dy: 0.8 });
    alike(g, 'G', 'L', [m * a, n * b], 'H', 'M', [m * c, n * d]);
    alike(g, 'H', 'M', [m * c, n * d], 'K', 'N', [m * e, n * f]);
    alike(g, 'G', 'L', [m * a, n * b], 'K', 'N', [m * e, n * f]);
    g.equal('A : B = E : F', a / b, e / f);
  },
});
