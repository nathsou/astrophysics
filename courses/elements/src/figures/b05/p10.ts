import { figure } from '../../geometry/figure';
import { cmp, rods, witness } from './lib';

// A : C > B : C, shown by a pair (m, n) as in Def. 7: m·A > n·C but m·B ≤ n·C. Then A > B.
export default figure({
  build(g) {
    const a = g.param('a', 1.6, { min: 0.6, max: 2, label: 'A' });
    const t = g.param('t', 0.8, { min: 0.3, max: 0.95, label: 'B ÷ A' });
    const c = g.param('c', 1, { min: 0.5, max: 2, label: 'C' });
    const b = t * a;
    rods(g, [[{ name: 'A', parts: [a] }], [{ name: 'B', parts: [b] }], [{ name: 'C', parts: [c] }]]);
    const w = witness(a, c, b, c);
    g.claim('A : C > B : C (a pair m, n exists)', w !== null);
    if (w) {
      const [m, n] = w;
      g.show('m, n', `${m}, ${n}`);
      g.claim('m·A > n·C and m·B ≤ n·C', cmp(m * a, n * c) > 0 && cmp(m * b, n * c) <= 0);
    }
    const w2 = witness(c, b, c, a);
    g.claim('C : B > C : A (a pair exists)', w2 !== null && cmp(w2[0] * c, w2[1] * b) > 0 && cmp(w2[0] * c, w2[1] * a) <= 0);
    g.claim('A > B', a > b);
  },
});
