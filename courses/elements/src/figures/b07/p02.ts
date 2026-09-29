import { figure } from '../../geometry/figure';
import { Rods, gcd } from './lib';

// Numbers are rods of units. The numbers are built backwards from the last remainder CF, so that
// the subtractions always go as in Euclid's text: CD measures BE leaving EA, EA measures DF leaving
// FC, and CF measures AE exactly. G is the supposed greater common measure of the reductio.
export default figure({
  caption: 'AB and CD are built from the last remainder CF and the number of times each number is subtracted. The dashed G is the supposed common measure greater than CF.',
  build(g) {
    const r2 = g.param('r2', 3, { min: 2, max: 5, label: 'CF' });
    const q3 = g.param('q3', 2, { min: 2, max: 3, label: 'CF in AE' });
    const q2 = g.param('q2', 2, { min: 1, max: 3, label: 'AE in DF' });
    const q1 = g.param('q1', 2, { min: 1, max: 3, label: 'CD in BE' });
    const r1 = q3 * r2; // AE
    const b = q2 * r1 + r2; // CD
    const a = q1 * b + r1; // AB
    const R = new Rods(g, a);
    R.seg('A', 'B', a, 0, 0);
    R.seg('C', 'D', b, 0, -1.2);
    R.mark('E', 0, 0, r1);
    R.mark('F', 0, -1.2, r2);
    R.groups(R.x(r1), 0, b, q1, 8);
    R.groups(R.x(r2), -1.2, r1, q2, 8);
    R.groups(0, 0, r2, q3, 8);
    R.num('G', r2 + 1, 0, -2.6, { dashed: true });
    g.show('AB, CD', `${a}, ${b}`);
    g.equal('AB − BE = AE', a - q1 * b, r1);
    g.equal('CD − DF = CF', b - q2 * r1, r2);
    g.claim('CF measures AE', r1 % r2 === 0);
    g.claim('CF measures AB and CD', a % r2 === 0 && b % r2 === 0);
    g.equal('CF = gcd(AB, CD)', r2, gcd(a, b));
  },
});
