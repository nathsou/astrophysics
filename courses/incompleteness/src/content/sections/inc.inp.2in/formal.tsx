import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ProvabilityProof } from '../../../workbench/provability/ProvabilityLab';

export function useAnnotations(): Annotations {
  return {
    'inc:inp:2in:thm:second-incompleteness-gen': (
      <Added label="The derivation above, checked">
        <ProvabilityProof which="g2" />
      </Added>
    ),
  };
}
