import { figure } from '../../geometry/figure';
import { box, boxVolume, drawBox, mul, sph, v3, X3 } from './lib';

// If AB : CD = EF : GH, similar and similarly situated parallelepipeds on them are proportional
// (and conversely): each ratio of solids is the cube of the ratio of lines (XI.33).
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: -0.35 },
  build(g) {
    const ab = g.param('ab', 1.6, { min: 1.2, max: 1.9, label: 'AB' });
    const cd = g.param('cd', 1.1, { min: 0.7, max: 1.4, label: 'CD' });
    const ef = g.param('ef', 1.4, { min: 1, max: 1.8, label: 'EF' });
    const gh = (cd * ef) / ab;
    // the shape: edges along the line, back, and up, proportional to the line
    const sb = mul(sph(1.3), 0.6);
    const su = v3(0.15, 0.05, 0.75);
    let x = -3.6;
    const solid = (l: number, n1: string, n2: string, top: string) => {
      const o = v3(x, 0, 0);
      const bx = box(o, mul(X3, l), mul(sb, l), mul(su, l));
      x += l + 0.6;
      const P1 = g.point(n1, o);
      const P2 = g.point(n2, bx[1]);
      g.point(top, bx[6]);
      drawBox(g, bx);
      g.segment(P1, P2, { colour: 'red' });
      g.polygon(bx.slice(0, 4), { fill: true, aux: true });
      return bx;
    };
    const s1 = solid(ab, 'A', 'B', 'K');
    const s2 = solid(cd, 'C', 'D', 'L');
    const s3 = solid(ef, 'E', 'F', 'M');
    const s4 = solid(gh, 'G', 'H', 'N');
    const [v1, v2, v3_, v4] = [s1, s2, s3, s4].map(boxVolume);
    g.equal('AB : CD = EF : GH', ab / cd, ef / gh);
    g.equal('KA : LC = ME : NG', v1 / v2, v3_ / v4);
    g.equal('KA : LC = (AB : CD)³', v1 / v2, (ab / cd) ** 3);
  },
});
