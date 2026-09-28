import { figure } from '../../geometry/figure';
import { circumcircle, dist, lerp, mid, v } from '../../geometry/vec';
import { onC } from './lib';

// A circle cannot touch a circle at two points. Inside: the dashed oval EBFD "touches" ABDC at B
// and D; if it were a circle its centre H would lie on BD (III.11), and BH = HD would fail.
// Outside: a circle ACK through two points A, C of ABDC contains the chord AC, and so does ABDC
// (III.2): the two overlap, and ACK cuts ABDC instead of touching it.
export default figure({
  build(g) {
    const r = 2;
    const G = g.point('G', v(0, 0));
    const k = g.circle(G, r);
    const B = g.point('B', v(-r, 0));
    const D = g.point('D', v(r, 0));
    const b = 1.15;
    const at = (t: number) => v(r * Math.cos(t), b * Math.sin(t));
    const ts = [...Array.from({ length: 120 }, (_, i) => (2 * Math.PI * i) / 120)].sort((p, q) => p - q);
    g.curve(ts.map(at), { closed: true, dashed: true, name: 'EBFD' });
    g.point('E', at(Math.PI / 2));
    g.point('F', at((3 * Math.PI) / 2));
    const H = g.glider('H', [lerp(G, D, 0.1), lerp(G, D, 0.8)], 0.4);
    g.segment(B, D);
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 125 * rad);
    const C = g.glider('C', k, 60 * rad);
    // the circle ACK: its centre beyond AC, away from G
    const m = mid(A, C);
    const K0 = v(m.x * 2.2, m.y * 2.2);
    const kk = circumcircle(A, C, K0);
    g.circle(kk.c, kk.r, { dashed: true, name: 'ACK' });
    g.point('K', onC(kk, Math.atan2(kk.c.y, kk.c.x)));
    g.segment(A, C);
    g.claim('BH > HD: H is not the centre of EBFD', dist(B, H) > dist(H, D));
    g.claim('the midpoint of AC lies inside both circles', dist(m, G) < r && dist(m, kk.c) < kk.r);
  },
});
