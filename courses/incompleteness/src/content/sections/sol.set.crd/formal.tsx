import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { PrintedFormulaCheck } from '../../../workbench/semantics/annotations';

export function useAnnotations(): Annotations {
  return {
    'sol.set.crd:prop:1': (
      <Added label="Computed for this edition">
        <PrintedFormulaCheck which="inf" />
      </Added>
    ),
    'sol.set.crd:prop:2': (
      <Added label="Computed for this edition">
        <PrintedFormulaCheck which="count" />
      </Added>
    ),
  };
}
