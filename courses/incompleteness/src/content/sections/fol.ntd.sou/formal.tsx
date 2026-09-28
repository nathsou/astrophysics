import type { Annotations } from '../../../formal/FormalText';
import { Added, NotAProof } from '../../../ui/Prov';

export function useAnnotations(): Annotations {
  return {
    'fol:ntd:sou:thm:soundness': (
      <Added label="In Explore mode">
        <p>
          The soundness lab evaluates, in finite structures, the claim this theorem makes about every step of a derivation: if the step’s undischarged assumptions are true, so is its sentence. It finds
          the failing step of an incorrect derivation, and none in a correct one.
        </p>
        <NotAProof>Finitely many finite structures illustrate the theorem; the proof below establishes it.</NotAProof>
      </Added>
    ),
  };
}
