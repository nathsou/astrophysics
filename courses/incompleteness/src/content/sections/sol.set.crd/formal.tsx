import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { PrintedAleph1Check, PrintedFormulaCheck } from '../../../workbench/semantics/annotations';

export function useAnnotations(): Annotations {
  return {
    'sol.set.crd:prop:1': (
      <Added label="Computed for this edition">
        <PrintedFormulaCheck which="inf" />
      </Added>
    ),
    'sol.set.crd/p12': (
      <Added label="A slip in the book, computed">
        <PrintedAleph1Check />
      </Added>
    ),
    'sol.set.crd:prop:2': (
      <Added label="Computed for this edition">
        <PrintedFormulaCheck which="count" />
      </Added>
    ),
  };
}
