import { figure } from '../../geometry/figure';
import { drawRemainder } from './apotome';

export default figure({
  caption: 'BC and BD are medial areas √m and √n, incommensurable with each other (mn is not a square), and FG = 1 is the rational line. m = 8, n = 6 gives the first case, since √(8 − 6) is commensurable with √8.',
  build(g) {
    drawRemainder(g, 110);
  },
});
