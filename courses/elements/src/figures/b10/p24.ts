import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare, root4 } from './lib';

// Against ρ = 1: AB = a·⁴√k and BC = b·⁴√k are medial and commensurable in length. The square AD
// on AB is medial, and the rectangle AC is to it as BC to BD, so AC is medial too.
export default figure({
  caption: 'AB = a·⁴√k, BC = b·⁴√k: medial and commensurable in length. The rectangle AC = ab·√k·ρ², a medial area.',
  build(g) {
    const k = nonSquare(g.param('k', 3, { min: 2, max: 7, label: 'k' }));
    const a = g.param('a', 1, { min: 1, max: 3, label: 'AB = a·⁴√k: a' });
    const b = g.param('b', 2, { min: 1, max: 3, label: 'BC = b·⁴√k: b' });
    const r = Math.pow(k, 0.25);
    const ab = a * r;
    const bc = b * r;
    const L = Lines.fit(g, 6 * Math.pow(7, 0.25) + 1, 10);
    L.rect(['D', 'B', 'A', '~1'], 0, 0, ab, ab, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['B', 'C', '~2', 'A'], ab, 0, bc, ab, {}, [270, 315, 45, 90]);
    L.bare(1, 0, -0.9, 'ρ');
    g.show('AB, BC', `${a === 1 ? '' : a}${root4(k)}, ${b === 1 ? '' : b}${root4(k)}`);
    g.equal('AC = ab·√k (in ρ²)', ab * bc, a * b * Math.sqrt(k));
    g.claim('k is not a square, so AC is medial', !isSquare(k));
    g.equal('DA : AC = BD : BC', (ab * ab) / (ab * bc), ab / bc);
  },
});
