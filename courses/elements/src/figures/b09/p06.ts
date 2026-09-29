import { figure } from '../../geometry/figure';
import { LogRods, cbrtInt, isCube } from './lib';

// A·A = B a cube; C = A·B.
export default figure({
  caption: 'A times itself makes the cube B, and A times B makes C, also a cube. The unit, A, B, C are in continued proportion; two means fall between B and C, so between A and B, and A is a cube. Logarithmic scale.',
  build(g) {
    const s = g.param('s', 2, { min: 2, max: 4, label: 'side of A' });
    const a = s ** 3;
    const b = a * a;
    const c = a * b;
    const R = new LogRods(g, c);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    g.claim('B = A·A is cube', isCube(b));
    g.claim('C = A·B is cube', isCube(c));
    g.equal('1 : A = A : B', b, a * a);
    g.equal('A : B = B : C (A·C = B·B)', a * c, b * b);
    g.claim('A is cube', isCube(a));
    g.show('side of A', cbrtInt(a));
  },
});
