import { figure } from '../../geometry/figure';
import { Nums, continued, divides, list, yn } from './lib';

// A = C², B = D², E = C·D. The sliders are free, so both directions of the theorem show: A measures
// B exactly when C measures D.
export default figure({
  caption: 'A, B are the squares of C, D, and E = C·D is the mean between them. A measures B exactly when C measures D; move the sliders to see both cases.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 5, label: 'C' });
    const d = g.param('d', 6, { min: 2, max: 10, label: 'D' });
    const [A, E, B] = [c * c, c * d, d * d];
    const R = new Nums(g, '8.14', Math.max(A, B), 9);
    R.num('A', A, 0, 0);
    R.num('E', E, 0, -1);
    R.num('B', B, 0, -2);
    if (divides(A, B)) R.groups(0, -2, A, B / A);
    if (divides(A, E)) R.groups(0, -1, A, E / A);
    R.num('C', c, 0, -3.4);
    R.num('D', d, 0, -4.4);
    if (divides(c, d)) R.groups(0, -4.4, c, d / c);
    g.show('A, E, B', list(A, E, B));
    g.show('A measures B', yn(divides(A, B)));
    g.show('C measures D', yn(divides(c, d)));
    g.claim('A, E, B in continued proportion', continued([A, E, B]));
    g.claim('A measures B ⇔ A measures E ⇔ C measures D', divides(A, B) === divides(c, d) && divides(A, E) === divides(c, d));
  },
});
