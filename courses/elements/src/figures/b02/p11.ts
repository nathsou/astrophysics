import { figure } from '../../geometry/figure';
import { add, area, dist, lc, ll, mid, sub } from '../../geometry/vec';
import { frame } from './lib';

// The golden section: AB·BH = AH². The circle with centre E through B (EF = EB) finds F on CA
// produced; the square on AF then cuts AB at H.
export default figure({
  build(g) {
    const A = g.free('A', -1.6, 1.2);
    const B = g.free('B', 1.6, 1.2);
    const s = dist(A, B);
    const f = frame(A, B);
    const { D, C } = g.points({ D: f(s, s), C: f(0, s) });
    const E = g.point('E', mid(A, C));
    const k = { c: E, r: dist(E, B) };
    const F = g.point('F', lc(C, A, k)[1]);
    g.arc(E, B, F, { aux: true, dashed: true });
    const H = g.point('H', lc(A, B, { c: A, r: dist(A, F) })[1]);
    const G = g.point('G', add(F, sub(H, A)));
    const K = g.point('K', ll(G, H, C, D));
    g.polygon([A, B, D, C], { name: 'AD' });
    g.segment(B, E);
    g.segment(C, F);
    g.segment(G, K);
    const FH = g.polygon([F, G, H, A], { name: 'FH', fill: true });
    g.polygon([F, G, K, C], { name: 'FK', aux: true });
    g.polygon([A, H, K, C], { name: 'AK', aux: true });
    const HD = g.polygon([H, B, D, K], { name: 'HD', fill: true });
    const ah = dist(A, H);
    g.equal('AB·BH = AH²', s * dist(B, H), ah * ah);
    g.equal('EF = EB', dist(E, F), dist(E, B));
    g.equal('FH = HD', area(FH), area(HD));
    g.show('AH : AB', (ah / s).toFixed(6));
  },
});
