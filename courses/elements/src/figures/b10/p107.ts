import { figure } from '../../geometry/figure';
import { drawComm, KIND, partsCaption } from './apotome';

export default figure({
  caption: `${partsCaption(6, ['AE', 'EB'])}. AB = AE − EB is ${KIND[6]}, and λ = CD : AB is a rational number.`,
  build(g) {
    drawComm(g, 6);
  },
});
