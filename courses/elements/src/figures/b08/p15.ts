import { figure } from '../../geometry/figure';
import { Nums, continued, divides, list, yn } from './lib';

// A = C³, B = D³; E = C², G = D², F = C·D, H = C·F, K = D·F. Free sliders show both directions.
export default figure({
  caption: 'A, B are the cubes of C, D, and H, K are the two means between them. A measures B exactly when C measures D; move the sliders to see both cases.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 4, label: 'C' });
    const d = g.param('d', 4, { min: 2, max: 6, label: 'D' });
    const [E, F, G] = [c * c, c * d, d * d];
    const [A, H, K, B] = [c * E, c * F, d * F, d * G];
    const R = new Nums(g, '8.15', Math.max(A, B), 8);
    R.num('A', A, 0, 0);
    R.num('H', H, 0, -1);
    R.num('K', K, 0, -2);
    R.num('B', B, 0, -3);
    if (divides(A, B)) R.groups(0, -3, A, B / A);
    if (divides(A, H)) R.groups(0, -1, A, H / A);
    R.num('C', c, 0, -4.4);
    R.num('D', d, 0, -5.4);
    if (divides(c, d)) R.groups(0, -5.4, c, d / c);
    R.num('E', E, 4, -4.4);
    R.num('F', F, 4, -5.4);
    R.num('G', G, 4, -6.4);
    g.show('A, H, K, B', list(A, H, K, B));
    g.show('A measures B', yn(divides(A, B)));
    g.show('C measures D', yn(divides(c, d)));
    g.claim('A, H, K, B in continued proportion', continued([A, H, K, B]));
    g.claim('A measures B ⇔ A measures H ⇔ C measures D', divides(A, B) === divides(c, d) && divides(A, H) === divides(c, d));
  },
});
