import { figure } from '../../geometry/figure';
import { Degenerate, add, cc, dist, mul, sub, unit, v } from '../../geometry/vec';

// I.22: the three given lines A, B, C are the sliders (drawn at the top). DF = A, FG = B, GH = C
// are laid off along DE; the circles about F through D and about G through H meet at K (and L).
// When two of the lines together are not greater than the third, the circles do not meet and the
// slider is refused.
export default figure({
  build(g) {
    const a = g.param('a', 1.5, { min: 0.4, max: 3, label: 'A' });
    const b = g.param('b', 2.1, { min: 0.4, max: 3, label: 'B' });
    const c = g.param('c', 1.8, { min: 0.4, max: 3, label: 'C' });
    const D = g.free('D', -2.9, 0);
    const Ew = g.free('E', 4.3, 0);
    const u = unit(sub(Ew, D));
    const F = g.point('F', add(D, mul(u, a)));
    const G = g.point('G', add(F, mul(u, b)));
    const H = g.point('H', add(G, mul(u, c)));
    if (dist(D, Ew) < a + b + c + 0.2) throw new Degenerate('E must lie beyond H');
    g.ray(D, Ew);
    const k1 = g.circle(F, D, { aux: true });
    const k2 = g.circle(G, H, { aux: true });
    const [K, L] = cc(k1, k2);
    g.points({ K, L });
    g.polygon([K, F, G]);
    // the given lines, set out above the construction
    const top = Math.max(D.y, Ew.y) + a + 0.9;
    const x0 = D.x;
    ([['A', a], ['B', b], ['C', c]] as const).forEach(([n, len], i) => {
      const y = top + 0.45 * (2 - i);
      g.segment(v(x0, y), v(x0 + len, y), { name: n });
      g.text(v(x0 - 0.3, y - 0.08), n);
    });
    g.equal('KF = A', dist(K, F), a);
    g.equal('FG = B', dist(F, G), b);
    g.equal('GK = C', dist(G, K), c);
  },
});

