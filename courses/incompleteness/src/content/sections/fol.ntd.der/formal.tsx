import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ExampleCheck } from '../../../workbench/nd/ExampleCheck';

export function useAnnotations(): Annotations {
  return {
    'fol.ntd.der:ex:1': (
      <Added label="The example’s derivations, checked">
        <ExampleCheck id="der-andI" />
        <ExampleCheck id="der-C-imp" />
        <ExampleCheck id="der-D-imp" />
        <ExampleCheck id="der-vacuous" />
      </Added>
    ),
  };
}
