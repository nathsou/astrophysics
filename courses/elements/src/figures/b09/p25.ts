import { figure } from '../../geometry/figure';
import { Rods, isEven, isOdd } from './lib';

// AB even, BC odd; CD a unit of BC.
export default figure({
  caption: 'The odd number BC is taken from the even number AB. Take the unit CD from BC: DB is even, so AD is even (IX.24), and CA, a unit less, is odd.',
  build(g) {
    const m = g.param('m', 2, { min: 1, max: 4, label: 'CA = 2m + 1' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'BC = 2n + 1' });
    const ca = 2 * m + 1;
    const bc = 2 * n + 1;
    const ab = ca + bc;
    const R = new Rods(g, ab);
    R.seg('A', 'B', ab, 0, 0);
    R.mark('C', 0, 0, ca);
    R.mark('D', 0, 0, ca + 1, { below: true });
    g.show('AB, BC, CA', `${ab}, ${bc}, ${ca}`);
    g.claim('AB even, BC odd', isEven(ab) && isOdd(bc));
    g.claim('DB is even', isEven(bc - 1));
    g.claim('AD is even', isEven(ca + 1));
    g.claim('CA is odd', isOdd(ca));
  },
});
