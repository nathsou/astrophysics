import { figure } from '../../geometry/figure';
import { cmp, rods, sym } from './lib';

// A : B = C : D, D computed. Compare A with C and B with D.
export default figure({
  build(g) {
    const a = g.param('a', 1.6, { min: 0.4, max: 2, label: 'A' });
    const b = g.param('b', 1.2, { min: 0.4, max: 2, label: 'B' });
    const c = g.param('c', 1.1, { min: 0.4, max: 2, label: 'C' });
    const d = (c * b) / a;
    rods(g, [[{ name: 'A', parts: [a] }], [{ name: 'B', parts: [b] }], [{ name: 'C', parts: [c] }], [{ name: 'D', parts: [d] }]]);
    g.equal('A : B = C : D', a / b, c / d);
    g.show('A ? C,  B ? D', `${sym(cmp(a, c))} and ${sym(cmp(b, d))}`);
    g.claim('A ? C and B ? D alike', cmp(a, c) === cmp(b, d));
  },
});
