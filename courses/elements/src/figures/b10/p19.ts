import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// Against the rational line ρ = 1: AB = a·√k and BC = b·√k are rational and commensurable in
// length. The square AD on AB is rational, and the rectangle AC is to it as BC to BD (VI.1).
export default figure({
  caption: 'ρ is the assigned rational line. AB = a√k and BC = b√k: both rational, commensurable in length. The rectangle AC = ab·k·ρ², a rational area.',
  build(g) {
    const k = g.param('k', 2, { min: 1, max: 5, label: 'k' });
    const a = g.param('a', 2, { min: 1, max: 3, label: 'AB = a√k: a' });
    const b = g.param('b', 3, { min: 1, max: 3, label: 'BC = b√k: b' });
    const ab = a * Math.sqrt(k);
    const bc = b * Math.sqrt(k);
    const L = Lines.fit(g, 3 * Math.sqrt(5) * 2 + 1.5, 10);
    const x0 = L.x(ab);
    L.rect(['D', 'B', 'A', '~1'], 0, 0, ab, ab, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['B', 'C', '~2', 'A'], ab, 0, bc, ab, {}, [270, 315, 45, 90]);
    g.segment(L.pt('A', { x: x0, y: L.x(ab) }), L.pt('B', { x: x0, y: 0 }));
    L.bare(1, 0, -0.9, 'ρ');
    const area = ab * bc;
    g.show('AB, BC', `${a}√${k}, ${b}√${k}`);
    g.equal('rectangle AC = ab·k·ρ² (a rational area)', area, a * b * k);
    g.equal('DA : AC = BD : BC', (ab * ab) / area, ab / bc);
  },
});
