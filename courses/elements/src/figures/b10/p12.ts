import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// A : C = D : E and C : B = F : G (numbers). H, K, L are continued in these ratios (VIII.4):
// H = D·F, K = E·F, L = E·G. Then A : B = H : L.
export default figure({
  caption: 'A and B are each commensurable with C: A : C = D : E and C : B = F : G. The numbers H = D·F, K = E·F, L = E·G give A : B = H : L.',
  build(g) {
    const c = g.param('c', 2, { min: 1.5, max: 2.5, step: 0.01, label: 'C' });
    const d = g.param('d', 3, { min: 1, max: 4, label: 'D' });
    const e = g.param('e', 2, { min: 1, max: 4, label: 'E' });
    const f = g.param('f', 2, { min: 1, max: 4, label: 'F' });
    const gg = g.param('g', 3, { min: 1, max: 4, label: 'G' });
    const a = (c * d) / e;
    const b = (c * gg) / f;
    const [h, k, l] = [d * f, e * f, e * gg];
    const M = Lines.fit(g, 8, 4);
    M.mag('A', a, 0, 4.2);
    M.mag('C', c, 0, 3.5);
    M.mag('B', b, 0, 2.8);
    const N = new Lines(g, 0.35);
    N.mag('D', d, 0, 1.4, { ticks: 1 });
    N.mag('E', e, 0, 0.7, { ticks: 1 });
    N.mag('F', f, 2.4, 1.4, { ticks: 1 });
    N.mag('G', gg, 2.4, 0.7, { ticks: 1 });
    N.mag('H', h, 4.8, 4.2, { ticks: 1 });
    N.mag('K', k, 4.8, 3.5, { ticks: 1 });
    N.mag('L', l, 4.8, 2.8, { ticks: 1 });
    g.equal('A : C = D : E', a / c, d / e);
    g.equal('C : B = F : G', c / b, f / gg);
    g.equal('H : K = D : E', h / k, d / e);
    g.equal('K : L = F : G', k / l, f / gg);
    g.equal('A : B = H : L', a / b, h / l);
  },
});
