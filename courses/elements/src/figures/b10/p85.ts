import { figure } from '../../geometry/figure';
import { choose, drawFind, order, rat, rootText, SQUARE_PAIRS } from './apotome';
import { line, Rat, Surd } from './ring';

// A = 1 is the rational line set out, BG = r·A. DE = m², EF = n² are square numbers whose
// difference DF is not a square; GC is found from ED : DF = BG² : GC² (X.6 Por.), and H² = BG² − GC².
export default figure({
  caption: 'A is the rational line (length 1) and BG = r·A. The numbers DE, EF are squares and their difference DF is not; GC is chosen so that ED : DF = BG² : GC².',
  build(g) {
    const r = g.param('r', 1.5, { min: 0.5, max: 2.5, step: 0.25, label: 'BG : A' });
    const [m, n] = SQUARE_PAIRS[choose(g, 'k', 'numbers DE, EF', SQUARE_PAIRS.length) - 1];
    const [de, ef] = [m * m, n * n];
    const df = de - ef;
    const bg2 = rat(r).mul(rat(r));
    const gc2 = bg2.mul(new Rat(df, de));
    const h2 = bg2.sub(gc2);
    const [bg, gc, h] = [bg2, gc2, h2].map((x) => Math.sqrt(x.value));
    drawFind(g, bg, gc, h, df, ef);
    const [BG2, GC2, H2] = [bg2, gc2, h2].map((x) => Surd.rat(x));
    g.show('DE, EF, DF', `${de}, ${ef}, ${df}`);
    g.show('BC = BG − GC', `${rootText(bg2)} − ${rootText(gc2)}`);
    g.equal('BG² : GC² = ED : DF', bg2.value / gc2.value, de / df);
    g.claim('ED : DF is not a ratio of squares, so BG, GC are commensurable in square only (X.9)', line.commSqOnly(BG2, GC2));
    g.equal('BG² − GC² = H²', bg * bg - gc * gc, h * h);
    g.equal('BG : H = √DE : √EF', bg / h, m / n);
    g.claim('BG is commensurable in length with H and with A', line.comm(BG2, H2) && line.comm(BG2, Surd.rat(1)));
    g.claim('BC is a first apotome', order(BG2, GC2) === 1);
  },
});
