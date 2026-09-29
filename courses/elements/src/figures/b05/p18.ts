import { figure } from '../../geometry/figure';
import { cmp, rods } from './lib';

// AE : EB = CF : FD (FD computed). The reductio supposes CD : DG = AB : BE with DG < DF; the point
// G of that impossible supposition is drawn between F and D (its position is a slider).
export default figure({
  build(g) {
    const ab = g.param('ab', 1.8, { min: 0.8, max: 2, label: 'AB' });
    const t = g.param('t', 0.4, { min: 0.15, max: 0.85, label: 'EB ÷ AB' });
    const cd = g.param('cd', 1.4, { min: 0.6, max: 2, label: 'CD' });
    const u = g.param('u', 0.6, { min: 0.3, max: 0.9, label: 'supposed DG ÷ DF' });
    const eb = t * ab;
    const ae = ab - eb;
    const fd = t * cd;
    const cf = cd - fd;
    const dg = u * fd;
    rods(g, [
      [{ pts: ['A', 'E', 'B'], parts: [ae, eb] }],
      [{ pts: ['C', 'F', 'G', 'D'], parts: [cf, fd - dg, dg], labelDir: 90 }],
    ]);
    g.equal('AE : EB = CF : FD', ae / eb, cf / fd);
    g.claim('supposed G: CG > CF and GD < FD, so CG : GD ≠ CF : FD', cmp(cd - dg, cf) > 0 && cmp(dg, fd) < 0 && cmp((cd - dg) / dg, cf / fd) !== 0);
    g.equal('AB : BE = CD : FD', ab / eb, cd / fd);
  },
});
