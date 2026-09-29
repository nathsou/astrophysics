import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { gcd, isSquare, Lines, root4, surd } from './lib';

// Against ρ = 1: AB = √p and BC = √q are rational and commensurable in square only (p : q is not
// a ratio of squares). The rectangle AC = √(pq)·ρ² is irrational, and the side of the square equal
// to it, ⁴√(pq), is the first new irrational: the medial line.
//
// The lemma uses the square on FE and the rectangle DE·EG. It is drawn on the same square: F and E
// are A and B (hidden labels), and G lies below B with EG = BC.
export default figure({
  caption: 'AB = √p, BC = √q (ρ = 1). Their rectangle AC has area √(pq), not a rational multiple of ρ², and the medial line is the side of the equal square. The lower rectangle is the lemma’s DG.',
  build(g) {
    let p = g.param('p', 3, { min: 1, max: 7, label: 'AB = √p: p' });
    const q = g.param('q', 2, { min: 1, max: 7, label: 'BC = √q: q' });
    while (isSquare((p * q) / gcd(p, q) ** 2)) p++; // commensurable in square only
    const ab = Math.sqrt(p);
    const bc = Math.sqrt(q);
    const L = Lines.fit(g, 2 * Math.sqrt(8), 8);
    L.rect(['D', 'B', 'A', '~1'], 0, 0, ab, ab, { fill: true, aux: true }, [180, 300, 90, 135]);
    L.rect(['B', 'C', '~2', 'A'], ab, 0, bc, ab, {}, [300, 315, 45, 90]);
    // the lemma: F = A, E = B, G below B with EG = BC
    const F = L.pt('F', v(L.x(ab), L.x(ab)), { hidden: true });
    const E = L.pt('E', v(L.x(ab), 0), { hidden: true });
    g.polygon([L.pt('D', v(0, 0)), E, F, L.pt('~1', v(0, L.x(ab)))], { aux: true }); // the square DF
    L.rect(['~3', 'G', 'E', 'D'], 0, -bc, ab, bc, { dashed: true, aux: true }, [225, 315, 45, 135]);
    const med = Math.sqrt(ab * bc);
    L.bare(med, L.x(ab + bc) + 0.6, L.x(ab) / 2, 'medial');
    L.bare(1, L.x(ab + bc) + 0.6, -0.6, 'ρ');
    g.show('AB, BC', `√${p}, √${q}`);
    g.show('area AC, medial side', `${surd(p * q)}·ρ², ${root4(p * q)}`);
    g.claim('p·q is not a square, so AC is not a rational multiple of ρ²', !isSquare(p * q));
    g.equal('(medial side)² = AC', med * med, ab * bc);
    g.equal('lemma: FE : EG = FE² : FE·EG', ab / bc, (ab * ab) / (ab * bc));
  },
});
