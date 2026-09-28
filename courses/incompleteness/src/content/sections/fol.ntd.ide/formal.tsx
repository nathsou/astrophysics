import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ExampleCheck } from '../../../workbench/nd/ExampleCheck';

export function useAnnotations(): Annotations {
  return {
    'fol.ntd.ide:ex:1': (
      <Added label="An instance, checked (s := a, t := b)">
        <ExampleCheck id="ide-1" />
      </Added>
    ),
    'fol.ntd.ide:ex:2': (
      <Added label="The complete derivation, checked">
        <ExampleCheck id="ide-2" />
      </Added>
    ),
  };
}
