import type { Annotations } from '../../../formal/FormalText';
import { YourArithSubst, YourFreeFor } from '../../../workbench/annotations';

export function useAnnotations(): Annotations {
  return {
    'inc.art.sub:proof:1': <YourArithSubst />,
    'inc.art.sub:proof:2': <YourFreeFor />,
  };
}
