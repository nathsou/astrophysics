import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// A = D·E is composite; C = A·B = D·E·B.
export default figure({
  caption: 'The composite number A is D taken E times. A times B is C, which is therefore D times E times B: a solid number with sides D, E, B.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 4, label: 'D' });
    const e = g.param('e', 3, { min: 2, max: 4, label: 'E' });
    const b = g.param('b', 3, { min: 2, max: 5, label: 'B' });
    const a = d * e;
    const c = a * b;
    const R = new Rods(g, c);
    R.num('A', a, 0, 0);
    R.groups(0, 0, d, e);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.groups(0, -2.4, a, b);
    R.num('D', d, 0, -3.6);
    R.num('E', e, 0, -4.8);
    g.show('A, B, C', `${a}, ${b}, ${c}`);
    g.equal('A = D·E', a, d * e);
    g.equal('C = D·E·B', c, d * e * b);
    g.claim('C is solid: three sides, each a number', d >= 2 && e >= 2 && b >= 2);
  },
});
