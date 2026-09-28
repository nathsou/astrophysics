import { figure } from '../../geometry/figure';
import { Nums, continued, gcd, isCube, isSquare, list, primeToOther, ratio, same } from './lib';

// A : B is a ratio in least numbers (a, b prime to one another). C, D, E = A², AB, B² and
// F, G, H, K = A³, A²B, AB², B³.
export default figure({
  caption: 'From the ratio A : B in least numbers, three and then four numbers in continued proportion: C, D, E = A², AB, B², and F, G, H, K = A·C, A·D, A·E, B·E.',
  build(g) {
    const a = g.param('a', 2, { min: 2, max: 4, label: 'A' });
    const b = primeToOther(a, g.param('b', 3, { min: 2, max: 5, label: 'B' }));
    const [C, D, E] = [a * a, a * b, b * b];
    const [F, G, H, K] = [a * C, a * D, a * E, b * E];
    const R = new Nums(g, '8.2', Math.max(F, K), 8);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1);
    R.num('C', C, 0, -2.4);
    R.groups(0, -2.4, a, a);
    R.num('D', D, 0, -3.4);
    R.groups(0, -3.4, a, b);
    R.num('E', E, 0, -4.4);
    R.groups(0, -4.4, b, b);
    R.num('F', F, 0, -5.8);
    R.groups(0, -5.8, C, a);
    R.num('G', G, 0, -6.8);
    R.groups(0, -6.8, D, a);
    R.num('H', H, 0, -7.8);
    R.groups(0, -7.8, E, a);
    R.num('K', K, 0, -8.8);
    R.groups(0, -8.8, E, b);
    g.show('C, D, E', list(C, D, E));
    g.show('F, G, H, K', list(F, G, H, K));
    g.equal('gcd(A, B)', gcd(a, b), 1);
    g.claim(`C, D, E in continued proportion, ratio ${ratio(a, b)}`, continued([C, D, E]) && same(C, D, a, b));
    g.claim(`F, G, H, K in continued proportion, ratio ${ratio(a, b)}`, continued([F, G, H, K]) && same(F, G, a, b));
    g.equal('gcd(C, E)', gcd(C, E), 1);
    g.equal('gcd(F, K)', gcd(F, K), 1);
    g.claim('porism: C, E squares; F, K cubes', isSquare(C) && isSquare(E) && isCube(F) && isCube(K));
  },
});
