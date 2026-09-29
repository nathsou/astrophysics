import { figure } from '../../geometry/figure';
import { Lines, surd } from './lib';

// Against ρ = 1: AB = √m is rational, and the rational area AC = N·ρ² is applied to it. The
// breadth BC = N/√m is rational and commensurable in length with AB: BC : AB = N : m.
export default figure({
  caption: 'A rational area N·ρ² applied to the rational line AB = √m has breadth BC = N/√m, and BC : AB = N : m, a ratio of numbers.',
  build(g) {
    const m = g.param('m', 3, { min: 1, max: 7, label: 'AB = √m: m' });
    const N = g.param('N', 5, { min: 1, max: 8, label: 'area AC = N·ρ²: N' });
    const ab = Math.sqrt(m);
    const bc = N / ab;
    const L = Lines.fit(g, Math.sqrt(7) + 8 + 1, 10);
    L.rect(['D', 'B', 'A', '~1'], 0, 0, ab, ab, { fill: true, aux: true }, [225, 270, 90, 135]);
    L.rect(['B', 'C', '~2', 'A'], ab, 0, bc, ab, {}, [270, 315, 45, 90]);
    L.bare(1, 0, -0.9, 'ρ');
    g.show('AB, BC', `√${m}, ${surd(N * N, m)}`);
    g.equal('AB·BC = N (the area AC)', ab * bc, N);
    g.equal('BC : AB = N : m', bc / ab, N / m);
  },
});
