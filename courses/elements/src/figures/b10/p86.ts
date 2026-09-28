import { figure } from '../../geometry/figure';
import { choose, drawFind, order, rat, rootText, SQUARE_PAIRS } from './apotome';
import { line, Rat, Surd } from './ring';

// A = 1, the annex CG = r·A. DE = m², EF = n², DF = m² − n² not a square; GB is found from
// FD : DE = CG² : GB², and H² = BG² − GC².
export default figure({
  caption: 'A is the rational line (length 1) and this time the annex CG = r·A is commensurable with it. DE, EF are square numbers, DF is not a square, and FD : DE = CG² : GB².',
  build(g) {
    const r = g.param('r', 1.5, { min: 0.5, max: 2, step: 0.25, label: 'CG : A' });
    const [m, n] = SQUARE_PAIRS[choose(g, 'k', 'numbers DE, EF', SQUARE_PAIRS.length) - 1];
    const [de, ef] = [m * m, n * n];
    const df = de - ef;
    const gc2 = rat(r).mul(rat(r));
    const bg2 = gc2.mul(new Rat(de, df));
    const h2 = bg2.sub(gc2);
    const [bg, gc, h] = [bg2, gc2, h2].map((x) => Math.sqrt(x.value));
    drawFind(g, bg, gc, h, df, ef);
    const [BG2, GC2, H2] = [bg2, gc2, h2].map((x) => Surd.rat(x));
    g.show('DE, EF, DF', `${de}, ${ef}, ${df}`);
    g.show('BC = BG − GC', `${rootText(bg2)} − ${rootText(gc2)}`);
    g.equal('CG² : GB² = FD : DE', gc2.value / bg2.value, df / de);
    g.claim('BG, GC are commensurable in square only (X.9)', line.commSqOnly(BG2, GC2));
    g.equal('BG² − GC² = H²', bg * bg - gc * gc, h * h);
    g.equal('BG : H = √DE : √EF', bg / h, m / n);
    g.claim('BG is commensurable in length with H', line.comm(BG2, H2));
    g.claim('the annex CG is commensurable in length with A', line.comm(GC2, Surd.rat(1)));
    g.claim('BC is a second apotome', order(BG2, GC2) === 2);
  },
});
