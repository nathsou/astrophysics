import { figure } from '../../geometry/figure';
import { Rods, divisors, isPrime, parts } from './lib';

// Heath's case: 1, A, B, C, D = 1, 2, 4, 8, 16, sum E = 31 (prime); E, HK, L, M = 31, 62, 124, 248; FG = E·D = 496.
export default figure({
  caption: 'The unit and A, B, C, D in double proportion add up to the prime E; FG is E times D. E, HK, L, M continue doubling from E, and FG is the next double. FO equals E (the unit and A, B, C, D), OG equals M, L, HK, E; so FG is the sum of its parts. The top five rods are drawn at a larger scale than the rest. The dashed P, Q are a supposed further divisor and its quotient.',
  build(g) {
    const [a, b, c, d] = [2, 4, 8, 16];
    const e = 1 + a + b + c + d;
    const [hk, l, m] = [2 * e, 4 * e, 8 * e];
    const fg = e * d;
    const S = new Rods(g, e, 6);
    S.num('A', a, 0, 0);
    S.num('B', b, 0, -1);
    S.num('C', c, 0, -2);
    S.num('D', d, 0, -3);
    S.num('E', e, 0, -4);
    const R = new Rods(g, fg, 10);
    R.seg('H', 'K', hk, 0, -5.4);
    R.mark('N', 0, -5.4, e);
    R.num('L', l, 0, -6.6);
    R.num('M', m, 0, -7.8);
    R.seg('F', 'G', fg, 0, -9.2);
    R.mark('O', 0, -9.2, e);
    // OG cut into M, L, HK, E; FO cut into D, C, B, A and the unit
    let x = e;
    for (const s of [m, l, hk]) {
      x += s;
      g.segment({ x: R.x(x), y: -9.45 }, { x: R.x(x), y: -8.95 }, { aux: true });
    }
    S.num('P', 3, 0, -10.6, { dashed: true, ticks: false });
    R.num('Q', fg / 3, 5, -10.6, { dashed: true, ticks: false });
    const ps = parts(fg);
    g.show('parts of FG', ps.join(' + '));
    g.claim('E = 1 + A + B + C + D is prime', isPrime(e));
    g.equal('FG = E·D', fg, e * d);
    g.equal('NK = E, so OG = M + L + HK + E', fg - e, m + l + hk + e);
    g.claim('the parts of FG are 1, A, B, C, D, E, HK, L, M', ps.join() === [1, a, b, c, d, e, hk, l, m].join());
    g.equal('FG is perfect: the sum of its parts', ps.reduce((s, t) => s + t, 0), fg);
    g.show('number of divisors', divisors(fg).length);
  },
});
