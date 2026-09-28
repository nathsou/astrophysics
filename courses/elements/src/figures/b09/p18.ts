import { figure } from '../../geometry/figure';
import { Rods, divides, gcd } from './lib';

// C = B²; the third proportional D = C / A exists exactly when A measures C.
export default figure({
  caption: 'C is B times itself. A third proportional D to A, B exists exactly when A measures C, and then D = C / A. When A does not measure C, D is drawn dashed: it is not a number.',
  build(g) {
    const a = g.param('a', 4, { min: 2, max: 9, label: 'A' });
    const b = g.param('b', 6, { min: 2, max: 9, label: 'B' });
    const c = b * b;
    const d = c / a;
    const ok = divides(a, c);
    const R = new Rods(g, c);
    R.num('A', a, 0, 0);
    R.num('B', b, 0, -1.2);
    R.num('C', c, 0, -2.4);
    R.num('D', d, 0, -3.6, ok ? {} : { dashed: true, ticks: false });
    const found: number[] = [];
    for (let x = 1; x <= c; x++) if (a * x === b * b) found.push(x);
    g.show('case', gcd(a, b) === 1 ? 'A, B prime to one another' : ok ? 'A measures C' : 'A does not measure C');
    g.show('D = C / A', ok ? d : d.toFixed(2));
    g.claim('a third proportional exists ⇔ A measures C', (found.length > 0) === ok);
    g.claim('A, B prime to one another ⇒ none exists', gcd(a, b) !== 1 || !ok);
    g.claim('if it exists, A : B = B : D', !ok || a * d === b * b);
  },
});
