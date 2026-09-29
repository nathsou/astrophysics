import { figure } from '../../geometry/figure';
import { Lines } from './lib';

// AB and C, with DE = 3·C > AB. From AB we take BH (the fraction t₁ of AB, more than half), then
// from AH we take HK (the fraction t₂ of AH). Heath's figure has three parts on each side; the
// sliders keep 3·C > AB, as the proof needs.
export default figure({
  caption: 'Each slider says what fraction is taken away at each step (at least ½). However C is chosen, three copies of it exceed AB, and after two removals what is left of AB, namely AK, is less than C.',
  build(g) {
    const ab = 6;
    const c = g.param('c', 2.5, { min: 2.1, max: 5, step: 0.05, label: 'C' });
    const t1 = g.param('t1', 0.6, { min: 0.5, max: 0.9, step: 0.01, label: 'BH ÷ AB' });
    const t2 = g.param('t2', 0.55, { min: 0.5, max: 0.9, step: 0.01, label: 'HK ÷ AH' });
    const hb = t1 * ab;
    const ah = ab - hb;
    const hk = t2 * ah;
    const ak = ah - hk;
    const L = Lines.fit(g, 3 * c);
    L.row(['A', 'K', 'H', 'B'], [ak, hk, hb], 0, 2.4);
    L.mag('C', c, 0, 1.2);
    L.row(['D', 'F', 'G', 'E'], [c, c, c], 0, 0);
    g.claim('DE = 3·C > AB', 3 * c > ab);
    g.claim('BH > ½·AB', hb >= ab / 2);
    g.claim('HK > ½·AH', hk >= ah / 2);
    g.claim('GD > HA', 2 * c > ah);
    g.claim('DF > AK', c > ak);
    g.claim('AK < C', ak < c);
    g.show('AK', ak.toFixed(3));
  },
});
