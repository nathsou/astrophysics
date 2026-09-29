import { figure } from '../../geometry/figure';
import { mid, v } from '../../geometry/vec';
import { isSquare, Lines, squareRatio } from './lib';

// CD = p² and DE = q² are squares whose difference CE is not a square. On the rational line AB a
// semicircle, with AF chosen so that AB² : AF² = CD : CE. Then AB, AF are rational and
// commensurable in square only, and AB² − AF² = BF² with BF : AB = q : p, commensurable in length.
export default figure({
  caption: 'AB² : AF² = p² : (p² − q²), a ratio that is not of squares, while BF : AB = q : p. Try p = 3, q = 2 (the numbers 9 and 4, difference 5).',
  build(g) {
    const p = g.param('p', 3, { min: 2, max: 6, label: 'CD = p²: p' });
    let q = Math.min(p - 1, g.param('q', 2, { min: 1, max: 5, label: 'DE = q²: q' }));
    while (q > 1 && isSquare(p * p - q * q)) q--;
    if (isSquare(p * p - q * q)) q = p - 1;
    const ab = 1;
    const af = ab * Math.sqrt(1 - (q * q) / (p * p));
    const bf = (ab * q) / p;
    const L = Lines.fit(g, 1, 7);
    const A = L.pt('A', v(0, 0), { labelDir: 180 });
    const B = L.pt('B', v(L.x(ab), 0), { labelDir: 0 });
    const cos = af / ab;
    const F = L.pt('F', v(L.x(af * cos), L.x(af * Math.sqrt(1 - cos * cos))), { labelDir: 90 });
    g.arc(mid(A, B), B, A, { aux: true });
    g.segment(A, B);
    g.segment(A, F);
    g.segment(F, B);
    const N = Lines.fit(g, 36, 7);
    N.row(['C', 'E', 'D'], [p * p - q * q, q * q], 0, -1.2, { below: true, style: { ticks: N.u } });
    const [AF, BF] = [Math.hypot(F.x - A.x, F.y - A.y) / L.u, Math.hypot(F.x - B.x, F.y - B.y) / L.u];
    g.show('CD, DE, CE', `${p * p}, ${q * q}, ${p * p - q * q}`);
    g.equal('AB² : AF² = CD : CE', (ab * ab) / (AF * AF), (p * p) / (p * p - q * q));
    g.claim('CD : CE is not a ratio of squares: AB, AF commensurable in square only', !squareRatio(p * p, p * p - q * q));
    g.equal('AB² = AF² + FB²', ab * ab, AF * AF + BF * BF);
    g.equal('BF : AB = q : p (commensurable in length)', BF / ab, bf / ab);
  },
});
