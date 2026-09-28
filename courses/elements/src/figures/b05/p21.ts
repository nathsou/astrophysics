import { figure } from '../../geometry/figure';
import { cmp, rods, sym } from './lib';

// Perturbed: A : B = E : F and B : C = D : E (D and F computed from A, B, C, E).
export default figure({
  build(g) {
    const a = g.param('a', 1.6, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 1.2, { min: 0.4, max: 2, label: 'C' });
    const e = g.param('e', 0.9, { min: 0.4, max: 2, label: 'E' });
    const f = (e * b) / a;
    const d = (e * b) / c;
    rods(g, [
      [{ name: 'A', parts: [a] }, { name: 'D', parts: [d] }],
      [{ name: 'B', parts: [b] }, { name: 'E', parts: [e] }],
      [{ name: 'C', parts: [c] }, { name: 'F', parts: [f] }],
    ], { gap: 1.5 });
    g.equal('A : B = E : F', a / b, e / f);
    g.equal('B : C = D : E', b / c, d / e);
    g.show('A ? C,  D ? F', `${sym(cmp(a, c))} and ${sym(cmp(d, f))}`);
    g.claim('A ? C and D ? F alike', cmp(a, c) === cmp(d, f));
  },
});
