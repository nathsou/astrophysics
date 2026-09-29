import { figure } from '../../geometry/figure';
import { APOTOME_FORMULA, drawSide, KIND, ORDINAL } from './apotome';

export default figure({
  caption: `AC = 1 is the rational line and AD = ${APOTOME_FORMULA[1]} is a ${ORDINAL[1]} apotome (choose it with the sliders). The square ST on LN = LP − PN equals the rectangle AB, and LN is ${KIND[1]}.`,
  build(g) {
    drawSide(g, 1);
  },
});
