import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';

const note = (
  <Added label="Added for this edition: a note on the text">
    <p>
      In this proof <Tex tex="A" /> is the domain of <Tex tex="\varphi_d" /> and <Tex tex="\overline A" /> the domain of <Tex tex="\varphi_e" />, so the test for membership
      in <Tex tex="A" /> is <Tex tex="T(d, x, h(x))" /> — “<Tex tex="\varphi_d" /> is the one that is defined”. The text writes <Tex tex="e" /> there (and{' '}
      <Tex tex="\varphi_e, \varphi_f" /> in the explanation that follows); the argument is unaffected.
    </p>
  </Added>
);

export function useAnnotations(): Annotations {
  return { 'cmp.thy.cmp:proof:1': note };
}
