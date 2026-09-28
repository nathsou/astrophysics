import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare, semicircleSplit } from './lib';

// Against ρ = 1, with s = √(p² + 1) irrational and b not a square: AB = √(s·√b) and
// BC = p·√b/AB are medial, commensurable in square only, contain the medial rectangle p·√b, and
// √(AB² − BC²) is incommensurable with AB (X.32, end). The construction is that of X.34. Then
// AD² + DB² = AB² and AD·DB = ½·AB·BC are both medial, and incommensurable with each other.
export default figure({
  caption: 'AD and DB: the sum of their squares and their rectangle are both medial, and AB² : AD·DB = 2s : p is not a ratio of numbers. Together they make the line of X.41.',
  build(g) {
    const p = g.param('p', 2, { min: 1, max: 3, label: 'p' });
    const q = 1;
    let b = nonSquare(g.param('b', 3, { min: 2, max: 7, label: 'b' }));
    const n = p * p + q * q;
    while (isSquare(b) || isSquare(n * b)) b++; // AB, BC medial
    const s = Math.sqrt(n);
    const ab = Math.sqrt(s * Math.sqrt(b));
    const bc = (p * Math.sqrt(b)) / ab;
    const L = Lines.fit(g, ab, 8);
    const r = semicircleSplit(L, ab, bc, ['A', 'B', 'C', 'E', 'F', 'D']);
    g.equal('AB·BC = p√b (medial)', ab * bc, p * Math.sqrt(b));
    g.equal('AD·DB = AB·FD = ½·AB·BC', r.at * r.tb, (ab * bc) / 2);
    g.equal('AD² + DB² = AB²', r.at ** 2 + r.tb ** 2, ab * ab);
    g.equal('AB² : AD·DB = 2s : p', (ab * ab) / (r.at * r.tb), (2 * s) / p);
    g.claim('b, p² + 1 and b(p² + 1) are not squares', !isSquare(b) && !isSquare(n) && !isSquare(n * b));
  },
});
