import { figure } from '../../geometry/figure';
import { cmp, rods, witness } from './lib';

// Contrapositive of V.9: if A ≠ B, there are m, n with m·A and m·B on opposite sides of n·C,
// so A : C ≠ B : C. Set A = B to see that no such m, n remain.
export default figure({
  build(g) {
    const a = g.param('a', 1.4, { min: 0.5, max: 2, label: 'A' });
    const b = g.param('b', 1.2, { min: 0.5, max: 2, label: 'B' });
    const c = g.param('c', 1, { min: 0.5, max: 2, label: 'C' });
    rods(g, [[{ name: 'A', parts: [a] }], [{ name: 'B', parts: [b] }], [{ name: 'C', parts: [c] }]]);
    const s = cmp(a, b);
    if (s === 0) {
      g.show('A = B: every m·A, m·B fall alike against n·C', 'A : C = B : C');
      g.equal('A = B', a, b);
      return;
    }
    const [hi, lo] = s > 0 ? [a, b] : [b, a];
    const w = witness(hi, c, lo, c);
    g.claim('A ≠ B gives a separating pair (m, n)', w !== null);
    if (w) {
      g.show('m, n', `${w[0]}, ${w[1]}`);
      g.claim(`${s > 0 ? 'm·A > n·C ≥ m·B' : 'm·B > n·C ≥ m·A'}: so A : C ≠ B : C`, cmp(w[0] * hi, w[1] * c) > 0 && cmp(w[0] * lo, w[1] * c) <= 0);
    }
  },
});
