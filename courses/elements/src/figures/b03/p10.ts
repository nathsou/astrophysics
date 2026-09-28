import { figure } from '../../geometry/figure';
import { add, dist, v, type V } from '../../geometry/vec';

// A circle cannot cut a circle in more than two points. The dashed oval DEF is the impossible
// "circle" that meets ABC at four points B, G, F, H (Heath's text lists C among them, but C is the
// end of the diameter through K). The perpendicular bisectors AC of BH and NO of BG meet at the
// centre P of ABC; the same argument would make P the centre of DEF as well.
export default figure({
  build(g) {
    const r = 2;
    const a = g.param('a', 2.7, { min: 2.2, max: 3.4, label: 'width of the oval' });
    const b = 1.45;
    const tilt = 0.35;
    const P = g.point('P', v(0, 0));
    g.circle(P, r);
    const R = (p: V): V => v(p.x * Math.cos(tilt) - p.y * Math.sin(tilt), p.x * Math.sin(tilt) + p.y * Math.cos(tilt));
    const at = (t: number) => R(v(a * Math.cos(t), b * Math.sin(t)));
    // the oval meets the circle where x² = (1 − r²/b²) / (1/a² − 1/b²)
    const x0 = Math.sqrt((1 - (r * r) / (b * b)) / (1 / (a * a) - 1 / (b * b)));
    const y0 = Math.sqrt(r * r - x0 * x0);
    const tB = Math.atan2(y0 / b, x0 / a);
    const special = [tB, Math.PI - tB, Math.PI + tB, 2 * Math.PI - tB, 0, Math.PI, 4.95];
    const ts = [...Array.from({ length: 120 }, (_, i) => (2 * Math.PI * i) / 120), ...special].sort((p, q) => p - q);
    g.curve(ts.map(at), { closed: true, dashed: true });
    const B = g.point('B', at(tB));
    const H = g.point('H', at(Math.PI - tB));
    g.point('F', at(Math.PI + tB));
    const G = g.point('G', at(2 * Math.PI - tB));
    g.point('D', at(4.95));
    const E = g.point('E', at(0));
    const M = g.point('M', at(Math.PI));
    const K = g.point('K', R(v(0, y0)));
    const L = g.point('L', R(v(x0, 0)));
    const C = g.point('C', R(v(0, r)));
    const A = g.point('A', R(v(0, -r)));
    const O = g.point('O', R(v(r, 0)));
    const N = g.point('N', R(v(-r, 0)));
    g.segment(B, H);
    g.segment(B, G);
    g.segment(A, C);
    g.segment(M, E, { aux: true });
    g.angle(B, K, C, { right: true });
    g.angle(B, L, O, { right: true });
    void N;
    g.equal('PB = PH = PG (on ABC)', dist(P, B), dist(P, G));
    g.claim('PE ≠ PB: DEF is not a circle about P', Math.abs(dist(P, E) - dist(P, B)) > 1e-6);
    g.show('PE', dist(P, E).toFixed(3));
    g.show('PB', dist(P, B).toFixed(3));
    void add;
    void L;
  },
});
