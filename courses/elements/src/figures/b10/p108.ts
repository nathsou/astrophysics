import { figure } from '../../geometry/figure';
import { drawRemainder } from './apotome';

export default figure({
  caption: 'BC is a rational area a, BD a medial area √m, and FG = 1 is the rational line. Which of the two cases occurs depends on whether a² − m is the square of a rational number.',
  build(g) {
    drawRemainder(g, 108);
  },
});
