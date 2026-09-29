import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// A : B = C : D (D is computed from A, B, C). E, F = m·A, m·C; G, H = n·B, n·D;
// K, L = p·E, p·F; M, N = q·G, q·H.
export default figure({
  build(g) {
    const a = g.param('a', 1.2, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 0.9, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 0.8, { min: 0.4, max: 2, label: 'C' });
    const m = g.param('m', 2, { min: 1, max: 4, label: 'm (E = m·A)' });
    const n = g.param('n', 3, { min: 1, max: 4, label: 'n (G = n·B)' });
    const p = g.param('p', 2, { min: 1, max: 4, label: 'p (K = p·E)' });
    const q = g.param('q', 1, { min: 1, max: 4, label: 'q (M = q·G)' });
    const d = (c * b) / a;
    const [E, F, G, H] = [m * a, m * c, n * b, n * d];
    const [K, L, M, N] = [p * E, p * F, q * G, q * H];
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'E', parts: [E], unit: a }, { name: 'K', parts: [K], unit: E }],
      [{ name: 'B', parts: [b] }, { name: 'G', parts: [G], unit: b }, { name: 'M', parts: [M], unit: G }],
      [{ name: 'C', parts: [c] }, { name: 'F', parts: [F], unit: c }, { name: 'L', parts: [L], unit: F }],
      [{ name: 'D', parts: [d] }, { name: 'H', parts: [H], unit: d }, { name: 'N', parts: [N], unit: H }],
    ]);
    g.equal('A : B = C : D', a / b, c / d);
    g.equal('K = pm·A,  L = pm·C', K / a, L / c);
    alike(g, 'K', 'M', [K, M], 'L', 'N', [L, N]);
    g.equal('E : G = F : H', E / G, F / H);
  },
});
