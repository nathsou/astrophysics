import { figure } from '../../geometry/figure';
import { gcd, isSquare, Lines } from './lib';

// A² : B² = p : q. When p : q (in lowest terms) is a ratio of square numbers c² : d², then
// A : B = c : d and C, D are those numbers; otherwise no numbers C, D exist and they are dashed,
// drawn at the lengths √p, √q they would need to have.
export default figure({
  caption: 'Choose the ratio of the squares, p : q. The sides are commensurable exactly when p : q in lowest terms is a ratio of two square numbers. Try 9 : 4, then 2 : 1.',
  build(g) {
    const p0 = g.param('p', 9, { min: 1, max: 16, label: 'p (A² : B² = p : q)' });
    const q0 = g.param('q', 4, { min: 1, max: 16, label: 'q' });
    const k = gcd(p0, q0);
    const p = p0 / k;
    const q = q0 / k;
    const w = 1;
    const a = Math.sqrt(p) * w;
    const b = Math.sqrt(q) * w;
    const L = Lines.fit(g, a + b + 1.5, 9);
    const [a0, a1] = L.mag('A', a, 0, 0);
    const [b0, b1] = L.mag('B', b, L.x(a + 1.5), 0);
    const up = (s: typeof a0, e: typeof a1) => [s, e, { x: e.x, y: e.y + (e.x - s.x) }, { x: s.x, y: s.y + (e.x - s.x) }];
    g.polygon(up(a0, a1), { fill: true, aux: true });
    g.polygon(up(b0, b1), { fill: true, aux: true });
    const sq = isSquare(p) && isSquare(q);
    const N = new Lines(g, Math.min(L.u, 9 / (Math.sqrt(16) * 2 + 1.5)));
    N.mag('C', Math.sqrt(p), 0, -1.6, sq ? { ticks: 1 } : { dashed: true });
    N.mag('D', Math.sqrt(q), 0, -2.6, sq ? { ticks: 1 } : { dashed: true });
    g.equal('A² : B² = p : q', (a * a) / (b * b), p / q);
    // commensurability tested numerically: some multiple k·(A : B) with k ≤ 200 is a whole number
    let comm = false;
    for (let m = 1; m <= 200 && !comm; m++) comm = Math.abs((m * a) / b - Math.round((m * a) / b)) < 1e-9;
    g.show('p : q in lowest terms', `${p} : ${q}`);
    g.show('A, B', comm ? 'commensurable in length' : 'incommensurable in length');
    g.claim('A, B commensurable in length ⇔ p : q is a ratio of square numbers', comm === sq);
    if (sq) g.equal('A : B = C : D', a / b, Math.sqrt(p) / Math.sqrt(q));
  },
});
