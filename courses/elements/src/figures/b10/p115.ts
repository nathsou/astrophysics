import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { Lines } from './lib';
import { isSquareInt, need } from './ring';

// B = 1 is rational and A = ⁴√k is medial (k not a square). C² = B·A, D² = B·C, …: each new line
// is the mean proportional between B and the previous one, so C = ⁸√k, D = ¹⁶√k, …
const sup = (n: number) => String(n).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);

export default figure({
  caption: 'B = 1 is the rational line and A = ⁴√k a medial line (k not a square). The square on C equals the rectangle B, A, and the square on D the rectangle B, C: the rectangles and squares on the right have equal areas.',
  build(g) {
    const k = g.param('k', 10, { min: 2, max: 40, label: 'k (A⁴ = k)' });
    need(!isSquareInt(k), 'k is not a square');
    const b = 1;
    const a = k ** (1 / 4);
    const c = Math.sqrt(b * a);
    const d = Math.sqrt(b * c);
    const L = Lines.fit(g, a + 0.4 + c, 8);
    L.mag('B', b, 0, 2.4);
    L.mag('A', a, 0, 1.6);
    L.mag('C', c, 0, 0.8);
    L.mag('D', d, 0, 0);
    // the rectangle B, A beside the square on C; the rectangle B, C beside the square on D
    const box = (x: number, top: number, w: number, h: number, text: string) => {
      g.polygon([v(x, top - L.x(h)), v(x + L.x(w), top - L.x(h)), v(x + L.x(w), top), v(x, top)], { fill: true, aux: true });
      g.text(v(x + L.x(w) / 2, top - L.x(h) / 2), text);
    };
    const x2 = L.x(a + 0.4);
    const top1 = -0.9;
    box(0, top1, a, b, 'B·A');
    box(x2, top1, c, c, 'C²');
    const top2 = top1 - L.x(c) - 0.7;
    box(0, top2, c, b, 'B·C');
    box(x2, top2, d, d, 'D²');
    g.show('A, C, D', `⁴√${k}, ⁸√${k}, ¹⁶√${k}`);
    g.show('next lines', [5, 6, 7].map((n) => `${sup(2 ** n)}√${k}`).join(', '));
    g.equal('A⁴ = k', a ** 4, k);
    g.claim('k is not a square, so A² = √k is irrational and A is medial', !isSquareInt(k));
    g.equal('C² = B · A', c * c, b * a);
    g.equal('D² = B · C', d * d, b * c);
    g.equal('D¹⁶ = k', d ** 16, k);
  },
});
