import { figure } from '../../geometry/figure';
import { LogRods, cbrtInt, isCube } from './lib';

// A = a³ and A·B = C a cube; then B = C / A is b³.
export default figure({
  caption: 'The cube A times B makes the cube C; D is A times itself. Then A is to B as D is to C, two means fall between D and C, so between A and B, and B is a cube. Logarithmic scale.',
  build(g) {
    const s = g.param('a', 2, { min: 2, max: 4, label: 'side of A' });
    const k = g.param('k', 3, { min: 2, max: 4, label: 'side of C ÷ side of A' });
    const a = s ** 3;
    // C must be a cube that A measures: its side is a multiple of the side of A
    const c = (s * k) ** 3;
    const b = c / a;
    const d = a * a;
    const R = new LogRods(g, Math.max(c, d));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    g.claim('A and C are cubes', isCube(a) && isCube(c));
    g.equal('A·B = C', a * b, c);
    g.equal('A : B = D : C (A·C = B·D)', a * c, b * d);
    g.claim('B is cube', isCube(b));
    g.show('side of B', cbrtInt(b));
  },
});
