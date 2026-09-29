import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A : B = C : D = E : F. G, H, K = m·A, m·C, m·E; L, M, N = n·B, n·D, n·F.
export default figure({
  build(g) {
    const a = g.param('a', 1.2, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 0.8, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 0.6, { min: 0.3, max: 2, label: 'C' });
    const e = g.param('e', 0.9, { min: 0.3, max: 2, label: 'E' });
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n' });
    const k = b / a;
    const d = c * k;
    const f = e * k;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'G', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'L', parts: [n * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'H', parts: [m * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'M', parts: [n * d], unit: d }],
      [{ name: 'E', parts: [e] }, { name: 'K', parts: [m * e], unit: e }],
      [{ name: 'F', parts: [f] }, { name: 'N', parts: [n * f], unit: f }],
    ], { dy: 0.8 });
    alike(g, 'G', 'L', [m * a, n * b], 'G + H + K', 'L + M + N', [m * (a + c + e), n * (b + d + f)]);
    g.equal('A : B = (A + C + E) : (B + D + F)', a / b, (a + c + e) / (b + d + f));
  },
});
