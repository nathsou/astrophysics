import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { isSquare, Lines, nonSquare, root4, sumSquare } from './lib';

// Against ρ = 1: AB = x·⁴√k and BC = y·⁴√k³ are medial, commensurable in square only
// (AB² : BC² = x² : y²k), and contain the rational rectangle xyk. Their sum is the first bimedial.
export default figure({
  caption: 'AC = x·⁴√k + y·⁴√k³. AC² = 2xyk + (x² + y²k)√k: a rational part (twice the rectangle) plus a medial part (the two squares), so AC² is irrational.',
  build(g) {
    const k = nonSquare(g.param('k', 3, { min: 2, max: 7, label: 'k' }));
    const x = g.param('x', 2, { min: 1, max: 3, label: 'AB = x·⁴√k: x' });
    const y = g.param('y', 1, { min: 1, max: 2, label: 'BC = y·⁴√k³: y' });
    const r = Math.pow(k, 0.25);
    const [ab, bc] = [x * r, y * r ** 3];
    const L = Lines.fit(g, 3 * Math.pow(7, 0.25) + 2 * Math.pow(7, 0.75), 7);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 0);
    sumSquare(L, ab, bc, v(0, -0.4));
    g.show('AB, BC', `${x === 1 ? '' : x}${root4(k)}, ${y === 1 ? '' : y}${root4(k ** 3)}`);
    g.equal('AB·BC = xyk (rational)', ab * bc, x * y * k);
    g.equal('AB² + BC² = (x² + y²k)·√k (medial)', ab * ab + bc * bc, (x * x + y * y * k) * Math.sqrt(k));
    g.equal('AC² = 2xyk + (x² + y²k)√k', (ab + bc) ** 2, 2 * x * y * k + (x * x + y * y * k) * Math.sqrt(k));
    g.claim('k is not a square: AB, BC commensurable in square only, AC² irrational', !isSquare(k));
  },
});
