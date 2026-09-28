import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';

// If two planes cut one another, their common section is a straight line.
export default figure({
  dim: 3,
  build(g) {
    const tilt = g.param('tilt', 0.9, { min: 0.2, max: 1.4, label: 'angle' });
    const s = 1.4;
    // plane 1: the horizontal plane z = 0; plane 2: through the x-axis, tilted
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    const D = g.point('D', v(-s, 0, 0));
    const B = g.point('B', v(s, 0, 0));
    g.polygon([v(-s, -s, 0), v(s, -s, 0), v(s, s, 0), v(-s, s, 0)], { fill: true, name: 'AB' });
    g.polygon([v(-s, -s * c, -s * sn), v(s, -s * c, -s * sn), v(s, s * c, s * sn), v(-s, s * c, s * sn)], { fill: true, name: 'BC' });
    g.segment(D, B, { colour: 'red' });
    g.point('E', v(0.3, 0.5, 0));
    g.point('F', v(0.3, 0.5 * c, 0.5 * sn));
  },
});
