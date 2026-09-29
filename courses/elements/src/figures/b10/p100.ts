import { figure } from '../../geometry/figure';
import { appliedCaption, drawApplied } from './apotome';

export default figure({
  caption: appliedCaption(4),
  build(g) {
    drawApplied(g, 4);
  },
});
