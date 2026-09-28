import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ExampleCheck } from '../../../workbench/nd/ExampleCheck';

export function useAnnotations(): Annotations {
  return {
    'fol.ntd.prq:ex:1': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="prq-1" />
      </Added>
    ),
    'fol.ntd.prq:ex:2': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="prq-2" />
      </Added>
    ),
    'fol.ntd.prq:ex:3': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="prq-3" />
      </Added>
    ),
  };
}
