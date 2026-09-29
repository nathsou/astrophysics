import { figure } from '../../geometry/figure';
import { drawComm } from './apotome';

export default figure({
  caption: 'Choose the order of the apotome AB (annex BE) with the first slider, and the rational ratio λ = CD : AB with the second. DF is made so that BE : DF = AB : CD.',
  build(g) {
    drawComm(g, 1, { choose: [1, 2, 3, 4, 5, 6], apotome: true });
  },
});
