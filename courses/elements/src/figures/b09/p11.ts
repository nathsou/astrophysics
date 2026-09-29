import { figure } from '../../geometry/figure';
import { LogRods } from './lib';

// The unit A, then B, C, D, E = b, b², b³, b⁴.
export default figure({
  caption: 'From the unit A, the numbers B, C, D, E are in continued proportion. B measures E according to D: on this logarithmic scale E is B and D laid end to end. The porism: the first after the unit measures the last according to the one before the last, the second according to the second before, and so on.',
  build(g) {
    const b = g.param('b', 3, { min: 2, max: 6, label: 'B' });
    const [B, C, D, E] = [1, 2, 3, 4].map((k) => b ** k);
    const R = new LogRods(g, E);
    R.num('A', 1, 0, 0);
    R.num('B', B, 0, -1.1);
    R.num('C', C, 0, -2.2);
    R.num('D', D, 0, -3.3);
    R.num('E', E, 0, -4.4);
    g.equal('A : B = D : E (E = B·D)', E, B * D);
    g.equal('B measures E according to D', E / B, D);
    g.equal('porism: C measures E according to C', E / C, C);
  },
});
