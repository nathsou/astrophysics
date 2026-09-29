import { figure } from '../../geometry/figure';
import { foot, mid, polar } from '../../geometry/vec';
import { isSquare, Lines, nonSquare } from './lib';

// Main part (top): A = 1 and C = √(1 − q²/p²) as in X.29, B = √b a third rational line. D² = A·B and
// D·E = B·C. Then A : C = D : E, so D, E are medial, commensurable in square only, with
// √(D² − E²) : D = q : p, and they contain the medial rectangle B·C. The magnitudes carry their
// letters as text, because the lemma uses A, B, C, D as points.
//
// Lemma (bottom): a triangle ABC right-angled at A, with the perpendicular AD.
export default figure({
  caption: 'Top: the medial lines D, E. Bottom, the lemma: in a right triangle, the perpendicular from the right angle gives CB·BD = BA², BC·CD = CA², BD·DC = AD² and BC·AD = BA·AC.',
  build(g) {
    const p = 3;
    const q = 2;
    let b = nonSquare(g.param('b', 2, { min: 2, max: 7, label: 'B = √b: b' }));
    if (b === 5) b = 6; // B must be commensurable with C = √5/3 in square only
    const t = g.param('t', 0.62, { min: 0.3, max: 0.8, step: 0.01, label: 'where A sits (lemma)' });
    const A = 1;
    const C = Math.sqrt(1 - (q * q) / (p * p));
    const B = Math.sqrt(b) / 2;
    const D = Math.sqrt(A * B);
    const E = (B * C) / D;
    const M = Lines.fit(g, 1.4, 4);
    M.mag('A', A, 0, 6.2, { label: 'text' });
    M.mag('B', B, 0, 5.5, { label: 'text' });
    M.mag('C', C, 0, 4.8, { label: 'text' });
    M.mag('D', D, 5.2, 6.2, { label: 'text' });
    M.mag('E', E, 5.2, 5.5, { label: 'text' });
    // the lemma
    const Bp = M.pt('B', { x: 0, y: 0 }, { labelDir: 180 });
    const Cp = M.pt('C', { x: 9, y: 0 }, { labelDir: 0 });
    const Ap = M.pt('A', polar(mid(Bp, Cp), 4.5, Math.PI * t), { labelDir: 90 });
    const Dp = M.pt('D', foot(Ap, Bp, Cp), { labelDir: 270 });
    g.polygon([Ap, Bp, Cp]);
    g.segment(Ap, Dp);
    g.angle(Bp, Ap, Cp, { right: true });
    g.angle(Ap, Dp, Cp, { right: true });
    const d = (P: { x: number; y: number }, Q: { x: number; y: number }) => Math.hypot(P.x - Q.x, P.y - Q.y);
    g.equal('M.: A : C = D : E', A / C, D / E);
    g.equal('M.: D·E = B·C', D * E, B * C);
    g.equal('M.: √(D² − E²) : D = q : p', Math.sqrt(D * D - E * E) / D, q / p);
    g.claim('b, 5b are not squares: B is commensurable with A and C in square only', !isSquare(b) && !isSquare(5 * b));
    g.equal('L.: CB·BD = BA²', d(Cp, Bp) * d(Bp, Dp), d(Bp, Ap) ** 2);
    g.equal('L.: BD·DC = AD²', d(Bp, Dp) * d(Dp, Cp), d(Ap, Dp) ** 2);
    g.equal('L.: BC·AD = BA·AC', d(Bp, Cp) * d(Ap, Dp), d(Bp, Ap) * d(Ap, Cp));
  },
});
