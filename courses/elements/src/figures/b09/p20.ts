import { figure } from '../../geometry/figure';
import { PRIMES, Rods, divides, isPrime, lcmAll, leastPrimeFactor } from './lib';

// A < B < C primes; DE = lcm = product, DF the unit, EF = DE + 1; G its least prime factor.
export default figure({
  caption: 'A, B, C are the given primes, DE the least number they measure (their product), and EF is DE with the unit DF added. G is a prime measuring EF (EF itself when EF is prime). G is none of A, B, C. The primes are drawn at one scale, DE and EF at a smaller one.',
  build(g) {
    const i = g.param('i', 0, { min: 0, max: 2, label: 'A' });
    const j = g.param('j', 1, { min: 0, max: 2, label: 'B' });
    const k = g.param('k', 1, { min: 0, max: 2, label: 'C' });
    const a = PRIMES[i];
    const b = PRIMES[i + 1 + j];
    const c = PRIMES[i + 2 + j + k];
    const de = lcmAll(a, b, c);
    const ef = de + 1;
    const gp = leastPrimeFactor(ef);
    const P = new Rods(g, Math.max(c, gp), 10);
    P.num('A', a, 0, 0);
    P.num('B', b, 0, -1.2);
    P.num('C', c, 0, -2.4);
    const R = new Rods(g, ef, 10);
    R.seg('E', 'F', ef, 0, -3.9, { dirs: [180, 0] });
    R.mark('D', 0, -3.9, de, { dir: 90 });
    P.num('G', gp, 0, -5.4);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.show('DE, EF', `${de}, ${ef}`);
    g.show('EF', isPrime(ef) ? `${ef} is prime (first case)` : `${ef} = ${gp} · ${ef / gp} (second case)`);
    g.equal('DE = lcm(A, B, C) = A·B·C', de, a * b * c);
    g.claim('G is prime and measures EF', isPrime(gp) && divides(gp, ef));
    g.claim('G does not measure DE', !divides(gp, de));
    g.claim('G is none of A, B, C', ![a, b, c].includes(gp));
  },
});
