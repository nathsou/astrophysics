import { figure } from '../../geometry/figure';
import { appliedCaption, drawApplied } from './apotome';

export default figure({
  caption: appliedCaption(2),
  build(g) {
    drawApplied(g, 2);
  },
});
