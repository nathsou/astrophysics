import { figure } from '../../geometry/figure';
import { sub, v } from '../../geometry/vec';
import { ccw, degAt, dirOf, need, onArc } from './lib';

// The inscribed angle theorem. Drag A or D along the arc: the angles BAC and BDC stay equal, each
// half of the angle BEC at the centre. For A the centre lies inside the angle (the first case of
// the proof); for D, near B, it lies outside (the second case, with the subtraction).
export default figure({
  build(g) {
    const E = g.point('E', v(0, 0));
    const k = g.circle(E, 2);
    const rad = Math.PI / 180;
    const B = g.glider('B', k, 222 * rad);
    const C = g.glider('C', k, 318 * rad);
    need(ccw(dirOf(E, B), dirOf(E, C)) < Math.PI - 0.05 && ccw(dirOf(E, B), dirOf(E, C)) > 0.1, 'the arc BC less than a semicircle');
    const A = g.glider('A', k, 95 * rad);
    const D = g.glider('D', k, 168 * rad);
    need(onArc(E, C, B, A) && onArc(E, C, B, D), 'A and D stay on the arc opposite BC');
    const F = g.point('F', sub(v(0, 0), A));
    const G = g.point('G', sub(v(0, 0), D));
    g.path(B, A, C);
    g.path(B, D, C, { aux: true });
    g.path(B, E, C);
    g.segment(A, F, { aux: true });
    g.segment(D, G, { aux: true });
    g.angle(B, A, C);
    g.angle(B, D, C);
    g.angle(B, E, C);
    const bec = degAt(B, E, C);
    g.equal('∠BEC = 2∠BAC', bec, 2 * degAt(B, A, C));
    g.equal('∠BEC = 2∠BDC', bec, 2 * degAt(B, D, C));
    g.show('∠BAC', `${degAt(B, A, C).toFixed(2)}°`);
    g.show('∠BDC', `${degAt(B, D, C).toFixed(2)}°`);
  },
});
