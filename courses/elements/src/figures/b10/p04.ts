import { figure } from '../../geometry/figure';
import { gcd, Lines } from './lib';

// A, B, C are whole multiples of one length w (so they are commensurable). D is the greatest
// common measure of A and B (X.3), E that of C and D. The dashed F is the supposed greater one.
export default figure({
  caption: 'A, B, C are a, b, c times a common length. D = gcd(A, B); when D does not measure C, E = gcd(C, D) is the greatest common measure of all three. The ticks show E.',
  build(g) {
    const w = g.param('w', 0.5, { min: 0.3, max: 0.8, step: 0.01, label: 'common length' });
    const a = g.param('a', 12, { min: 2, max: 12, label: 'A ÷ length' });
    const b = g.param('b', 8, { min: 2, max: 12, label: 'B ÷ length' });
    const c = g.param('c', 6, { min: 2, max: 12, label: 'C ÷ length' });
    const d = gcd(a, b);
    const e = gcd(d, c);
    const L = Lines.fit(g, 12 * w);
    L.mag('A', a * w, 0, 5, { ticks: e * w });
    L.mag('B', b * w, 0, 4, { ticks: e * w });
    L.mag('C', c * w, 0, 3, { ticks: e * w });
    L.mag('D', d * w, 0, 2, { ticks: e * w });
    L.mag('E', e * w, 0, 1);
    L.mag('F', e * w * 1.5, 0, 0, { dashed: true });
    g.show('D measures C', c % d === 0 ? 'yes: D is the answer' : 'no: take E = gcd(C, D)');
    g.equal('E measures A', (a * w) / (e * w), a / e);
    g.claim('E measures A, B and C', a % e === 0 && b % e === 0 && c % e === 0);
    g.equal('A, B, C in units of E have no common factor', gcd(gcd(a / e, b / e), c / e), 1);
  },
});
