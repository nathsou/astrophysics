import { figure } from '../../geometry/figure';
import { add, along, dist, mul, sub, unit, v } from '../../geometry/vec';
import { need, onC } from './lib';

// If two circles touch internally, the line of centres passes through the point of contact.
// ABC is the outer circle (centre F); ADE is drawn with centre G through A. Drag G: unless G lies
// on FA, the circle ADE is not inside ABC (D falls beyond H), so it cuts rather than touches.
export default figure({
  build(g) {
    const R = 2.2;
    const F = g.point('F', v(0, 0));
    const k1 = g.circle(F, R);
    const A = g.point('A', onC(k1, Math.PI));
    g.point('B', onC(k1, (60 * Math.PI) / 180));
    g.point('C', onC(k1, (-50 * Math.PI) / 180));
    const G = g.free('G', -0.75, 0.8);
    need(dist(G, F) > 0.15, 'G not at F');
    const ra = dist(G, A);
    need(ra < 1.9 * R, 'the circle ADE not too large');
    const k2 = g.circle(G, ra, { dashed: true });
    const u = unit(sub(G, F));
    const D = g.point('D', add(G, mul(u, ra)));
    const H = g.point('H', along(F, G, R));
    g.point('E', onC(k2, Math.atan2(-u.y, -u.x) + 0.9));
    g.segment(F, H);
    g.segment(A, F);
    g.segment(A, G);
    void D;
    g.claim('AG > GH (so GD > GH: D lies outside ABC)', ra > dist(G, H));
  },
});
