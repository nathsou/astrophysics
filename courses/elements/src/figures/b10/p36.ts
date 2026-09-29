import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { binomialOrder, gcd, isSquare, Lines, sumSquare } from './lib';

// Against ρ = 1: AB = √a and BC = √b are rational and commensurable in square only. Their sum
// AC = √a + √b is the binomial. Below, II.4: AC² = AB² + BC² + 2·AB·BC, where AB² + BC² = a + b is
// rational and 2·AB·BC = 2√(ab) is medial, so AC² is irrational.
export default figure({
  caption: 'AC = √a + √b. Its square is the rational a + b plus the medial 2√(ab): the two parts are incommensurable, so AC² is not rational, and AC is irrational. The readout gives the order of the binomial (X. Deff. II).',
  build(g) {
    let a = g.param('a', 3, { min: 1, max: 12, label: 'AB = √a: a' });
    const b = g.param('b', 2, { min: 1, max: 12, label: 'BC = √b: b' });
    while (isSquare((a * b) / gcd(a, b) ** 2)) a++;
    const [ab, bc] = [Math.sqrt(a), Math.sqrt(b)];
    const L = Lines.fit(g, 2 * Math.sqrt(13), 7);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 0);
    sumSquare(L, ab, bc, v(0, -0.4));
    const [big, small] = a > b ? [a, b] : [b, a];
    g.show('AC', `√${a} + √${b}`);
    g.show('order (X. Deff. II)', `${['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][binomialOrder([big, 1], [small, 1]) - 1]} binomial`);
    g.equal('AC² = AB² + BC² + 2·AB·BC', (ab + bc) ** 2, a + b + 2 * ab * bc);
    g.claim('a·b is not a square: 2·AB·BC = 2√(ab) is not rational', !isSquare(a * b));
  },
});
