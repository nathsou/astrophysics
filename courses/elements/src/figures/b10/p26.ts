import { figure } from '../../geometry/figure';
import { isSquare, Lines, nonSquare } from './lib';

// Reductio. The medial areas AB = √p·ρ² and AC = √q·ρ² (p, q not squares) and their difference DB,
// applied to the rational line EF = ρ: FH, FG and the remainder KH, with breadths EH, EG, GH. The
// supposition "DB is rational" fails: GH = √p − √q is never a rational number, so KH is never a
// rational area.
export default figure({
  caption: 'AB and AC are medial areas, √p and √q times ρ². Whatever p and q, the excess DB = √p − √q (times ρ²) is not rational, as the proposition says.',
  build(g) {
    const p = nonSquare(g.param('p', 8, { min: 5, max: 15, label: 'AB = √p·ρ²: p' }));
    let q = nonSquare(g.param('q', 2, { min: 2, max: 4, label: 'AC = √q·ρ²: q' }));
    if (q >= p) q = 2;
    const h = 1.3;
    const [w, w1] = [Math.sqrt(p) / h, Math.sqrt(q) / h];
    const L = Lines.fit(g, Math.sqrt(15) / h + 1 + Math.sqrt(15), 10);
    L.rect(['~1', 'C', 'D', 'A'], 0, 0, w1, h, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['C', 'B', '~2', 'D'], w1, 0, w - w1, h, {}, [270, 315, 45, 90]);
    const x = w + 1;
    const [eh, eg] = [Math.sqrt(p), Math.sqrt(q)];
    L.rect(['E', 'G', 'K', 'F'], x, 0, eg, 1, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['G', 'H', '~4', 'K'], x + eg, 0, eh - eg, 1, {}, [270, 315, 45, 90]);
    g.polygon([L.pt('E', { x: 0, y: 0 }), L.pt('H', { x: 0, y: 0 }), L.pt('~4', { x: 0, y: 0 }), L.pt('F', { x: 0, y: 0 })], { aux: true }); // FH
    g.polygon([L.pt('~1', { x: 0, y: 0 }), L.pt('B', { x: 0, y: 0 }), L.pt('~2', { x: 0, y: 0 }), L.pt('A', { x: 0, y: 0 })], { aux: true }); // AB
    const gh = eh - eg;
    // DB = (√p − √q)ρ² is rational only if √p − √q is: when pq is a square c²q², it is (c − 1)√q
    const c = Math.sqrt((p * q) / (q * q));
    const dbRational = isSquare(p * q) ? isSquare(q) : false;
    g.show('GH = √p − √q', `${gh.toFixed(4)}${isSquare(p * q) ? ` = ${c - 1}√${q}` : ''}`);
    g.equal('FH = AB, FG = AC', eh + eg, h * w + h * w1);
    g.equal('KH = DB', gh * 1, h * (w - w1));
    g.claim('DB is not a rational area', !dbRational);
  },
});
