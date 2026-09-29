import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// AB is the n-th part of CD, and AE the n-th part of CF. CG is made n times EB, laid off before C.
export default figure({
  caption: 'AB is the same part of CD that AE is of CF. The construction lays off GC (dashed) so that EB is that part of GC; then GF = CD, so GC = FD.',
  build(g) {
    const n = g.param('n', 3, { min: 2, max: 4, label: 'n' });
    const x = g.param('x', 4, { min: 2, max: 7, label: 'AB' });
    const y0 = g.param('y', 1, { min: 1, max: 6, label: 'AE' });
    const y = Math.min(y0, x - 1);
    const R = new Rods(g, n * x + n * (x - y), 12);
    const off = R.x(n * (x - y));
    R.seg('A', 'B', x, off, 0);
    R.mark('E', off, 0, y);
    const { a: C } = R.seg('C', 'D', n * x, off, -1.2, { dirs: [90, 0] });
    R.mark('F', off, -1.2, n * y);
    const Gp = g.point('G', { x: 0, y: -1.2 }, { labelDir: 180 });
    g.segment(Gp, C, { dashed: true, ticks: R.u });
    const EB = x - y;
    const FD = n * x - n * y;
    const GC = n * EB;
    g.show('AB, CD, AE, CF', `${x}, ${n * x}, ${y}, ${n * y}`);
    g.equal('GF = CD', GC + n * y, n * x);
    g.equal('GC = FD', GC, FD);
    g.equal('FD = n·EB', FD, n * EB);
  },
});
