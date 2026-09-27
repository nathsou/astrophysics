import type { Annotations } from '../../../formal/FormalText';
import { YourFreeOcc, YourFrm } from '../../../workbench/annotations';

export function useAnnotations(): Annotations {
  return {
    'inc.art.frm:proof:2': <YourFrm />,
    'inc.art.frm:proof:3': <YourFreeOcc />,
  };
}
