import type { Annotations } from '../../../formal/FormalText';
import { NumeralLemmas } from '../../../workbench/NumeralLemmas';
import { Added } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'inc.req.bre:proof:1': (
      <Added label="Checked instances">
        <NumeralLemmas initial="neq" />
      </Added>
    ),
    'inc.req.bre:proof:3': (
      <Added label="Checked instances">
        <NumeralLemmas initial="add" />
      </Added>
    ),
  };
}
