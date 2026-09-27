import type { Annotations } from '../../../formal/FormalText';
import { YourClauses } from '../../../workbench/annotations';

export function useAnnotations(): Annotations {
  return {
    'inc.req.cmp:proof:2': <YourClauses which="b" />,
  };
}
