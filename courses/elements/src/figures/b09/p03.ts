import { figure } from '../../geometry/figure';
import { LogRods, cbrtInt, isCube } from './lib';

// A = C³ (C its side), D = C², B = A².
export default figure({
  caption: 'The cube A has side C, and D is C times itself; B is A times itself. The unit, C, D, A are in continued proportion, so two means fall between A and B. Logarithmic scale: equal ratios are equal steps.',
  build(g) {
    const c = g.param('c', 2, { min: 2, max: 5, label: 'C (side of A)' });
    const d = c * c;
    const a = c * d;
    const b = a * a;
    const R = new LogRods(g, b);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    g.equal('1 : C = C : D (D = C·C)', d, c * c);
    g.equal('C : D = D : A (C·A = D·D)', c * a, d * d);
    g.equal('1 : A = A : B (B = A·A)', b, a * a);
    g.show('means between A, B', `${a * c}, ${a * d}`);
    g.claim('B is cube', isCube(b));
    g.show('side of B', cbrtInt(b));
  },
});
