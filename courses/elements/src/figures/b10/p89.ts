import { figure } from '../../geometry/figure';
import { choose, drawFind, NONSQUARE_PAIRS, order, rat, rootText } from './apotome';
import { line, Rat, Surd } from './ring';

// A = 1, the annex CG = r·A. DF, FE are numbers such that DE has to neither the ratio of square
// numbers; GB is found from FE : ED = CG² : GB², and H² = BG² − GC².
export default figure({
  caption: 'A is the rational line (length 1) and the annex CG = r·A. DE has to neither DF nor FE the ratio of a square number to a square number, and FE : ED = CG² : GB².',
  build(g) {
    const r = g.param('r', 1.25, { min: 0.5, max: 2, step: 0.25, label: 'CG : A' });
    const [df, fe] = NONSQUARE_PAIRS[choose(g, 'k', 'numbers DF, FE', NONSQUARE_PAIRS.length, 3) - 1];
    const de = df + fe;
    const gc2 = rat(r).mul(rat(r));
    const bg2 = gc2.mul(new Rat(de, fe));
    const h2 = bg2.sub(gc2);
    const [bg, gc, h] = [bg2, gc2, h2].map((x) => Math.sqrt(x.value));
    drawFind(g, bg, gc, h, df, fe);
    const [BG2, GC2, H2] = [bg2, gc2, h2].map((x) => Surd.rat(x));
    g.show('DF, FE, DE', `${df}, ${fe}, ${de}`);
    g.show('BC = BG − GC', `${rootText(bg2)} − ${rootText(gc2)}`);
    g.equal('CG² : GB² = FE : ED', gc2.value / bg2.value, fe / de);
    g.claim('BG, GC are commensurable in square only (X.9)', line.commSqOnly(BG2, GC2));
    g.equal('BG² : H² = ED : DF', bg2.value / h2.value, de / df);
    g.claim('BG is incommensurable in length with H', !line.comm(BG2, H2));
    g.claim('the annex CG is commensurable in length with A', line.comm(GC2, Surd.rat(1)));
    g.claim('BC is a fifth apotome', order(BG2, GC2) === 5);
  },
});
