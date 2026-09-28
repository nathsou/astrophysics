import { figure } from '../../geometry/figure';
import { gcd, isSquare, Lines, root4, surd } from './lib';

// Against ρ = 1. A is medial: A² = EF·EG with EF = √p, EG = √q rational and commensurable in
// square only (the rectangle GF). The same area applied to the rational line BC = √c (the
// rectangle BD) has breadth CD = √(pq)/√c: rational, but incommensurable in length with BC.
export default figure({
  caption: 'The square on the medial line A, applied to the rational line BC, has a breadth CD that is rational (CD² is a rational multiple of ρ²) but incommensurable in length with BC.',
  build(g) {
    let p = g.param('p', 3, { min: 1, max: 6, label: 'EF = √p: p' });
    const q = g.param('q', 2, { min: 1, max: 6, label: 'EG = √q: q' });
    const c = g.param('c', 2, { min: 1, max: 6, label: 'BC = √c: c' });
    while (isSquare((p * q) / gcd(p, q) ** 2)) p++;
    const [ef, eg, bc] = [Math.sqrt(p), Math.sqrt(q), Math.sqrt(c)];
    const a2 = ef * eg; // A² = √(pq)
    const cd = a2 / bc;
    const L = Lines.fit(g, 2 * Math.sqrt(42) + 1.5, 10);
    L.rect(['C', 'D', '~1', 'B'], 0, 0, cd, bc, { fill: true, aux: true }, [225, 315, 45, 135]);
    const x = cd + 1;
    L.rect(['E', 'F', '~2', 'G'], x, 0, ef, eg, { fill: true, aux: true }, [225, 315, 45, 135]);
    L.mag('A', Math.sqrt(a2), L.x(x), -1);
    L.bare(1, 0, -1, 'ρ');
    g.show('A, CD', `${root4(p * q)}, ${surd(p * q, c)}`);
    g.equal('BD = A² = GF', cd * bc, ef * eg);
    g.equal('BC : EG = EF : CD', bc / eg, ef / cd);
    g.equal('CD² = pq/c (rational)', cd * cd, (p * q) / c);
    g.claim('CD² : BC² = pq : c² is not a ratio of squares', !isSquare((p * q) / gcd(p * q, c * c)) || !isSquare((c * c) / gcd(p * q, c * c)));
  },
});
