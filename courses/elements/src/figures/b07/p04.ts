import { figure } from '../../geometry/figure';
import { Rods, divides, gcd, notMultipleOf } from './lib';

// The third case: A and BC are not prime to one another and BC does not measure A. BC is three
// times D, the greatest common measure, and A is D taken k times with k prime to 3.
export default figure({
  caption: 'The third case: BC is divided into BE, EF, FC, each equal to D, the greatest common measure; each is a part of A, so BC is parts of A.',
  build(g) {
    const d = g.param('d', 3, { min: 2, max: 4, label: 'D' });
    const k0 = g.param('k', 5, { min: 4, max: 10, label: 'A ÷ D' });
    const k = notMultipleOf(3, k0);
    const A = d * k;
    const BC = 3 * d;
    const R = new Rods(g, A);
    R.num('A', A, 0, 0);
    R.seg('B', 'C', BC, 0, -1.2);
    R.mark('E', 0, -1.2, d);
    R.mark('F', 0, -1.2, 2 * d);
    R.num('D', d, 0, -2.4);
    g.show('A, BC', `${A}, ${BC}`);
    g.equal('D = gcd(A, BC)', d, gcd(A, BC));
    g.claim('BC does not measure A', !divides(BC, A));
    g.claim('D measures A', divides(d, A));
    g.show('BC is parts of A', `${BC}/${A} = 3/${k} (three ${k}ths)`);
  },
});
