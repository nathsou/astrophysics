import type { Annotations } from '../../../formal/FormalText';
import { IncompletenessExplorer } from '../../../workbench/IncompletenessExplorer';

export function useAnnotations(): Annotations {
  return {
    'inc.inp.1in:proof:3': <IncompletenessExplorer />,
  };
}
