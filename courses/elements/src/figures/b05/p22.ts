import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A : B = D : E and B : C = E : F (D, E, F = s·A, s·B, s·C). G, H = m·A, m·D; K, L = n·B, n·E;
// M, N = p·C, p·F.
export default figure({
  build(g) {
    const a = g.param('a', 1.1, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 0.8, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 1.3, { min: 0.4, max: 2, label: 'C' });
    const s = g.param('s', 0.7, { min: 0.3, max: 1.5, label: 'D ÷ A' });
    const m = g.param('m', 3, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 2, { min: 1, max: 5, label: 'n' });
    const p = g.param('p', 2, { min: 1, max: 5, label: 'p' });
    const [d, e, f] = [s * a, s * b, s * c];
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'G', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'K', parts: [n * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'M', parts: [p * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'H', parts: [m * d], unit: d }],
      [{ name: 'E', parts: [e] }, { name: 'L', parts: [n * e], unit: e }],
      [{ name: 'F', parts: [f] }, { name: 'N', parts: [p * f], unit: f }],
    ], { dy: 0.8 });
    g.equal('G : K = H : L', (m * a) / (n * b), (m * d) / (n * e));
    g.equal('K : M = L : N', (n * b) / (p * c), (n * e) / (p * f));
    alike(g, 'G', 'M', [m * a, p * c], 'H', 'N', [m * d, p * f]);
    g.equal('A : C = D : F', a / c, d / f);
  },
});
