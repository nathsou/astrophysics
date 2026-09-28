import { Ref, type Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ProvabilityProof } from '../../../workbench/provability/ProvabilityLab';

export function useAnnotations(): Annotations {
  return {
    'inc.inp.lob:proof:1': (
      <Added label="The derivation above, checked">
        <p className="sans small">
          The last line of the book’s proof cites <Ref k="inc:inp:lob:L-8" /> and <Ref k="inc:inp:lob:L-12" />; propositional logic needs <Ref k="inc:inp:lob:L-9" /> and <Ref k="inc:inp:lob:L-12" /> instead. The checked version below uses <Ref k="inc:inp:lob:L-9" />. The instances of P2 used
          in <Ref k="inc:inp:lob:L-4" /> and <Ref k="inc:inp:lob:L-5" /> are written out as separate lines.
        </p>
        <ProvabilityProof which="lob" />
      </Added>
    ),
  };
}
