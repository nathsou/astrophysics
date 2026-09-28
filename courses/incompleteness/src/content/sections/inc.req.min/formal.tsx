import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { LessLab } from './LessLab';

export function useAnnotations(): Annotations {
  return {
    'inc.req.min:proof:3': (
      <Added label="Checked for a chosen n">
        <LessLab only="nsucc" />
      </Added>
    ),
    'inc.req.min:proof:4': (
      <Added label="Checked for a chosen m">
        <LessLab only="tri" />
      </Added>
    ),
    'inc.req.min:proof:5': (
      <Added label="Both clauses, checked for a chosen input">
        <LessLab only="min" />
      </Added>
    ),
  };
}
