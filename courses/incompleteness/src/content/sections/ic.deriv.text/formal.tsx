import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { ArithDerivations } from '../../../workbench/nd/ArithDerivations';
import { MoreDerivations } from './MoreDerivations';

export function useAnnotations(): Annotations {
  return {
    'ic.deriv.text:proof:1': (
      <Added label="Checked instances">
        <ArithDerivations initial="add" />
      </Added>
    ),
    'ic.deriv.text:proof:2': (
      <Added label="The complete derivation, checked">
        <ArithDerivations initial="less" />
      </Added>
    ),
    'ic.deriv.text:proof:3': (
      <>
        <Added label="The first half, checked for a chosen n">
          <ArithDerivations initial="rosser" />
        </Added>
        <Added label="The second half, checked for a chosen m">
          <MoreDerivations only="rosser2" />
        </Added>
      </>
    ),
  };
}
