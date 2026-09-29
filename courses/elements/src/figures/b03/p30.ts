import { figure } from '../../geometry/figure';
import { add, dist, lc, mid, perp, sub, v } from '../../geometry/vec';
import { arcLen, need, onArc } from './lib';

// To bisect a given arc ADB: bisect the chord AB at C and erect the perpendicular CD. Only the
// given arc is drawn; A and B glide along its circle.
export default figure({
  build(g) {
    const O = v(0, 0);
    const k = { c: O, r: 2.2 };
    const rad = Math.PI / 180;
    const A = g.glider('A', k, 160 * rad);
    const B = g.glider('B', k, 25 * rad);
    need(dist(A, B) > 0.3, 'A and B apart');
    g.arc(O, B, A, { name: 'ADB' });
    const C = g.point('C', mid(A, B));
    const [p, q] = lc(C, add(C, perp(sub(B, A))), k);
    const D = g.point('D', onArc(O, B, A, p) ? p : q);
    g.segment(A, B);
    g.segment(C, D);
    g.path(A, D, B, { aux: true });
    g.angle(A, C, D, { right: true });
    g.equal('AD = DB', dist(A, D), dist(D, B));
    g.equal('arc AD = arc DB', arcLen(k, D, A), arcLen(k, B, D));
  },
});
