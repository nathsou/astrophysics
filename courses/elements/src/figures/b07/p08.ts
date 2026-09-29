import { figure } from '../../geometry/figure';
import { Rods } from './lib';

// AB is two n-th parts of CD (n odd), AE two n-th parts of CF. GH is a copy of AB divided into
// GK, KH; AE is divided into AL, LE; GM = AL and KN = EL.
export default figure({
  caption: 'AB is the same parts of CD that AE is of CF. GH is a copy of AB, divided like AB into parts of CD; GM and KN copy the parts AL and LE of AE.',
  build(g) {
    const n = g.param('n', 3, { min: 3, max: 5, step: 2, label: 'n' });
    const p = g.param('p', 4, { min: 2, max: 6, label: 'GK' });
    const q0 = g.param('q', 2, { min: 1, max: 5, label: 'AL' });
    const q = Math.min(q0, p - 1);
    const R = new Rods(g, n * p);
    R.seg('A', 'B', 2 * p, 0, 0);
    R.mark('L', 0, 0, q);
    R.mark('E', 0, 0, 2 * q);
    R.seg('C', 'D', n * p, 0, -1.2);
    R.mark('F', 0, -1.2, n * q);
    R.seg('G', 'H', 2 * p, 0, -2.6);
    R.mark('M', 0, -2.6, q);
    R.mark('K', 0, -2.6, p);
    R.mark('N', 0, -2.6, p + q);
    const EB = 2 * p - 2 * q;
    const FD = n * p - n * q;
    g.show('AB of CD, AE of CF', `${2 * p}/${n * p}, ${2 * q}/${n * q}`);
    g.equal('MK + NH = EB', 2 * (p - q), EB);
    g.equal('FD = n·MK', FD, n * (p - q));
    g.equal('EB·CD = FD·AB', EB * n * p, FD * 2 * p);
  },
});
