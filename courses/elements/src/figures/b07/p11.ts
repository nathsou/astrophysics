import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// AB : CD = AE : CF = m : n.
export default figure({
  caption: 'As the whole AB is to the whole CD, so is AE, taken away, to CF, taken away. Then the remainders EB and FD are in the same ratio.',
  build(g) {
    const m = g.param('m', 3, { min: 2, max: 5, label: 'm' });
    const n = g.param('n', 4, { min: 2, max: 5, label: 'n' });
    const s = g.param('s', 3, { min: 2, max: 4, label: 's' });
    const t0 = g.param('t', 1, { min: 1, max: 3, label: 't' });
    const t = Math.min(t0, s - 1);
    const AB = m * s;
    const CD = n * s;
    const AE = m * t;
    const CF = n * t;
    const R = new Rods(g, Math.max(AB, CD));
    R.seg('A', 'B', AB, 0, 0);
    R.mark('E', 0, 0, AE);
    R.seg('C', 'D', CD, 0, -1.2);
    R.mark('F', 0, -1.2, CF);
    g.show('AB : CD', ratio(AB, CD));
    g.show('AE : CF', ratio(AE, CF));
    g.show('EB : FD', ratio(AB - AE, CD - CF));
    g.equal('EB·CD = FD·AB', (AB - AE) * CD, (CD - CF) * AB);
  },
});
