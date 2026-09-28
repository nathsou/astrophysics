import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';

const note = (
  <Added label="Added for this edition: details of the decision procedure">
    <p>
      The <Tex tex="(n+1)" />-st element of <Tex tex="\Gamma" /> has <Tex tex="n + 1" /> copies of <Tex tex="A_n" />, so a sentence made of k copies of B is in{' '}
      <Tex tex="\Gamma" /> iff <Tex tex="B \equiv A_{k-1}" />. A sentence can also be read as a single copy of itself — which matters when some{' '}
      <Tex tex="A_0" /> is itself of the form <Tex tex="B \land B" /> — so the test tries both readings: <Tex tex="A \equiv A_0" />, or{' '}
      <Tex tex="A" /> is k ≥ 2 copies of its left conjunct B and <Tex tex="B \equiv A_{k-1}" />. Explore mode carries this out on formulas.
    </p>
  </Added>
);

export function useAnnotations(): Annotations {
  return { 'inc.cpi.int:proof:2': note };
}
