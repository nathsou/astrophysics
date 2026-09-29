import { figure } from '../../geometry/figure';
import { drawComm, KIND, partsCaption } from './apotome';

export default figure({
  caption: `${partsCaption(4, ['AE', 'EB'])}. AB = AE − EB is ${KIND[4]}, and λ = CD : AB is a rational number.`,
  build(g) {
    drawComm(g, 4);
  },
});
