import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { BookExampleClaims } from '../../../workbench/semantics/annotations';

export function useAnnotations(): Annotations {
  return {
    'fol.syn.sat:ex:1': (
      <Added>
        <BookExampleClaims />
      </Added>
    ),
  };
}
