import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';

const note = (
  <Added label="Added for this edition: a note on the text">
    <p>
      The argument is about the diagonal instances, with <Tex tex="n = e" />: where the text writes <Tex tex="\exists z\,\mathsf T(\bar e, \bar n, z)" /> in the last two
      displayed claims, read <Tex tex="\exists z\,\mathsf T(\bar e, \bar e, z)" />.
    </p>
  </Added>
);

export function useAnnotations(): Annotations {
  return { 'inc.cpi.hal:proof:1': note };
}
