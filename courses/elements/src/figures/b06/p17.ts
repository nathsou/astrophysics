import { figure } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import { rod } from './lib';

// A : B = B : C. The rectangle A·C (left) equals the square on B, which is the rectangle B·D with D = B (right).
export default figure({
  build(g) {
    const a = g.param('a', 2.2, { min: 1, max: 3, label: 'A' });
    const b = g.param('b', 1.4, { min: 0.6, max: 2, label: 'B' });
    const c = (b * b) / a;
    rod(g, 'A', v(-3, -0.9), a, { colour: 'red' });
    rod(g, 'B', v(-3, -1.4), b, { colour: 'blue' });
    rod(g, 'C', v(-3, -1.9), c, { colour: 'yellow' });
    rod(g, 'D', v(-3, -2.4), b, { colour: 'black' });
    g.polygon([v(-3, 0), v(-3 + a, 0), v(-3 + a, c), v(-3, c)], { fill: true, name: 'AC' });
    g.polygon([v(0.4, 0), v(0.4 + b, 0), v(0.4 + b, b), v(0.4, b)], { fill: true, name: 'BD' });
    g.text(v(-3 + a / 2 - 0.15, c / 2), 'A·C');
    g.text(v(0.4 + b / 2 - 0.15, b / 2), 'B·D');
    g.equal('A : B = B : C', a / b, b / c);
    g.equal('A·C = B²', a * c, b * b);
  },
});
