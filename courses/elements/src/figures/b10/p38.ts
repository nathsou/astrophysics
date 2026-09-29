import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare, root4 } from './lib';

// Against ρ = 1: AB = ⁴√k and BC = √λ/⁴√k are medial, commensurable in square only (AB² : BC² = k : λ)
// and contain the medial rectangle √λ. Their sum is the second bimedial. Euclid applies AC² to
// the rational line DE: EH = AB² + BC² (breadth DH) and HF = 2·AB·BC (breadth HG). DH and HG are
// rational and commensurable in square only, so DG is a binomial and DF = AC² is irrational.
export default figure({
  caption: 'AC = ⁴√k + √λ/⁴√k. Below, AC² applied to DE = ρ: the breadth DG = DH + HG = (k + λ)/√k + 2√λ is a binomial, so AC² is not rational.',
  build(g) {
    const k = nonSquare(g.param('k', 2, { min: 2, max: 7, label: 'AB = ⁴√k: k' }));
    let l = nonSquare(g.param('l', 3, { min: 2, max: 7, label: 'BC = √λ/⁴√k: λ' }));
    while (isSquare(k * l) || isSquare(l)) l++;
    const r = Math.pow(k, 0.25);
    const [ab, bc] = [r, Math.sqrt(l) / r];
    const de = 1;
    const dh = (ab * ab + bc * bc) / de;
    const hg = (2 * ab * bc) / de;
    const L = Lines.fit(g, 12, 9);
    L.row(['A', 'B', 'C'], [ab, bc], 0, 2.2);
    L.rect(['D', 'H', '~1', 'E'], 0, 0, dh, de, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['H', 'G', 'F', '~1'], dh, 0, hg, de, {}, [270, 315, 45, 90]);
    g.polygon([L.pt('D', { x: 0, y: 0 }), L.pt('G', { x: 0, y: 0 }), L.pt('F', { x: 0, y: 0 }), L.pt('E', { x: 0, y: 0 })], { aux: true });
    g.show('AB, BC', `${root4(k)}, ${root4(l * l, k)}`);
    g.equal('DF = AC²', (dh + hg) * de, (ab + bc) ** 2);
    g.equal('DH = AB² + BC² = (k + λ)/√k', dh, (k + l) / Math.sqrt(k));
    g.equal('HG = 2·AB·BC = 2√λ', hg, 2 * Math.sqrt(l));
    g.claim('kλ is not a square: DH, HG commensurable in square only', !isSquare(k * l));
  },
});
