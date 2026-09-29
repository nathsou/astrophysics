import { figure } from '../../geometry/figure';
import { mid, v } from '../../geometry/vec';
import { isSquare, Lines, nonSquare, squareRatio } from './lib';

// Main part: B = (p/q)·A is commensurable with A, and C = √n·A (n not a square) is not; then B is
// not commensurable with C either. The magnitudes carry their letters as text, because the lemma
// that follows uses A and B as points: on AB a semicircle, AD fitted equal to C, and DB joined.
export default figure({
  caption: 'Top: A, B commensurable, C = √n·A. Below, the lemma: the square on AB exceeds the square on AD (= C) by the square on DB.',
  build(g) {
    const p = g.param('p', 3, { min: 1, max: 4, label: 'p (B = p/q · A)' });
    const q = g.param('q', 2, { min: 1, max: 4, label: 'q' });
    const n = nonSquare(g.param('n', 2, { min: 2, max: 6, label: 'n (C = √n · A)' }));
    const r = g.param('r', 1.35, { min: 1.1, max: 1.9, step: 0.01, label: 'AB ÷ C (lemma)' });
    const a = 1;
    const b = (a * p) / q;
    const c = a * Math.sqrt(n);
    const L = Lines.fit(g, Math.max(c * r, 2 * c), 8);
    L.mag('A', a, 0, 5.6, { label: 'text' });
    L.mag('B', b, 0, 4.9, { label: 'text' });
    L.mag('C', c, 0, 4.2, { label: 'text' });
    // the lemma
    const ab = c * r;
    const A = L.pt('A', v(0, 0), { labelDir: 180 });
    const B = L.pt('B', v(L.x(ab), 0), { labelDir: 0 });
    const cosA = c / ab;
    const D = L.pt('D', v(L.x(c * cosA), L.x(c * Math.sqrt(1 - cosA * cosA))), { labelDir: 90 });
    g.arc(mid(A, B), B, A, { aux: true });
    g.segment(A, B);
    g.segment(A, D);
    g.segment(D, B);
    g.angle(A, D, B, { right: true });
    g.claim('B : C is not a ratio of squares, so B, C are incommensurable', !squareRatio(p * p, q * q * n) && !isSquare(n));
    const ad = Math.hypot(D.x - A.x, D.y - A.y) / L.u;
    const db = Math.hypot(D.x - B.x, D.y - B.y) / L.u;
    g.equal('AD = C', ad, c);
    g.equal('AB² = AD² + DB²', ab * ab, ad * ad + db * db);
  },
});
