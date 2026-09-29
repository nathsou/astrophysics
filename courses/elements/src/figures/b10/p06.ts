import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// A : B = D : E (numbers). C is the D-th part of A, and F is made of E copies of C.
export default figure({
  caption: 'Given A : B = D : E, cut A into D equal parts C and lay off E of them to make F. Then F = B, so C measures both A and B.',
  build(g) {
    const a = g.param('a', 4, { min: 2.5, max: 5, step: 0.01, label: 'A' });
    const d = g.param('d', 4, { min: 1, max: 6, label: 'D' });
    const e = g.param('e', 5, { min: 1, max: 6, label: 'E' });
    const b = (a * e) / d; // the hypothesis A : B = D : E
    const c = a / d;
    const L = Lines.fit(g, Math.max(a, b, 5 * 1.5), 8);
    L.mag('A', a, 0, 5, { ticks: c });
    L.mag('B', b, 0, 4);
    L.mag('C', c, 0, 3);
    L.mag('F', e * c, 0, 2, { ticks: c });
    const N = Lines.fit(g, 6, 4);
    N.mag('D', d, 0, 1, { ticks: 1 });
    N.mag('E', e, 0, 0, { ticks: 1 });
    g.equal('A : F = D : E', a / (e * c), d / e);
    g.equal('F = B', e * c, b);
    g.equal('C measures B', b / c, e);
  },
});
