import { figure } from '../../geometry/figure';
import { isSquare, Lines } from './lib';

// Main part (top), against ρ = 1: A = √2, B = √3, C = √5 are rational and commensurable in square
// only; D is the mean proportional between A and B (D² = A·B) and B : C = D : E. Then D, E are
// medial, commensurable in square only, and D·E = A·C is medial. The magnitudes carry their
// letters as text, because the lemmas use the letters as points.
//
// Lemmas (bottom), a number line from B: BA = m·p², BC = m·q² (similar plane numbers of the same
// parity), D bisects CA, DE is the unit, GA = 2·DE, DF = 2, HA = 2·DF. Lemma 1: AB·BC + CD² = BD²
// with AB·BC square. Lemma 2: AB·BC + CE² is not a square.
export default figure({
  caption: 'Top: the medial lines D, E of the proposition. Bottom: the lemmas on a number line, with AB = m·p² and BC = m·q². AB·BC + CD² = BD², a sum of two squares that is a square; AB·BC + CE² is not a square.',
  build(g) {
    let m = g.param('m', 2, { min: 2, max: 3, label: 'm' });
    const p = g.param('p', 3, { min: 3, max: 4, label: 'AB = m·p²: p' });
    const q = g.param('q', 1, { min: 1, max: 2, label: 'BC = m·q²: q' });
    if ((m * p * p) % 2 !== (m * q * q) % 2) m = 2;
    const [ab, bc] = [m * p * p, m * q * q];
    // main part
    const [A, B, C] = [Math.SQRT2, Math.sqrt(3), Math.sqrt(5)];
    const D = Math.sqrt(A * B);
    const E = (D * C) / B;
    const M = Lines.fit(g, 3, 3.2);
    M.mag('A', A, 0, 6.2, { label: 'text' });
    M.mag('B', B, 0, 5.5, { label: 'text' });
    M.mag('C', C, 0, 4.8, { label: 'text' });
    M.mag('D', D, 4.5, 6.2, { label: 'text' });
    M.mag('E', E, 4.5, 5.5, { label: 'text' });
    // lemmas
    const cd = (ab - bc) / 2;
    const bd = bc + cd;
    const pos: Record<string, number> = { B: 0, C: bc, F: bd - 2, E: bd - 1, D: bd, H: ab - 4, G: ab - 2, A: ab };
    const order = Object.keys(pos).sort((x, y) => pos[x] - pos[y]);
    const N = Lines.fit(g, ab, 10);
    const below = new Set(['F', 'D', 'G']);
    const dirs = Object.fromEntries(order.map((n) => [n, below.has(n) ? 270 : 90]));
    N.row(order, order.slice(1).map((n, i) => pos[n] - pos[order[i]]), 0, 2, { dirs, style: { ticks: N.u } });
    const ce = cd - 1;
    g.equal('M.: D² = A·B', D * D, A * B);
    g.equal('M.: D·E = A·C', D * E, A * C);
    g.equal('M.: D : E = B : C', D / E, B / C);
    g.equal('L. 1: AB·BC + CD² = BD²', ab * bc + cd * cd, bd * bd);
    g.claim('L. 1: AB·BC is a square', isSquare(ab * bc));
    g.claim('L. 2: AB·BC + CE² is not a square', !isSquare(ab * bc + ce * ce));
    g.show('AB, BC, AB·BC', `${ab}, ${bc}, ${ab * bc}`);
  },
});
