import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { RosserRace } from '../../../workbench/provability/RosserRace';

export function useAnnotations(): Annotations {
  return {
    'inc.inp.ros:proof:1': (
      <Added label="The two cases, as a race">
        <RosserRace />
      </Added>
    ),
  };
}
