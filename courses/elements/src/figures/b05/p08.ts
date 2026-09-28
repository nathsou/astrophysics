import { figure } from '../../geometry/figure';
import { cmp, rods } from './lib';

// Case I of Heath: AB > C with BE = C and AE < EB. FG is the least multiple k·AE exceeding D;
// GH = k·EB and K = k·C. N is the first multiple of D exceeding K, M the one before it, L = 2·D.
export default figure({
  build(g) {
    const c = g.param('c', 1.5, { min: 1, max: 2, label: 'C (= EB)' });
    const t = g.param('t', 0.45, { min: 0.3, max: 0.9, label: 'AE ÷ EB' });
    const d = g.param('d', 1.1, { min: 0.8, max: 2, label: 'D' });
    const ae = t * c;
    const ab = ae + c;
    const k = Math.floor(d / ae) + 1;
    const K = k * c;
    const j = Math.floor(K / d) + 1; // N = j·D is the first multiple of D greater than K
    rods(g, [
      [{ pts: ['A', 'E', 'B'], parts: [ae, c] }],
      [{ name: 'C', parts: [c] }],
      [{ name: 'D', parts: [d] }],
      [{ pts: ['F', 'G', 'H'], parts: [k * ae, k * c], unit: ae }],
      [{ name: 'K', parts: [K], unit: c }],
      [{ name: 'L', parts: [2 * d], unit: d }],
      [{ name: 'M', parts: [(j - 1) * d], unit: d }],
      [{ name: 'N', parts: [j * d], unit: d }],
    ], { dy: 0.8 });
    g.show('FH, K = k·AB, k·C with k', k);
    g.show('N = j·D with j', j);
    g.claim('FG > D', cmp(k * ae, d) > 0);
    g.claim('K ≥ M (K is not less than M)', cmp(K, (j - 1) * d) >= 0);
    g.claim('FH > N', cmp(k * ab, j * d) > 0);
    g.claim('K < N', cmp(K, j * d) < 0);
    g.claim('AB : D > C : D', ab / d > c / d);
  },
});
