import { figure } from '../../geometry/figure';
import { add, area, dist, mul, v, type V } from '../../geometry/vec';
import { rod } from './lib';

// AB : CD = EF : GH. Similar triangles KAB, LCD on the first pair; similar parallelograms MF, NH on
// the second. O and P are the third proportionals (rods); QR (dashed) is the line of the reductio,
// made so that AB : CD = EF : QR — it comes out equal to GH.
export default figure({
  build(g) {
    const ab = g.param('AB', 1.8, { min: 0.8, max: 2.4 });
    const r = g.param('r', 0.6, { min: 0.3, max: 1.3, label: 'CD : AB' });
    const ef = g.param('EF', 1.5, { min: 0.8, max: 2.2 });
    const cd = r * ab;
    const gh = r * ef;
    const tri = (a: V, l: number): V => add(a, mul(v(0.3, 0.8), l));
    const par = (a: V, l: number): [V, V] => [add(a, mul(v(1.25, 0.55), l)), add(a, mul(v(0.25, 0.55), l))];
    const A = g.point('A', v(-3.4, 0.6));
    const B = g.point('B', add(A, v(ab, 0)));
    const K = g.point('K', tri(A, ab));
    const C = g.point('C', v(-0.9, 0.6));
    const D = g.point('D', add(C, v(cd, 0)));
    const L = g.point('L', tri(C, cd));
    const E = g.point('E', v(-3.4, -1.6));
    const F = g.point('F', add(E, v(ef, 0)));
    const [x1, M] = par(E, ef);
    g.point('M', M);
    const Gp = g.point('G', v(-0.9, -1.6));
    const H = g.point('H', add(Gp, v(gh, 0)));
    const [x2, N] = par(Gp, gh);
    g.point('N', N);
    g.polygon([K, A, B], { fill: true });
    g.polygon([L, C, D], { fill: true });
    const mf = [E, F, x1, M];
    const nh = [Gp, H, x2, N];
    g.polygon(mf, { fill: true });
    g.polygon(nh, { fill: true });
    // the reductio's QR (made so that AB : CD = EF : QR) and the figure SR on it, drawn dashed
    const Q = g.point('Q', v(1.5, -1.6));
    const qr = ef * (cd / ab);
    const R = g.point('R', add(Q, v(qr, 0)));
    const [x3, S] = par(Q, qr);
    g.point('S', S);
    g.polygon([Q, R, x3, S], { dashed: true });
    rod(g, 'O', v(1.8, 1.2), (cd * cd) / ab, { colour: 'red' });
    rod(g, 'P', v(1.8, 0.6), (gh * gh) / ef, { colour: 'blue' });
    const kab = area([K, A, B]);
    const lcd = area([L, C, D]);
    g.equal('KAB : LCD = MF : NH', kab / lcd, area(mf) / area(nh));
    g.equal('KAB : LCD = AB : O', kab / lcd, ab / ((cd * cd) / ab));
    g.equal('QR = GH', dist(Q, R), dist(Gp, H));
  },
});
