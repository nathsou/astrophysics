import { figure } from '../../geometry/figure';
import { choose, drawFind, NONSQUARE_PAIRS, order, rat, rootText } from './apotome';
import { line, Rat, Surd } from './ring';

// A = 1, BG = r·A. DF, FE are numbers such that DE has to neither of them the ratio of square
// numbers; GC is found from DE : EF = BG² : GC², and H² = BG² − GC².
export default figure({
  caption: 'A is the rational line (length 1) and BG = r·A. DE has to neither DF nor FE the ratio of a square number to a square number, and DE : EF = BG² : GC².',
  build(g) {
    const r = g.param('r', 1.5, { min: 0.5, max: 2.5, step: 0.25, label: 'BG : A' });
    const [df, fe] = NONSQUARE_PAIRS[choose(g, 'k', 'numbers DF, FE', NONSQUARE_PAIRS.length) - 1];
    const de = df + fe;
    const bg2 = rat(r).mul(rat(r));
    const gc2 = bg2.mul(new Rat(fe, de));
    const h2 = bg2.sub(gc2);
    const [bg, gc, h] = [bg2, gc2, h2].map((x) => Math.sqrt(x.value));
    drawFind(g, bg, gc, h, df, fe);
    const [BG2, GC2, H2] = [bg2, gc2, h2].map((x) => Surd.rat(x));
    g.show('DF, FE, DE', `${df}, ${fe}, ${de}`);
    g.show('BC = BG − GC', `${rootText(bg2)} − ${rootText(gc2)}`);
    g.equal('BG² : GC² = DE : EF', bg2.value / gc2.value, de / fe);
    g.claim('BG, GC are commensurable in square only (X.9)', line.commSqOnly(BG2, GC2));
    g.equal('BG² : H² = ED : DF', bg2.value / h2.value, de / df);
    g.claim('ED : DF is not a ratio of squares, so BG is incommensurable in length with H', !new Rat(de, df).square && !line.comm(BG2, H2));
    g.claim('BC is a fourth apotome', order(BG2, GC2) === 4);
  },
});
