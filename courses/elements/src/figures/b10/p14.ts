import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// A : B = C : D, A² = B² + E², C² = D² + F². Then A : E = C : F, so E is commensurable with A
// exactly when F is commensurable with C.
export default figure({
  caption: 'C, D are A, B scaled by one factor, so the excess squares scale too: A : E = C : F.',
  build(g) {
    const a = g.param('a', 2.5, { min: 2, max: 3, step: 0.01, label: 'A' });
    const t = g.param('t', 0.6, { min: 0.2, max: 0.95, step: 0.01, label: 'B ÷ A' });
    const k = g.param('k', 1.3, { min: 0.6, max: 1.6, step: 0.01, label: 'C ÷ A' });
    const b = a * t;
    const c = a * k;
    const d = (c * b) / a;
    const e = Math.sqrt(a * a - b * b);
    const f = Math.sqrt(c * c - d * d);
    const L = Lines.fit(g, 2 * Math.max(a, c) + 1, 10);
    const x2 = L.x(Math.max(a, c) + 1);
    L.mag('A', a, 0, 2);
    L.mag('B', b, 0, 1);
    L.mag('E', e, 0, 0);
    L.mag('C', c, x2, 2);
    L.mag('D', d, x2, 1);
    L.mag('F', f, x2, 0);
    g.equal('A : B = C : D', a / b, c / d);
    g.equal('A² = B² + E²', a * a, b * b + e * e);
    g.equal('C² = D² + F²', c * c, d * d + f * f);
    g.equal('A : E = C : F', a / e, c / f);
  },
});
