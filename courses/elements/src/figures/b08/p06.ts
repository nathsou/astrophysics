import { figure } from '../../geometry/figure';
import { Nums, continued, divides, gcd, list, primeToOther, progression, same } from './lib';

// A, B, C, D, E = k·a⁴, k·a³b, …, k·b⁴ with a, b prime to one another and a > 1, so that A does not
// measure B. F, G, H = a², ab, b² are the least numbers in the ratio of A, B, C.
export default figure({
  caption: 'A, B, C, D, E are in continued proportion and A does not measure B. F, G, H are the least numbers in the ratio of A, B, C; F is not the unit and F, H are prime to one another, so A cannot measure C.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 3, label: 'ratio a' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 4, label: 'ratio b' }));
    const k = g.param('k', 1, { min: 1, max: 2, label: 'multiple k' });
    const xs = progression(k, a, b, 5);
    const [A, B, C, , E] = xs;
    const [F, G, H] = progression(1, a, b, 3);
    const R = new Nums(g, '8.6', Math.max(A, E), 8);
    (['A', 'B', 'C', 'D', 'E'] as const).forEach((n, i) => R.num(n, xs[i], 0, -i));
    R.num('F', F, 0, -5.4);
    R.num('G', G, 0, -6.4);
    R.num('H', H, 0, -7.4);
    let none = true;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j && divides(xs[i], xs[j])) none = false;
    g.show('A, B, C, D, E', list(...xs));
    g.claim('in continued proportion', continued(xs));
    g.claim('A does not measure B', !divides(A, B));
    g.claim('F ≠ 1 and gcd(F, H) = 1', F !== 1 && gcd(F, H) === 1);
    g.claim('A : C = F : H', same(A, C, F, H));
    g.claim('no one of A, …, E measures another', none);
  },
});
