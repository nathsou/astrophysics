import { figure } from '../../geometry/figure';
import { appliedCaption, drawApplied } from './apotome';

export default figure({
  caption: appliedCaption(1),
  build(g) {
    drawApplied(g, 1);
  },
});
