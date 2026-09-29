import { figure } from '../../geometry/figure';
import { add, area, dist, ll, sub } from '../../geometry/vec';

// DE is drawn parallel to BC. Dragging D along AB is a dilation of the small triangle ADE about A.
export default figure({
  build(g) {
    const A = g.free('A', -0.3, 2);
    const B = g.free('B', -1.6, -0.6);
    const C = g.free('C', 1.8, -0.6);
    const D = g.glider('D', [A, B], 0.42);
    const E = g.point('E', ll(D, add(D, sub(C, B)), A, C));
    g.polygon([A, B, C]);
    g.segment(D, E, { colour: 'red' });
    g.segment(B, E, { aux: true });
    g.segment(C, D, { aux: true });
    g.equal('BD : DA = CE : EA', dist(B, D) / dist(D, A), dist(C, E) / dist(E, A));
    g.equal('△BDE = △CDE', area([B, D, E]), area([C, D, E]));
    g.show('AD : AB (the dilation factor)', (dist(A, D) / dist(A, B)).toFixed(3));
  },
});
