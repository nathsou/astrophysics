import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// AB is two k-th parts of C and DE two k-th parts of F (k odd).
export default figure({
  caption: 'AB is the same parts of C that DE is of F. Alternately, AB is the same part or parts of DE that C is of F.',
  build(g) {
    const k = g.param('k', 5, { min: 3, max: 7, step: 2, label: 'k' });
    const p = g.param('p', 2, { min: 1, max: 4, label: 'AG' });
    const q = g.param('q', 3, { min: 1, max: 4, label: 'DH' });
    const R = new Rods(g, k * Math.max(p, q));
    R.seg('A', 'B', 2 * p, 0, 0);
    R.mark('G', 0, 0, p);
    R.num('C', k * p, 0, -1.2);
    R.seg('D', 'E', 2 * q, 0, -2.6);
    R.mark('H', 0, -2.6, q);
    R.num('F', k * q, 0, -3.8);
    g.show('AB : DE', ratio(2 * p, 2 * q));
    g.show('C : F', ratio(k * p, k * q));
    g.equal('AB·F = DE·C', 2 * p * k * q, 2 * q * k * p);
  },
});
