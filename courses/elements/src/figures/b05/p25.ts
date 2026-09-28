import { figure } from '../../geometry/figure';
import { cmp, rods } from './lib';

// AB : CD = E : F with AB the greatest (F computed, hence the least). AG = E, CH = F.
export default figure({
  build(g) {
    const ab = g.param('ab', 2, { min: 1, max: 2.5, label: 'AB' });
    const t = g.param('t', 0.6, { min: 0.2, max: 0.95, label: 'CD ÷ AB' });
    const u = g.param('u', 0.7, { min: 0.2, max: 0.95, label: 'E ÷ AB' });
    const cd = t * ab;
    const e = u * ab;
    const f = (e * cd) / ab;
    rods(g, [
      [{ pts: ['A', 'G', 'B'], parts: [e, ab - e] }],
      [{ pts: ['C', 'H', 'D'], parts: [f, cd - f] }],
      [{ name: 'E', parts: [e] }],
      [{ name: 'F', parts: [f] }],
    ]);
    g.equal('AB : CD = E : F', ab / cd, e / f);
    g.equal('GB : HD = AB : CD', (ab - e) / (cd - f), ab / cd);
    g.show('AB + F', ab + f);
    g.show('CD + E', cd + e);
    g.claim('AB + F > CD + E', cmp(ab + f, cd + e) > 0);
  },
});
