import { figure } from '../../geometry/figure';
import { Rods, divides, gcd } from './lib';

// D = B·C; the fourth proportional E = D / A exists exactly when A measures D.
export default figure({
  caption: 'D is B times C. A fourth proportional E to A, B, C exists exactly when A measures D, and then E = D / A; otherwise E is dashed. Try A = 2, B = 4, C = 3: not in continued proportion, extremes prime to one another, and yet E = 6 exists, against the second case of the text.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 9, label: 'A' });
    const b = g.param('b', 6, { min: 2, max: 9, label: 'B' });
    const c = g.param('c', 8, { min: 2, max: 9, label: 'C' });
    const d = b * c;
    const e = d / a;
    const ok = divides(a, d);
    const R = new Rods(g, d);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6);
    R.num('E', e, 0, -4.8, ok ? {} : { dashed: true, ticks: false });
    const continued = a * c === b * b;
    const coprime = gcd(a, c) === 1;
    g.show('A, B, C in continued proportion', continued ? 'yes' : 'no');
    g.show('extremes A, C prime to one another', coprime ? 'yes' : 'no');
    g.show('E = D / A', ok ? e : e.toFixed(2));
    const found: number[] = [];
    for (let x = 1; x <= d; x++) if (a * x === b * c) found.push(x);
    g.claim('a fourth proportional exists ⇔ A measures B·C', (found.length > 0) === ok);
    g.claim('if it exists, A : B = C : E', !ok || a * e === b * c);
  },
});
