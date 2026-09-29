import { figure } from '../../geometry/figure';
import { box, boxVolume, drawBox, mul, named, prismVolume, sph, v3 } from './lib';

// A parallelepiped is bisected by the plane through the diagonals CF, DE of two opposite faces.
// Bottom D A E H, top C G F B (C over D, G over A, F over E, B over H).
export default figure({
  dim: 3,
  camera: { yaw: -0.4, pitch: -0.35 },
  build(g) {
    const gam = g.param('gam', 1.3, { min: 0.9, max: 1.9, label: 'angle of the base' });
    const lean = g.param('lean', 0.3, { min: -0.4, max: 0.7, label: 'lean' });
    const hgt = g.param('hgt', 1.7, { min: 1.1, max: 2.3, label: 'height' });
    const bx = box(v3(-1.3, -0.5, 0), v3(2.4, 0, 0), mul(sph(gam), 1.6), v3(lean, 0.25 * lean, hgt));
    const [D, A, E, H, C, Gp, F, B] = named(g, ['D', 'A', 'E', 'H', 'C', 'G', 'F', 'B'], bx);
    drawBox(g, bx);
    g.polygon([C, D, E, F], { fill: true, colour: 'red', name: 'CE' });
    g.polygon([C, D, A, Gp], { fill: true, aux: true, name: 'CA' });
    g.polygon([E, H, B, F], { fill: true, aux: true, name: 'EB' });
    g.polygon([Gp, A, E, F], { fill: true, aux: true, name: 'GE' });
    g.polygon([C, D, H, B], { fill: true, aux: true, name: 'CH' });
    const v1 = prismVolume([D, A, E], [C, Gp, F]);
    const v2 = prismVolume([D, E, H], [C, F, B]);
    g.equal('prism CGF-ADE = prism CFB-DEH', v1, v2);
    g.equal('each prism = half the solid AB', v1, boxVolume(bx) / 2);
  },
});
