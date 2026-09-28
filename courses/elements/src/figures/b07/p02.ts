import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';

// Numbers are drawn as rods of units. AB, CD are the two given numbers; E, F mark the remainders
// of Euclid's repeated subtraction, and CF is their greatest common measure.
export default figure({
  build(g) {
    const a = g.param('a', 36, { min: 2, max: 60, label: 'AB' });
    const b = g.param('b', 15, { min: 2, max: 60, label: 'CD' });
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    const u = 1;
    const A = g.point('A', v(0, 2));
    const B = g.point('B', v(big * u, 2));
    const C = g.point('C', v(0, 0));
    const D = g.point('D', v(small * u, 0));
    g.segment(A, B, { ticks: u });
    g.segment(C, D, { ticks: u });
    // CD measuring BE leaves EA; EA measuring DF leaves FC
    const r1 = big % small;
    const E = g.point('E', v(r1 * u, 2));
    const r2 = r1 === 0 ? 0 : small % r1;
    const F = g.point('F', v(r2 * u, 0));
    g.segment(A, E, { colour: 'red' });
    g.segment(C, F, { colour: 'blue' });
    const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
    // G is the supposed greater common measure of the reductio: drawn dashed, one unit longer than CF.
    const gl = gcd(big, small) + 1;
    g.segment(v(0, -2), v(gl * u, -2), { name: 'G', dashed: true, ticks: u, text: 'G?' });
    g.show('gcd(AB, CD)', gcd(big, small));
    g.show('BE = AB − EA', big - r1);
    void B;
    void D;
  },
});
