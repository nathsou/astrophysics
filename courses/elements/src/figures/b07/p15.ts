import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// The unit A measures BC (three units BG, GH, HC) as many times as D measures EF (EK, KL, LF).
export default figure({
  caption: 'The unit A measures BC as many times as D measures EF; alternately, A measures D as many times as BC measures EF.',
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 8, label: 'D' });
    const R = new Rods(g, 3 * d);
    R.num('A', 1, 0, 0);
    R.seg('B', 'C', 3, 0, -1.2);
    R.mark('G', 0, -1.2, 1);
    R.mark('H', 0, -1.2, 2);
    R.num('D', d, 0, -2.6);
    R.seg('E', 'F', 3 * d, 0, -3.8);
    R.mark('K', 0, -3.8, d);
    R.mark('L', 0, -3.8, 2 * d);
    g.equal('EF ÷ D = BC ÷ A', (3 * d) / d, 3 / 1);
    g.equal('D ÷ A = EF ÷ BC', d / 1, (3 * d) / 3);
  },
});
