import { figure } from '../../geometry/figure';
import { cfSqrt, Lines, nonSquare } from './lib';

// CD : AB = √n with n not a square. AB measured off along CD as often as possible (FD) leaves CF;
// CF measured off along AB (BG) leaves AG; and so on for ever. E is the supposed common measure of
// the reductio, drawn dashed.
export default figure({
  caption: 'CD : AB = √n. The quotients of the subtraction are the continued fraction of √n, which repeats for ever when n is not a square, so no remainder ever measures the one before it.',
  build(g) {
    const n = nonSquare(g.param('n', 2, { min: 2, max: 15, label: 'n (CD : AB = √n)' }));
    const ab = 3;
    const cd = ab * Math.sqrt(n);
    const q1 = Math.floor(cd / ab);
    const cf = cd - q1 * ab;
    const q2 = Math.floor(ab / cf);
    const ag = ab - q2 * cf;
    const L = Lines.fit(g, cd);
    L.row(['C', 'F', 'D'], [cf, q1 * ab], 0, 2.4);
    L.row(['A', 'G', 'B'], [ag, q2 * cf], 0, 1.2);
    L.mag('E', Math.min(ag, cf) * 0.8, 0, 0, { dashed: true });
    // the copies of AB in FD and of CF in BG
    for (let i = 1; i < q1; i++) g.segment({ x: L.x(cf + i * ab), y: 2.25 }, { x: L.x(cf + i * ab), y: 2.55 }, { aux: true });
    for (let i = 1; i < q2; i++) g.segment({ x: L.x(ag + i * cf), y: 1.05 }, { x: L.x(ag + i * cf), y: 1.35 }, { aux: true });
    const cfq = cfSqrt(n, 9);
    g.show('quotients (continued fraction of √n)', `[${cfq[0]}; ${cfq.slice(1).join(', ')}, …]`);
    g.equal('FD = q₁·AB with q₁ = first quotient', q1, cfq[0]);
    g.equal('BG = q₂·CF with q₂ = second quotient', q2, cfq[1]);
    g.claim('CF < AB', cf < ab);
    g.claim('AG < CF', ag < cf && ag > 0);
    g.claim('n is not a square: the quotients repeat for ever', !Number.isInteger(Math.sqrt(n)));
  },
  unresolved: {},
});
