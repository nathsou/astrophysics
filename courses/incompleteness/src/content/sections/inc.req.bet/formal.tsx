import type { Annotations } from '../../../formal/FormalText';
import { BetaSummary } from '../../../workbench/represent2/BetaLab';
import { Added, Prov } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'inc:req:bet:lem:beta': (
      <Added label="Computed, for your sequence">
        <div className="ann-title sans">
          <b>The construction in the proof, for your sequence</b> <Prov kind="computed" />
        </div>
        <BetaSummary />
      </Added>
    ),
  };
}
