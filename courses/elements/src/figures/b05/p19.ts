import { figure } from '../../geometry/figure';
import { rods } from './lib';

// AB : CD = AE : CF (CF computed).
export default figure({
  build(g) {
    const ab = g.param('ab', 2, { min: 0.8, max: 2.5, label: 'AB' });
    const t = g.param('t', 0.4, { min: 0.1, max: 0.9, label: 'AE ÷ AB' });
    const cd = g.param('cd', 1.3, { min: 0.6, max: 2.5, label: 'CD' });
    const ae = t * ab;
    const cf = t * cd;
    rods(g, [
      [{ pts: ['A', 'E', 'B'], parts: [ae, ab - ae] }],
      [{ pts: ['C', 'F', 'D'], parts: [cf, cd - cf] }],
    ]);
    g.equal('AB : CD = AE : CF', ab / cd, ae / cf);
    g.equal('EB : FD = AB : CD', (ab - ae) / (cd - cf), ab / cd);
    g.equal('convertendo: AB : AE = CD : CF', ab / ae, cd / cf);
  },
});
