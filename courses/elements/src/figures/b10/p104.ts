import { figure } from '../../geometry/figure';
import { drawComm } from './apotome';

export default figure({
  caption: 'Choose a first or second apotome of a medial straight line AB (annex EB) with the first slider, and the rational ratio λ = CD : AB with the second.',
  build(g) {
    drawComm(g, 2, { choose: [2, 3] });
  },
});
