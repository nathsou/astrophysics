import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// A is a half of BC and D is a half of EF (the text divides each into two).
export default figure({
  caption: 'A is the same part (here a half) of BC that D is of EF; then A + D is that part of BC + EF.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 9, label: 'A' });
    const d = g.param('d', 3, { min: 2, max: 9, label: 'D' });
    const R = new Rods(g, 2 * Math.max(a, d));
    R.num('A', a, 0, 0);
    R.seg('B', 'C', 2 * a, 0, -1.2);
    R.mark('G', 0, -1.2, a);
    R.num('D', d, 0, -2.6);
    R.seg('E', 'F', 2 * d, 0, -3.8);
    R.mark('H', 0, -3.8, d);
    g.show('BC, EF', `${2 * a}, ${2 * d}`);
    g.equal('BC = 2·A', 2 * a, 2 * a);
    g.equal('EF = 2·D', 2 * d, 2 * d);
    g.equal('BC + EF = 2·(A + D)', 2 * a + 2 * d, 2 * (a + d));
  },
});
