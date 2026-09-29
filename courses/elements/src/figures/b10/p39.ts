import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { isSquare, Lines, sumSquare } from './lib';

// Against ρ = 1, with n = p² + q² not a square (the lines AF, FB of X.33): AB = √((n + q√n)/2) and
// BC = √((n − q√n)/2). AB² + BC² = n is rational, AB·BC = ½p√n is medial. Their sum is the major.
export default figure({
  caption: 'AC = √((n + q√n)/2) + √((n − q√n)/2), n = p² + q². The squares add up to the rational n; twice the rectangle is the medial p√n.',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 4, label: 'p' });
    let q = g.param('q', 1, { min: 1, max: 4, label: 'q' });
    while (isSquare(p * p + q * q)) q++;
    const n = p * p + q * q;
    const s = Math.sqrt(n);
    const [ab, bc] = [Math.sqrt((n + q * s) / 2), Math.sqrt((n - q * s) / 2)];
    const L = Lines.fit(g, ab + bc, 7);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 0);
    sumSquare(L, ab, bc, v(0, -0.4));
    g.show('AB, BC', `√((${n} + ${q === 1 ? '' : q}√${n})/2), √((${n} − ${q === 1 ? '' : q}√${n})/2)`);
    g.equal('AB² + BC² = n (rational)', ab * ab + bc * bc, n);
    g.equal('AB·BC = ½p√n (medial)', ab * bc, (p * s) / 2);
    g.equal('AC² = n + p√n', (ab + bc) ** 2, n + p * s);
    g.claim('n is not a square: AC² irrational', !isSquare(n));
  },
});
