import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// AB odd, BC odd; BD the unit at the end of AB.
export default figure({
  caption: 'The odd number BC is taken from the odd number AB. Take the unit BD: AD is even and CD is even, so the remainder CA is even (IX.24).',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 4, label: 'CA ÷ 2' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'BC = 2n + 1' });
    const ca = 2 * m;
    const bc = 2 * n + 1;
    const ab = ca + bc;
    const R = new Rods(g, ab);
    R.seg('A', 'B', ab, 0, 0);
    R.mark('C', 0, 0, ca);
    R.mark('D', 0, 0, ab - 1, { below: true });
    g.show('AB, BC, CA', `${ab}, ${bc}, ${ca}`);
    g.claim('AB, BC odd', isOdd(ab) && isOdd(bc));
    g.claim('AD is even', isEven(ab - 1));
    g.claim('CD is even', isEven(bc - 1));
    g.claim('CA is even', isEven(ca));
  },
});
