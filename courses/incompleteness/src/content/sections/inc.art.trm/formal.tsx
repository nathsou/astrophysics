import type { Annotations } from '../../../formal/FormalText';
import { YourFormationSequence } from '../../../workbench/annotations';
import { NumeralLab } from '../../../workbench/NumeralLab';
import { Added } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'inc.art.trm:proof:1': <YourFormationSequence />,
    'inc.art.trm:proof:2': (
      <Added label="Computed">
        <NumeralLab />
      </Added>
    ),
  };
}
