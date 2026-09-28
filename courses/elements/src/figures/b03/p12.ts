import { figure } from '../../geometry/figure';
import { along, dist, v } from '../../geometry/vec';
import { need, onC } from './lib';

// If two circles touch externally, the line of centres passes through the point of contact.
// ABC has centre F; ADE is drawn with centre G through A. Drag G: unless G is on FA produced,
// FG < FA + AG, so the two circles overlap (C and D cross over) and do not merely touch.
export default figure({
  build(g) {
    const r1 = 1.6;
    const F = g.point('F', v(0, 0));
    const k1 = g.circle(F, r1, { name: 'ABC' });
    const A = g.point('A', onC(k1, 0));
    g.point('B', onC(k1, (130 * Math.PI) / 180));
    const G = g.free('G', 2.6, 1.0);
    const r2 = dist(G, A);
    need(dist(F, G) > r1 + 0.1 && dist(F, G) > r2 + 0.1, 'G well away from F');
    const k2 = g.circle(G, r2, { dashed: true, name: 'ADE' });
    g.point('E', onC(k2, (-40 * Math.PI) / 180));
    const C = g.point('C', along(F, G, r1));
    const D = g.point('D', along(G, F, r2));
    g.segment(F, G);
    g.segment(A, F);
    g.segment(A, G);
    void C;
    void D;
    g.claim('FG < FA + AG (I.20)', dist(F, G) < r1 + r2);
    g.show('FA + AG', (r1 + r2).toFixed(3));
    g.show('FG', dist(F, G).toFixed(3));
  },
});
