import { figure } from '../../geometry/figure';
import { Lines, looksCommensurable, squareRatio } from './lib';

// A : B = C : D with A² : B² = p : q. A and B are commensurable exactly when p : q is a ratio of
// squares (X.9); the figure checks numerically that C, D then behave the same way.
export default figure({
  caption: 'A² : B² = p : q, and D is the fourth proportional to A, B, C. Commensurability passes from A, B to C, D. Try p : q = 4 : 1 and 2 : 1.',
  build(g) {
    const a = g.param('a', 2, { min: 1.5, max: 3, step: 0.01, label: 'A' });
    const c = g.param('c', 2.6, { min: 1.5, max: 3, step: 0.01, label: 'C' });
    const p = g.param('p', 2, { min: 1, max: 9, label: 'p (A² : B² = p : q)' });
    const q = g.param('q', 1, { min: 1, max: 9, label: 'q' });
    const b = a * Math.sqrt(q / p);
    const d = (c * b) / a;
    const L = Lines.fit(g, Math.max(a, b, c, d) * 2 + 1, 10);
    L.mag('A', a, 0, 1);
    L.mag('B', b, 0, 0);
    L.mag('C', c, L.x(Math.max(a, b) + 1), 1);
    L.mag('D', d, L.x(Math.max(a, b) + 1), 0);
    const ab = squareRatio(p, q);
    g.show('A, B', ab ? 'commensurable' : 'incommensurable');
    g.equal('A : B = C : D', a / b, c / d);
    g.claim('C, D commensurable ⇔ A, B commensurable', looksCommensurable(c, d) === ab);
  },
});
