import { figure } from '../../geometry/figure';
import { ngonArea, pyramidFaces, pyramidVol, ring, v3 } from './lib';

// A cone and a cylinder on the same base, the circle ABCD, with the same height. The square ABCD
// and the octagon AEBFCGDH are inscribed in the base, and the pyramid on the octagon with the
// cone's vertex is drawn. The slider keeps doubling the sides: the readouts compare the prism and
// the pyramid on the polygon with the cylinder and the cone.
export default figure({
  dim: 3,
  camera: { yaw: -0.5, pitch: 0.38 },
  build(g) {
    const r = g.param('r', 1.6, { min: 1, max: 2, label: 'radius' });
    const h = g.param('h', 2.6, { min: 1.5, max: 3.5, label: 'height' });
    const k = g.param('k', 1, { min: 0, max: 5, label: 'doublings' });
    const O = v3(0, 0, 0);
    const top = v3(0, 0, h);
    const t0 = (200 * Math.PI) / 180;
    const [A, E, B, F, C, G, D, H] = ring(O, r, 8, t0);
    const P = g.points({ A, B, C, D, E, F, G, H });
    g.circle3(O, v3(0, 0, 1), r);
    g.circle3(top, v3(0, 0, 1), r, { aux: true });
    // the cylinder's sides (four generators) and the cone's axis
    for (const p of [A, B, C, D]) g.segment(p, v3(p.x, p.y, h), { aux: true });
    g.segment(O, top, { aux: true, dashed: true });
    g.polygon([P.A, P.B, P.C, P.D], { aux: true });
    const oct = [P.A, P.E, P.B, P.F, P.C, P.G, P.D, P.H];
    const faces = pyramidFaces(8);
    for (const f of faces.slice(1)) g.polygon(f.map((i) => [...oct, top][i]), { fill: true });
    g.polygon(oct, { fill: true });
    const n = 4 * 2 ** k;
    if (k > 1) g.curve(ring(O, r, n, t0), { closed: true, aux: true });
    const base = ngonArea(n, r);
    const circle = Math.PI * r * r;
    const prismN = base * h;
    const pyrN = pyramidVol(ring(O, r, n, t0), top);
    g.show(`prism on the ${n}-gon ÷ cylinder`, (prismN / (circle * h)).toFixed(5));
    g.show(`pyramid on the ${n}-gon ÷ cone`, (pyrN / ((circle * h) / 3)).toFixed(5));
    g.equal(`prism on the ${n}-gon = 3 × pyramid on it`, prismN, 3 * pyrN);
    g.claim('the prism on the square ABCD > ½ cylinder', ngonArea(4, r) * h > (circle * h) / 2);
    const gap = (m: number) => circle - ngonArea(m, r);
    g.claim(`each doubling removes more than half of what is left (${n / 2} → ${n})`, k === 0 || gap(n) < gap(n / 2) / 2);
  },
});
