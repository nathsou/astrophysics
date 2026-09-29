import { figure } from '../../geometry/figure';
import { mid, v } from '../../geometry/vec';
import { isSquare, Lines, squareRatio } from './lib';

// CE = p² and ED = q² are squares whose sum CD is not a square. On the rational line AB a
// semicircle, with AB² : AF² = CD : CE. Then AB, AF are rational and commensurable in square only,
// and the excess BF² has BF² : AB² = q² : (p² + q²), so BF is incommensurable with AB in length.
export default figure({
  caption: 'AB² : AF² = (p² + q²) : p² and AB² : BF² = (p² + q²) : q², neither a ratio of squares. Try p = 2, q = 1 (4 + 1 = 5).',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 5, label: 'CE = p²: p' });
    let q = g.param('q', 1, { min: 1, max: 5, label: 'ED = q²: q' });
    while (isSquare(p * p + q * q)) q++;
    const s = p * p + q * q;
    const ab = 1;
    const af = ab * Math.sqrt((p * p) / s);
    const L = Lines.fit(g, 1, 7);
    const A = L.pt('A', v(0, 0), { labelDir: 180 });
    const B = L.pt('B', v(L.x(ab), 0), { labelDir: 0 });
    const cos = af / ab;
    const F = L.pt('F', v(L.x(af * cos), L.x(af * Math.sqrt(1 - cos * cos))), { labelDir: 90 });
    g.arc(mid(A, B), B, A, { aux: true });
    g.segment(A, B);
    g.segment(A, F);
    g.segment(F, B);
    const N = Lines.fit(g, 61, 7);
    N.row(['C', 'E', 'D'], [p * p, q * q], 0, -1.2, { below: true, style: { ticks: N.u } });
    const [AF, BF] = [Math.hypot(F.x - A.x, F.y - A.y) / L.u, Math.hypot(F.x - B.x, F.y - B.y) / L.u];
    g.show('CE, ED, CD', `${p * p}, ${q * q}, ${s}`);
    g.equal('AB² : AF² = CD : CE', (ab * ab) / (AF * AF), s / (p * p));
    g.claim('CD : CE is not a ratio of squares', !squareRatio(s, p * p));
    g.equal('AB² = AF² + FB²', ab * ab, AF * AF + BF * BF);
    g.equal('AB² : BF² = CD : DE', (ab * ab) / (BF * BF), s / (q * q));
    g.claim('CD : DE is not a ratio of squares: BF incommensurable with AB', !squareRatio(s, q * q));
  },
});
