import { figure } from '../../geometry/figure';
import { appliedCaption, drawApplied } from './apotome';

export default figure({
  caption: appliedCaption(5),
  build(g) {
    drawApplied(g, 5);
  },
});
