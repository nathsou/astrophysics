import { figure } from '../../geometry/figure';
import { alike, rods } from './lib';

// AB : BE = CD : DF (componendo; DF computed). GH, HK = m·AE, m·EB; LM, MN = m·CF, m·FD;
// KO = n·EB, NP = n·FD.
export default figure({
  build(g) {
    const ab = g.param('ab', 1.6, { min: 0.8, max: 2, label: 'AB' });
    const t = g.param('t', 0.4, { min: 0.15, max: 0.85, label: 'BE ÷ AB' });
    const cd = g.param('cd', 1.2, { min: 0.6, max: 2, label: 'CD' });
    const m = g.param('m', 2, { min: 1, max: 4, label: 'm' });
    const n = g.param('n', 2, { min: 1, max: 4, label: 'n' });
    const eb = t * ab;
    const ae = ab - eb;
    const fd = t * cd;
    const cf = cd - fd;
    rods(g, [
      [{ pts: ['A', 'E', 'B'], parts: [ae, eb] }],
      [{ pts: ['C', 'F', 'D'], parts: [cf, fd] }],
      [{ pts: ['G', 'H', 'K', 'O'], parts: [m * ae, m * eb, n * eb] }],
      [{ pts: ['L', 'M', 'N', 'P'], parts: [m * cf, m * fd, n * fd] }],
    ]);
    g.equal('AB : BE = CD : DF', ab / eb, cd / fd);
    g.equal('GK = m·AB, LN = m·CD', (m * ae + m * eb) / ab, (m * cf + m * fd) / cd);
    alike(g, 'GK', 'HO', [m * ab, (m + n) * eb], 'LN', 'MP', [m * cd, (m + n) * fd]);
    alike(g, 'GH', 'KO', [m * ae, n * eb], 'LM', 'NP', [m * cf, n * fd]);
    g.equal('AE : EB = CF : FD', ae / eb, cf / fd);
  },
});
