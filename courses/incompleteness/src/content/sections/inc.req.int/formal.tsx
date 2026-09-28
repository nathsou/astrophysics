import type { Annotations } from '../../../formal/FormalText';
import { YourClauses } from '../../../workbench/annotations';

export function useAnnotations(): Annotations {
  return {
    'inc:req:int:defn:representable-fn': <YourClauses />,
  };
}
