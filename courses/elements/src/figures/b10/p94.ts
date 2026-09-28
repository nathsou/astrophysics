import { figure } from '../../geometry/figure';
import { drawSide } from './apotome';

export default figure({
  caption: 'AC = 1 is the rational line and the slider picks a fourth apotome AD. The square ST on LN = LP − PN equals the rectangle AB, and LN is minor.',
  build(g) {
    drawSide(g, 4);
  },
});
