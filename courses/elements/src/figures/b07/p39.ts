import { figure } from '../../geometry/figure';
import { Rods, divides, leastMeasured, lcmAll } from './lib';

// The given parts are "a D-th, an E-th and an F-th"; G = lcm(D, E, F), and A, B, C are those parts of G.
export default figure({
  caption: 'The parts A, B, C are named after D, E, F (a half, a third, a quarter…). G is the least number measured by D, E, F, and A, B, C are drawn as those parts of G. The dashed H is a supposed smaller number with the same parts.',
  build(g) {
    const d = g.param('d', 2, { min: 2, max: 6, label: 'D' });
    const e = g.param('e', 3, { min: 2, max: 6, label: 'E' });
    const f = g.param('f', 4, { min: 2, max: 6, label: 'F' });
    const G = lcmAll(d, e, f);
    const R = new Rods(g, G);
    R.num('A', G / d, 0, 0);
    R.num('B', G / e, 0, -1.2);
    R.num('C', G / f, 0, -2.4);
    R.num('D', d, 0, -3.8);
    R.num('E', e, 0, -5);
    R.num('F', f, 0, -6.2);
    R.num('G', G, 0, -7.6);
    R.num('H', Math.ceil(G / 2), 0, -8.8, { dashed: true });
    g.show('G; G/D, G/E, G/F', `${G}; ${G / d}, ${G / e}, ${G / f}`);
    g.claim('D, E, F measure G', divides(d, G) && divides(e, G) && divides(f, G));
    g.equal('no smaller number has the parts', leastMeasured(d, e, f), G);
  },
});
