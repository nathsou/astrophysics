import { figure } from '../../geometry/figure';
import { drawSide } from './apotome';

export default figure({
  caption: 'AC = 1 is the rational line and the slider picks a sixth apotome AD. The square ST on LN = LP − PN equals the rectangle AB, and LN is the line that produces with a medial area a medial whole.',
  build(g) {
    drawSide(g, 6);
  },
});
