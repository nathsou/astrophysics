import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// AB odd, BC even; AD the unit at the start of AB.
export default figure({
  caption: 'The even number BC is taken from the odd number AB. Take the unit AD: DB is even, so CD is even (IX.24), and CA, a unit more, is odd.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 4, label: 'CA = 2m + 1' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'BC ÷ 2' });
    const ca = 2 * m + 1;
    const bc = 2 * n;
    const ab = ca + bc;
    const R = new Rods(g, ab);
    R.seg('A', 'B', ab, 0, 0);
    R.mark('D', 0, 0, 1, { below: true });
    R.mark('C', 0, 0, ca);
    g.show('AB, BC, CA', `${ab}, ${bc}, ${ca}`);
    g.claim('AB odd, BC even', isOdd(ab) && isEven(bc));
    g.claim('DB is even', isEven(ab - 1));
    g.claim('CD is even', isEven(ca - 1));
    g.claim('CA is odd', isOdd(ca));
  },
});
