import { figure } from '../../geometry/figure';
import { Rods, isEven } from './lib';

// AB even, BC even taken from its end; CA the remainder.
export default figure({
  caption: 'The even number BC is taken from the even number AB. Both have halves, so the remainder CA has a half too: the half of AB less the half of BC.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 5, label: 'CA ÷ 2' });
    const n = g.param('n', 3, { min: 1, max: 5, label: 'BC ÷ 2' });
    const ab = 2 * (m + n);
    const bc = 2 * n;
    const R = new Rods(g, ab);
    R.seg('A', 'B', ab, 0, 0);
    R.mark('C', 0, 0, ab - bc);
    R.bare(ab / 2, 0, -1, '½ AB', { aux: true });
    R.bare(bc / 2, R.x(ab / 2 - bc / 2), -1.6, '½ BC', { aux: true });
    g.show('AB, BC, CA', `${ab}, ${bc}, ${ab - bc}`);
    g.claim('AB, BC even', isEven(ab) && isEven(bc));
    g.equal('½ AB − ½ BC = ½ CA', ab / 2 - bc / 2, (ab - bc) / 2);
    g.claim('CA is even', isEven(ab - bc));
  },
});
