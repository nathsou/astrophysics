import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { isSquare, Lines, sumSquare } from './lib';

// Against ρ = 1, with n = p² + q² not a square (the lines AD, DB of X.34): AB = √(p(√n + q)/2) and
// BC = √(p(√n − q)/2). AB² + BC² = p√n is medial, AB·BC = ½p² is rational. Their sum is the side of
// a rational plus a medial area.
export default figure({
  caption: 'AC = √(p(√n + q)/2) + √(p(√n − q)/2), n = p² + q². The squares add up to the medial p√n; twice the rectangle is the rational p². AC² is their sum: rational plus medial.',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 4, label: 'p' });
    let q = g.param('q', 1, { min: 1, max: 4, label: 'q' });
    while (isSquare(p * p + q * q)) q++;
    const n = p * p + q * q;
    const s = Math.sqrt(n);
    const [ab, bc] = [Math.sqrt((p * (s + q)) / 2), Math.sqrt((p * (s - q)) / 2)];
    const L = Lines.fit(g, ab + bc, 7);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 0);
    sumSquare(L, ab, bc, v(0, -0.4));
    g.show('AB, BC', `√(${p === 1 ? '' : p}(√${n} + ${q})/2), √(${p === 1 ? '' : p}(√${n} − ${q})/2)`);
    g.equal('AB² + BC² = p√n (medial)', ab * ab + bc * bc, p * s);
    g.equal('AB·BC = ½p² (rational)', ab * bc, (p * p) / 2);
    g.equal('AC² = p² + p√n', (ab + bc) ** 2, p * p + p * s);
    g.claim('n is not a square: AC² irrational', !isSquare(n));
  },
});
