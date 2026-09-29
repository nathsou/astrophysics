import { figure } from '../../geometry/figure';
import { Rods, divides } from './lib';

// AB is two k-th parts of C, and DE two k-th parts of F (k odd, so AB is "parts", not "a part").
export default figure({
  caption: 'AB is the same parts of C (two of its k-th parts, AG and GB) that DE is of F (DH and HE). Then AB + DE is the same parts of C + F.',
  build(g) {
    const k = g.param('k', 3, { min: 3, max: 7, step: 2, label: 'k' });
    const p = g.param('p', 3, { min: 1, max: 4, label: 'AG' });
    const q = g.param('q', 2, { min: 1, max: 4, label: 'DH' });
    const R = new Rods(g, k * Math.max(p, q));
    R.seg('A', 'B', 2 * p, 0, 0);
    R.mark('G', 0, 0, p);
    R.num('C', k * p, 0, -1.2);
    R.seg('D', 'E', 2 * q, 0, -2.6);
    R.mark('H', 0, -2.6, q);
    R.num('F', k * q, 0, -3.8);
    R.groups(0, -1.2, p, k, 3);
    R.groups(0, -3.8, q, k, 3);
    const AB = 2 * p;
    const DE = 2 * q;
    const C = k * p;
    const F = k * q;
    g.show('AB of C, DE of F', `${AB}/${C}, ${DE}/${F}`);
    g.claim('AB does not measure C', !divides(AB, C));
    g.equal('k·(AB + DE) = 2·(C + F)', k * (AB + DE), 2 * (C + F));
  },
});
