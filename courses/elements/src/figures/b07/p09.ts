import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// A is a half of BC and D a half of EF, as in the text.
export default figure({
  caption: 'A is the same part of BC that D is of EF. Alternately, A is the same part or parts of D that BC is of EF.',
  build(g) {
    const a = g.param('a', 3, { min: 2, max: 9, label: 'A' });
    const d = g.param('d', 5, { min: 2, max: 9, label: 'D' });
    const R = new Rods(g, 2 * Math.max(a, d));
    R.num('A', a, 0, 0);
    R.seg('B', 'C', 2 * a, 0, -1.2);
    R.mark('G', 0, -1.2, a);
    R.num('D', d, 0, -2.6);
    R.seg('E', 'F', 2 * d, 0, -3.8);
    R.mark('H', 0, -3.8, d);
    g.show('A : D', ratio(a, d));
    g.show('BC : EF', ratio(2 * a, 2 * d));
    g.equal('A·EF = D·BC', a * 2 * d, d * 2 * a);
  },
});
