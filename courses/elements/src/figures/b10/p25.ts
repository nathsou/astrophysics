import { figure } from '../../geometry/figure';
import { gcd, isSquare, Lines, nonSquare, surd } from './lib';

// Against ρ = 1: AB² = s·√k and BC² = t·√k, so AB, BC are medial and commensurable in square only
// (s : t not a ratio of squares). The squares AD, BE (= CO) and the rectangle AC are applied in a
// row to the rational line FG: GH, MK, NL with breadths FH, HK, KL. Then FH·KL = HK², and HK is
// rational, so AC is rational (if HK is commensurable with FG in length) or medial.
export default figure({
  caption: 'The three areas AD, AC, BE applied to FG. Their breadths are in continued proportion, FH : HK = HK : KL, and HK² = FH·KL is rational. Try k = 2, s = 1, t = 2 for a rational AC.',
  build(g) {
    const k = nonSquare(g.param('k', 3, { min: 2, max: 5, label: 'k' }));
    const s = g.param('s', 1, { min: 1, max: 3, label: 'AB² = s√k: s' });
    let t = g.param('t', 3, { min: 1, max: 3, label: 'BC² = t√k: t' });
    if (isSquare((s * t) / gcd(s, t) ** 2)) t = t === 3 ? 2 : t + 1; // commensurable in square only
    const rk = Math.sqrt(k);
    const ab = Math.sqrt(s * rk);
    const bc = Math.sqrt(t * rk);
    const fg = 1.5;
    const [fh, hk, kl] = [(ab * ab) / fg, (ab * bc) / fg, (bc * bc) / fg];
    const L = Lines.fit(g, 17, 10);
    L.rect(['D', 'B', 'A', '~1'], -ab, 0, ab, ab, { fill: true, aux: true }, [225, 300, 90, 135]);
    L.rect(['B', 'C', '~2', 'A'], 0, 0, bc, ab, {}, [300, 0, 45, 90]);
    L.rect(['O', 'E', 'C', 'B'], 0, -bc, bc, bc, { fill: true, aux: true }, [225, 315, 0, 300]);
    const x0 = -ab;
    const y0 = -bc - fg - 1.2;
    L.rect(['F', 'H', 'M', 'G'], x0, y0, fh, fg, { fill: true, aux: true }, [270, 270, 90, 90]);
    L.rect(['H', 'K', 'N', 'M'], x0 + fh, y0, hk, fg, {}, [270, 270, 90, 90]);
    L.rect(['K', 'L', '~3', 'N'], x0 + fh + hk, y0, kl, fg, { fill: true, aux: true }, [270, 270, 90, 90]);
    const rational = isSquare(s * t * k);
    g.show('FH, HK, KL (FG = 3/2)', `${surd(4 * s * s * k, 9)}, ${surd(4 * s * t * k, 9)}, ${surd(4 * t * t * k, 9)}`);
    g.show('AC', rational ? 'rational (HK commensurable in length with FG)' : 'medial (HK commensurable with FG in square only)');
    g.equal('GH = AD, MK = AC, NL = BE', fg * (fh + hk + kl), ab * ab + ab * bc + bc * bc);
    g.equal('FH : KL = s : t', fh / kl, s / t);
    g.equal('FH·KL = HK²', fh * kl, hk * hk);
    g.equal('HK² = 4stk/9, a rational number', hk * hk, (4 * s * t * k) / 9);
  },
});
