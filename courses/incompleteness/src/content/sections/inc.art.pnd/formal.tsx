import type { Annotations } from '../../../formal/FormalText';
import { BookExampleCode } from '../../../workbench/represent2/DerivationCodeLab';
import { Added, Prov } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'inc.art.pnd:ex:1': (
      <Added label="Computed, for your A and B">
        <div className="ann-title sans">
          <b>The example, as an exact (symbolic) number</b> <Prov kind="computed" />
        </div>
        <BookExampleCode />
      </Added>
    ),
  };
}
