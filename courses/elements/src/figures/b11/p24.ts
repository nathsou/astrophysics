import { figure } from '../../geometry/figure';
import { angle, deg, dist } from '../../geometry/vec';
import { area3, box, isParallel, mul, named, normal, sph, v3 } from './lib';

// A solid bounded by three pairs of parallel planes (a parallelepiped): its opposite faces are
// equal parallelograms. Bottom ABCD, top GHFE with G over A, H over B, F over C, E over D.
export default figure({
  dim: 3,
  camera: { yaw: -0.45, pitch: -0.3 },
  build(g) {
    const gam = g.param('gam', 1.25, { min: 0.9, max: 1.9, label: 'angle of the base' });
    const lean = g.param('lean', 0.35, { min: -0.3, max: 0.7, label: 'lean' });
    const hgt = g.param('hgt', 1.6, { min: 1, max: 2.2, label: 'height' });
    const a = v3(2.4, 0, 0);
    const b = mul(sph(gam), 1.6);
    const c = v3(lean, 0.3 * lean, hgt);
    const [A, B, C, D, Gp, H, F, E] = named(g, ['A', 'B', 'C', 'D', 'G', 'H', 'F', 'E'], box(v3(-1.4, -0.6, 0), a, b, c));
    g.polygon([A, B, C, D], { fill: true, name: 'AC' });
    g.polygon([Gp, H, F, E], { fill: true, name: 'GF' });
    g.polygon([A, B, H, Gp], { fill: true, name: 'BG' });
    g.polygon([D, C, F, E], { fill: true, name: 'CE' });
    g.polygon([B, C, F, H], { fill: true, name: 'BF' });
    g.polygon([A, D, E, Gp], { fill: true, name: 'AE' });
    g.segment(A, H, { aux: true });
    g.segment(D, F, { aux: true });
    g.equal('∠ABH = ∠DCF', deg(angle(A, B, H)), deg(angle(D, C, F)));
    g.equal('AH = DF', dist(A, H), dist(D, F));
    g.equal('▱BG = ▱CE', area3([A, B, H, Gp]), area3([D, C, F, E]));
    g.equal('▱AC = ▱GF', area3([A, B, C, D]), area3([Gp, H, F, E]));
    g.equal('▱AE = ▱BF', area3([A, D, E, Gp]), area3([B, C, F, H]));
    g.claim('BG ∥ CE (normals parallel)', isParallel(normal(A, B, H), normal(D, C, F)));
  },
});
