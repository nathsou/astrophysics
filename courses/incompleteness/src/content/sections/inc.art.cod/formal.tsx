import type { Annotations } from '../../../formal/FormalText';
import { V5Example, YourGodelNumber, YourSymbolCodes } from '../../../workbench/annotations';

export function useAnnotations(): Annotations {
  return {
    'inc.art.cod:defn:1': <YourSymbolCodes />,
    'inc.art.cod:explain:1': <V5Example />,
    'inc.art.cod:ex:1': <YourGodelNumber />,
  };
}
