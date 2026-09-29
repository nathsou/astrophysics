import { figure } from '../../geometry/figure';
import { cfSqrt, Lines, nonSquare } from './lib';

// A : B = √n is not the ratio of a number to a number (n not a square), so A, B are
// incommensurable: no length measures both. The dashed rod is a would-be common measure B/k,
// which measures B but never A.
export default figure({
  caption: 'A : B = √n. The dashed rod is B divided into k equal parts; it measures B, but A is never a whole number of them, whatever k is.',
  build(g) {
    const n = nonSquare(g.param('n', 3, { min: 2, max: 12, label: 'n (A : B = √n)' }));
    const k = g.param('k', 4, { min: 1, max: 12, label: 'k' });
    const b = 2;
    const a = b * Math.sqrt(n);
    const L = Lines.fit(g, a, 8);
    L.mag('A', a, 0, 2, { ticks: b / k });
    L.mag('B', b, 0, 1, { ticks: b / k });
    L.bare(b / k, 0, 0, 'B ÷ k', { dashed: true });
    const times = (a * k) / b;
    g.show('A ÷ (B ÷ k)', times.toFixed(4));
    g.show('continued fraction of A : B', `[${cfSqrt(n, 7).join(', ')}, …]`);
    g.claim('(k·√n)² = k²·n is not a square, so B ÷ k does not measure A', !Number.isInteger(Math.sqrt(k * k * n)));
  },
});
