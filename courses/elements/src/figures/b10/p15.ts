import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// AB = p·D and BC = q·D, laid end to end: D measures the whole AC as well.
export default figure({
  caption: 'AB and BC are p and q copies of D, so AC is p + q copies of D: D measures AB, BC and AC.',
  build(g) {
    const d = g.param('d', 0.8, { min: 0.4, max: 1, step: 0.01, label: 'D' });
    const p = g.param('p', 5, { min: 1, max: 7, label: 'AB ÷ D' });
    const q = g.param('q', 3, { min: 1, max: 7, label: 'BC ÷ D' });
    const L = Lines.fit(g, 14, 10);
    L.row(['A', 'B', 'C'], [p * d, q * d], 0, 1, { style: { ticks: d * L.u } });
    L.mag('D', d, 0, 0);
    g.equal('AC ÷ D = p + q', (p * d + q * d) / d, p + q);
  },
});
