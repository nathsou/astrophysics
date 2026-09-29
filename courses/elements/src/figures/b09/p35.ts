import { figure } from '../../geometry/figure';
import { Rods, gcd } from './lib';

const RATIOS: [number, number][] = [
  [3, 2],
  [2, 1],
  [3, 1],
  [4, 3],
];

// A, BC, D, EF = m·p³, m·p²q, m·pq², m·q³. BG = FH = A, FK = BC, FL = D.
export default figure({
  caption: 'A, BC, D, EF are in continued proportion, A the least. BG and FH are equal to A, FK to BC, FL to D. Then the excess GC of the second is to the first A as the excess EH of the last is to the sum A + BC + D of all before it.',
  build(g) {
    const r = g.param('r', 0, { min: 0, max: RATIOS.length - 1, label: 'ratio' });
    const m0 = g.param('m', 1, { min: 1, max: 2, label: 'multiple' });
    const [q, p] = RATIOS[r];
    const m = p === 1 ? m0 + 1 : m0;
    const [a, bc, d, ef] = [m * p ** 3, m * p * p * q, m * p * q * q, m * q ** 3];
    const R = new Rods(g, ef);
    R.num('A', a, 0, 0);
    R.seg('B', 'C', bc, 0, -1.2);
    R.mark('G', 0, -1.2, a);
    R.num('D', d, 0, -2.4);
    R.seg('E', 'F', ef, 0, -3.8);
    R.mark('L', 0, -3.8, ef - d);
    R.mark('K', 0, -3.8, ef - bc);
    R.mark('H', 0, -3.8, ef - a);
    const gc = bc - a;
    const eh = ef - a;
    const before = a + bc + d;
    g.show('A, BC, D, EF', `${a}, ${bc}, ${d}, ${ef} (ratio ${q} : ${p})`);
    g.show('GC : A', `${gc / gcd(gc, a)} : ${a / gcd(gc, a)}`);
    g.show('EH : A + BC + D', `${eh / gcd(eh, before)} : ${before / gcd(eh, before)}`);
    g.equal('HK = GC', bc - a, gc);
    g.equal('GC : A = EH : (A + BC + D)', gc * before, eh * a);
    g.equal('A + BC + D = A·(EF − A) / (BC − A)', before, (a * (ef - a)) / (bc - a));
  },
});
