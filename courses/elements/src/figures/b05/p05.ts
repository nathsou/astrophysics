import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB = m·CD and AE = m·CF. G is found by making EB = m·CG; it lies beyond C, with GC = FD.
export default figure({
  build(g) {
    const cd = g.param('cd', 1.5, { min: 0.6, max: 2.5, label: 'CD' });
    const t = g.param('t', 0.4, { min: 0.15, max: 0.85, label: 'CF ÷ CD' });
    const m = g.param('m', 3, { min: 2, max: 5, label: 'm' });
    const cf = t * cd;
    const fd = cd - cf;
    const ae = m * cf;
    const eb = m * fd;
    const cg = eb / m;
    rods(g, [
      [{ pts: ['A', 'E', 'B'], parts: [ae, eb], unit: cf }],
      [{ pts: ['G', 'C', 'F', 'D'], parts: [cg, cf, fd] }],
    ]);
    g.equal('GF = CD', cg + cf, cd);
    g.equal('GC = FD', cg, fd);
    g.equal('EB = m·FD', eb, m * fd);
  },
});
