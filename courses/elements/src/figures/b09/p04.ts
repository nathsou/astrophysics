import { figure } from '../../geometry/figure';
import { LogRods, cbrtInt, isCube } from './lib';

// A = a³, B = b³, C = A·B, D = A².
export default figure({
  caption: 'The cubes A and B multiply to C, and D is A times itself. A is to B as D is to C, and two means fall between A and B, so also between D and C. Logarithmic scale.',
  build(g) {
    const s = g.param('a', 2, { min: 2, max: 4, label: 'side of A' });
    const t = g.param('b', 3, { min: 2, max: 4, label: 'side of B' });
    const a = s ** 3;
    const b = t ** 3;
    const c = a * b;
    const d = a * a;
    const R = new LogRods(g, Math.max(c, d));
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    g.claim('D = A·A is cube', isCube(d));
    g.equal('A : B = D : C (A·C = B·D)', a * c, b * d);
    g.show('means between A, B', `${s * s * t}, ${s * t * t}`);
    g.claim('C is cube', isCube(c));
    g.show('side of C', cbrtInt(c));
  },
});
