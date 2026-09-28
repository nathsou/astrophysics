import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ProvabilityProof } from '../../../workbench/provability/ProvabilityLab';

export function useAnnotations(): Annotations {
  return {
    'inc.inp.lob:proof:1': (
      <Added label="The derivation above, checked">
        <p className="sans small">
          The last line of the book’s proof cites (L-8) and (L-12); propositional logic needs (L-9) and (L-12) instead. The checked version below uses (L-9). The instances of P2 used
          in (L-4) and (L-5) are written out as separate lines.
        </p>
        <ProvabilityProof which="lob" />
      </Added>
    ),
  };
}
