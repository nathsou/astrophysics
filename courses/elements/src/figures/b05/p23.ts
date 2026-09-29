import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// Perturbed: A : B = E : F and B : C = D : E (D, F computed). G, H, K = m·A, m·B, m·D;
// L, M, N = n·C, n·E, n·F.
export default figure({
  build(g) {
    const a = g.param('a', 1.4, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 0.8, { min: 0.4, max: 2, label: 'C' });
    const e = g.param('e', 1.1, { min: 0.4, max: 2, label: 'E' });
    const m = g.param('m', 2, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'n' });
    const f = (e * b) / a;
    const d = (e * b) / c;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'G', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'H', parts: [m * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'L', parts: [n * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'K', parts: [m * d], unit: d }],
      [{ name: 'E', parts: [e] }, { name: 'M', parts: [n * e], unit: e }],
      [{ name: 'F', parts: [f] }, { name: 'N', parts: [n * f], unit: f }],
    ], { dy: 0.8 });
    g.equal('G : H = M : N', a / b, e / f);
    g.equal('H : L = K : M', (m * b) / (n * c), (m * d) / (n * e));
    alike(g, 'G', 'L', [m * a, n * c], 'K', 'N', [m * d, n * f]);
    g.equal('A : C = D : F', a / c, d / f);
  },
});
