import { figure } from '../../geometry/figure';
import { add } from '../../geometry/vec';
import { area3, divide, exhaust, solid, TETRA_FACES, tetra, v3 } from './lib';

// Pyramids ABCG, DEFH of the same height. The slider divides DEFH again and again (XII.3): the
// pyramids that are left (shaded) shrink to a quarter of their volume at each step, until they are
// less than the excess of DEFH over the supposed solid W.
export default figure({
  dim: 3,
  camera: { yaw: -0.25, pitch: 0.3 },
  build(g) {
    const h = g.param('h', 2.4, { min: 1.2, max: 3.2, label: 'common height' });
    const n = g.param('n', 2, { min: 0, max: 4, label: 'divisions of DEFH' });
    const w = g.param('w', 0.9, { min: 0.6, max: 0.99, label: 'W ÷ pyramid DEFH' });
    const A = g.point('A', v3(-4.4, -0.6, 0));
    const B = g.point('B', v3(-1.2, -1.0, 0));
    const C = g.point('C', v3(-2.2, 1.2, 0));
    const G = g.point('G', v3(-2.7, 0.1, h));
    const o2 = v3(2.4, 0, 0);
    const at = (x: number, y: number) => add(o2, v3(0.8 * x, 0.8 * y, 0));
    const D = g.point('D', at(-1.5, -1.1));
    const E = g.point('E', at(1.9, -0.5));
    const F = g.point('F', at(-0.2, 1.4));
    const H = g.point('H', add(at(0.2, 0.1), v3(0, 0, h)));
    const one = divide([D, E, F, H]);
    const Q = g.point('Q', one.mids.e);
    const R = g.point('R', one.mids.g);
    const S = g.point('S', one.mids.h);
    const T = g.point('T', one.mids.k);
    const U = g.point('U', one.mids.l);
    solid(g, [A, B, C, G], TETRA_FACES, { name: 'ABCG' });
    g.curve([D, E, F, D, H, E, H, F], { name: 'DEFH' });
    const left = exhaust([D, E, F, H], n);
    for (const p of left.left) for (const f of TETRA_FACES) g.polygon(f.map((i) => p[i]), { fill: true, aux: true });
    if (n >= 1) {
      g.curve([D, Q, R, D, S, Q, S, R], { aux: true, name: 'DQRS' });
      g.curve([S, T, U, S, H, T, H, U], { aux: true, name: 'STUH' });
    }
    const V2 = tetra(D, E, F, H);
    const leftVol = V2 - left.prisms;
    g.show('pyramids left in DEFH ÷ DEFH', (leftVol / V2).toFixed(5));
    g.show('(DEFH − W) ÷ DEFH', (1 - w).toFixed(5));
    g.claim(`prisms in DEFH ${left.prisms > w * V2 ? '>' : '≤'} W exactly when the pyramids left < DEFH − W`, left.prisms > w * V2 === leftVol < V2 - w * V2);
    g.equal('what is left = (¼)ⁿ DEFH', leftVol, V2 / 4 ** n);
    const ratio = area3([A, B, C]) / area3([D, E, F]);
    const two = exhaust([A, B, C, G], n);
    if (n > 0) g.equal('prisms in ABCG : prisms in DEFH = ABC : DEF', two.prisms / left.prisms, ratio);
    g.equal('pyramid ABCG : pyramid DEFH = ABC : DEF', tetra(A, B, C, G) / V2, ratio);
  },
  unresolved: { W: 'the solid W, supposed less (then greater) than the pyramid DEFH; it cannot exist' },
});
