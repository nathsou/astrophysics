import { figure } from '../../geometry/figure';
import { Degenerate } from '../../geometry/vec';
import { cmp, rods, witness } from './lib';

// A : B = C : D and C : D > E : F. G, H = m·C, m·E and K, L = n·D, n·F are chosen (Def. 7) so that
// G > K but H ≤ L; M = m·A and N = n·B.
export default figure({
  build(g) {
    const a = g.param('a', 1.2, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 1.5, { min: 0.4, max: 2, label: 'C' });
    const e = g.param('e', 0.9, { min: 0.4, max: 2, label: 'E' });
    const s = g.param('s', 0.35, { min: 0.1, max: 1, label: 'excess of C:D over E:F' });
    const d = (c * b) / a;
    const f = (e * d * (1 + s)) / c; // so that C : D = (1 + s)·(E : F)
    const w = witness(c, d, e, f);
    if (!w) throw new Degenerate('no witness');
    const [m, n] = w;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'M', parts: [m * a], unit: a }],
      [{ name: 'B', parts: [b] }, { name: 'N', parts: [n * b], unit: b }],
      [{ name: 'C', parts: [c] }, { name: 'G', parts: [m * c], unit: c }],
      [{ name: 'D', parts: [d] }, { name: 'K', parts: [n * d], unit: d }],
      [{ name: 'E', parts: [e] }, { name: 'H', parts: [m * e], unit: e }],
      [{ name: 'F', parts: [f] }, { name: 'L', parts: [n * f], unit: f }],
    ], { dy: 0.8 });
    g.show('m, n (least m)', `${m}, ${n}`);
    g.claim('G > K and H ≤ L', cmp(m * c, n * d) > 0 && cmp(m * e, n * f) <= 0);
    g.claim('M > N', cmp(m * a, n * b) > 0);
    g.claim('A : B > E : F', a / b > e / f);
  },
});
