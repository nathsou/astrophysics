import { figure } from '../../geometry/figure';
import { Nums, continued, list, primeToOther, ratio, same } from './lib';

// Similar plane numbers: the sides C, D of A are s·(p, q) and the sides E, F of B are t·(p, q), so
// C : D = E : F for every slider value. G = D·E.
export default figure({
  caption: 'A = C·D and B = E·F are similar plane numbers: C : D = E : F. G = D·E is a mean proportional between them.',
  build(g) {
    const p = g.param('p', 2, { min: 2, max: 3, label: 'shape p' });
    const q = primeToOther(p, g.param('q', 3, { min: 2, max: 4, label: 'shape q' }));
    const s = g.param('s', 1, { min: 1, max: 3, label: 'scale of A' });
    const t = g.param('t', 2, { min: 1, max: 3, label: 'scale of B' });
    const [C, D, E, F] = [s * p, s * q, t * p, t * q];
    const [A, B, G] = [C * D, E * F, D * E];
    const R = new Nums(g, '8.18', Math.max(A, B, G), 8);
    R.num('A', A, 0, 0);
    R.groups(0, 0, C, D);
    R.num('G', G, 0, -1);
    R.groups(0, -1, D, E);
    R.num('B', B, 0, -2);
    R.groups(0, -2, F, E);
    R.num('C', C, 0, -3.4);
    R.num('D', D, 0, -4.4);
    R.num('E', E, 5, -3.4);
    R.num('F', F, 5, -4.4);
    g.show('A, G, B', list(A, G, B));
    g.claim('C : D = E : F (similar)', same(C, D, E, F));
    g.claim(`A : G = G : B = C : E = ${ratio(C, E)}`, continued([A, G, B]) && same(A, G, C, E) && same(C, E, D, F));
    g.claim(`A : B = C² : E² = ${ratio(A, B)}`, same(A, B, C * C, E * E));
  },
});
