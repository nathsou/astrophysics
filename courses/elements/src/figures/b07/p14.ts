import { figure } from '../../geometry/figure';
import { Rods, ratio } from './lib';

// A, B, C = s·(a, b, c) and D, E, F = t·(a, b, c): then A : B = D : E and B : C = E : F.
export default figure({
  caption: 'A : B = D : E and B : C = E : F; then, ex aequali, A : C = D : F.',
  build(g) {
    const a = g.param('a', 2, { min: 1, max: 5, label: 'a' });
    const b = g.param('b', 3, { min: 1, max: 5, label: 'b' });
    const c = g.param('c', 4, { min: 1, max: 5, label: 'c' });
    const s = g.param('s', 2, { min: 2, max: 3, label: 's' });
    const t = g.param('t', 3, { min: 2, max: 3, label: 't' });
    const [A, B, C, D, E, F] = [a * s, b * s, c * s, a * t, b * t, c * t];
    const R = new Rods(g, Math.max(A, B, C, D, E, F), 6);
    R.num('A', A, 0, 0);
    R.num('B', B, 0, -1.2);
    R.num('C', C, 0, -2.4);
    const x2 = 7.5;
    R.num('D', D, x2, 0);
    R.num('E', E, x2, -1.2);
    R.num('F', F, x2, -2.4);
    g.show('A : B = D : E', ratio(A, B));
    g.show('B : C = E : F', ratio(B, C));
    g.show('A : C, D : F', `${ratio(A, C)}, ${ratio(D, F)}`);
    g.equal('A·F = C·D', A * F, C * D);
  },
});
