import { figure } from '../../geometry/figure';
import { add, mul, rot, v, type V } from '../../geometry/vec';
import { similar } from './lib';

// Three rectilineal figures: A and B are each similar to C (scaled and turned copies of it).
export default figure({
  build(g) {
    const sa = g.param('a', 0.7, { min: 0.3, max: 1.2, label: 'size of A' });
    const sb = g.param('b', 1.1, { min: 0.3, max: 1.4, label: 'size of B' });
    const tb = g.param('t', 0.5, { min: -1.5, max: 1.5, label: 'turn of B' });
    const shape = [v(0, 0), v(1.4, 0), v(1.7, 0.9), v(0.6, 1.4), v(-0.2, 0.8)];
    const place = (c: V, s: number, t: number) => shape.map((p) => add(c, mul(rot(p, t), s)));
    const pc = place(v(-0.8, -2.2), 1, 0);
    const pa = place(v(-3.2, 0.4), sa, 0.3);
    const pb = place(v(1.4, 0.2), sb, tb);
    g.polygon(pa, { fill: true, name: 'A', colour: 'red' });
    g.polygon(pb, { fill: true, name: 'B', colour: 'blue' });
    g.polygon(pc, { fill: true, name: 'C', colour: 'yellow' });
    g.text(add(pa[0], v(0.3 * sa, 0.5 * sa)), 'A');
    g.text(add(pb[0], mul(rot(v(0.4, 0.5), tb), sb)), 'B');
    g.text(add(pc[0], v(0.4, 0.5)), 'C');
    g.claim('A ∼ C', similar(pa, pc));
    g.claim('B ∼ C', similar(pb, pc));
    g.claim('A ∼ B', similar(pa, pb));
  },
});
