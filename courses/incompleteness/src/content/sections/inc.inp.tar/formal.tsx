import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ProvabilityProof } from '../../../workbench/provability/ProvabilityLab';

export function useAnnotations(): Annotations {
  return {
    'inc.inp.tar:proof:3': (
      <Added label="The core of the proof, checked">
        <ProvabilityProof which="tarski" />
      </Added>
    ),
  };
}
