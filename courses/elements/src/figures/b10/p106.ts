import { figure } from '../../geometry/figure';
import { drawComm, KIND, partsCaption } from './apotome';

export default figure({
  caption: `${partsCaption(5, ['AE', 'EB'])}. AB = AE − EB is ${KIND[5]}, and λ = CD : AB is a rational number.`,
  build(g) {
    drawComm(g, 5);
  },
});
