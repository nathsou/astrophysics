import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ExampleCheck } from '../../../workbench/nd/ExampleCheck';

export function useAnnotations(): Annotations {
  return {
    'fol.ntd.qrl:explain:1': (
      <Added label="Both remarks, checked">
        <ExampleCheck id="qrl-exI" />
        <ExampleCheck id="qrl-bad-2" />
      </Added>
    ),
    'fol.ntd.qrl:explain:2': (
      <Added label="The incorrect derivation, checked">
        <ExampleCheck id="qrl-bad" />
      </Added>
    ),
  };
}
