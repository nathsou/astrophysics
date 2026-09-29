import { figure } from '../../geometry/figure';
import { drawRemainder } from './apotome';

export default figure({
  caption: 'BC is a medial area √m, BD a rational area b, and FG = 1 is the rational line. The case depends on whether √(m − b²) is commensurable with √m: m = 3, b = 3/2 gives the first case, b = 1 the second.',
  build(g) {
    drawRemainder(g, 109);
  },
});
