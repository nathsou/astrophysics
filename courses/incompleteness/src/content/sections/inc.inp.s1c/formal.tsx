import type { Annotations } from '../../../formal/FormalText';
import { Sigma1Summary } from '../../../workbench/represent2/Sigma1Lab';
import { Added, Prov } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'inc:inp:s1c:thm:sigma1-completeness': (
      <Added label="Computed, for your sentence">
        <div className="ann-title sans">
          <b>The theorem applied to your sentence</b> <Prov kind="computed" />
        </div>
        <Sigma1Summary />
      </Added>
    ),
  };
}
