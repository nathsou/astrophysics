import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ExampleCheck } from '../../../workbench/nd/ExampleCheck';

export function useAnnotations(): Annotations {
  return {
    'fol.ntd.pro:ex:1': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="pro-1" />
      </Added>
    ),
    'fol.ntd.pro:ex:2': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="pro-2" />
      </Added>
    ),
    'fol.ntd.pro:ex:3': (
      <Added label="The finished derivation, checked">
        <ExampleCheck id="pro-3" />
      </Added>
    ),
  };
}
