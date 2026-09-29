import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB = m·C and DE = m·F (first and third); BG = n·C and EH = n·F (fifth and sixth).
export default figure({
  build(g) {
    const c = g.param('c', 1.2, { min: 0.3, max: 2.5, label: 'C' });
    const f = g.param('f', 0.8, { min: 0.3, max: 2.5, label: 'F' });
    const m = g.param('m', 3, { min: 1, max: 5, label: 'm' });
    const n = g.param('n', 2, { min: 1, max: 5, label: 'n' });
    rods(g, [
      [{ pts: ['A', 'B', 'G'], parts: [m * c, n * c], unit: c }],
      [{ name: 'C', parts: [c] }],
      [{ pts: ['D', 'E', 'H'], parts: [m * f, n * f], unit: f }],
      [{ name: 'F', parts: [f] }],
    ]);
    g.equal('AG ÷ C = m + n', (m * c + n * c) / c, m + n);
    g.equal('AG ÷ C = DH ÷ F', (m * c + n * c) / c, (m * f + n * f) / f);
  },
});
