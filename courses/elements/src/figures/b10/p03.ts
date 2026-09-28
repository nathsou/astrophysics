import { figure } from '../../geometry/figure';
import { gcd, Lines } from './lib';

// Built backwards from the last remainder AF, so that the subtractions go as in the text:
// CD = q₁·AB + EC, AB = q₂·EC + AF, EC = q₃·AF. G is the supposed greater common measure.
export default figure({
  caption: 'The magnitudes are built from the last remainder AF and the quotients of the subtraction. AF measures both; the dashed G, supposed greater, cannot.',
  build(g) {
    const af = g.param('af', 0.7, { min: 0.3, max: 1.2, step: 0.01, label: 'AF' });
    const q3 = g.param('q3', 2, { min: 2, max: 3, label: 'AF in CE' });
    const q2 = g.param('q2', 1, { min: 1, max: 3, label: 'CE in FB' });
    const q1 = g.param('q1', 2, { min: 1, max: 3, label: 'AB in ED' });
    const ec = q3 * af;
    const ab = q2 * ec + af;
    const cd = q1 * ab + ec;
    const L = Lines.fit(g, cd);
    L.row(['C', 'E', 'D'], [ec, q1 * ab], 0, 2.4);
    L.row(['A', 'F', 'B'], [af, q2 * ec], 0, 1.2);
    L.mag('G', af * 1.3, 0, 0, { dashed: true });
    const tick = (x: number, y: number) => g.segment({ x: L.x(x), y: y - 0.15 }, { x: L.x(x), y: y + 0.15 }, { aux: true });
    for (let i = 1; i < q1; i++) tick(ec + i * ab, 2.4);
    for (let i = 1; i < q2; i++) tick(af + i * ec, 1.2);
    for (let i = 1; i < q3; i++) tick(i * af, 2.4);
    const m = Math.round(ab / af);
    const k = Math.round(cd / af);
    g.show('AB, CD in units of AF', `${m}, ${k}`);
    g.equal('AF measures AB', ab / af, m);
    g.equal('AF measures CD', cd / af, k);
    g.equal('gcd of the multiples is 1 (AF is the greatest)', gcd(m, k), 1);
  },
});
