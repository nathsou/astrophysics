import { figure } from '../../geometry/figure';
import { Rods, gcd } from './lib';

// The numbers are built backwards from the remainders, so that Euclid's three subtractions always
// happen as he describes them: CD measures BF leaving FA, AF measures DG leaving GC, GC measures FH
// leaving the unit HA. The sliders are the remainder GC and how many times each number is taken.
export default figure({
  caption: 'AB and CD are built from the remainders, so that the last remainder HA is always a unit. The dashed E is the supposed common measure, which cannot exist.',
  build(g) {
    const r2 = g.param('r2', 2, { min: 2, max: 4, label: 'GC' });
    const q3 = g.param('q3', 2, { min: 1, max: 3, label: 'GC in FH' });
    const q2 = g.param('q2', 1, { min: 1, max: 3, label: 'AF in DG' });
    const q1 = g.param('q1', 2, { min: 1, max: 3, label: 'CD in BF' });
    const r1 = q3 * r2 + 1; // AF
    const b = q2 * r1 + r2; // CD
    const a = q1 * b + r1; // AB
    const R = new Rods(g, a);
    R.seg('A', 'B', a, 0, 0);
    R.seg('C', 'D', b, 0, -1.2);
    R.mark('F', 0, 0, r1);
    R.mark('H', 0, 0, 1);
    R.mark('G', 0, -1.2, r2);
    R.groups(R.x(r1), 0, b, q1, 3);
    R.groups(R.x(r2), -1.2, r1, q2, 3);
    R.groups(R.x(1), 0, r2, q3, 3);
    R.num('E', 2, 0, -2.6, { dashed: true });
    g.show('AB, CD', `${a}, ${b}`);
    g.show('remainders AF, CG, AH', `${r1}, ${r2}, 1`);
    g.equal('AB − BF = AF', a - q1 * b, r1);
    g.equal('CD − DG = CG', b - q2 * r1, r2);
    g.equal('AF − FH = AH = 1', r1 - q3 * r2, 1);
    g.equal('gcd(AB, CD) = 1', gcd(a, b), 1);
  },
});
