import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added, Prov } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { parseLambda, primitiveRecursion } from '../../../engine/lambda/lambda';
import { ValuesTable } from '../../../workbench/lambda/ChurchPanels';

export function useAnnotations(): Annotations {
  const h = useMemo(() => primitiveRecursion(parseLambda('λx. x'), parseLambda('λx y z. Succ z')), []);
  return {
    'lam:ldf:prf:lem:comp': (
      <Added label="Two slips in the statement, noted for this edition">
        <p className="sans small">
          <Prov kind="added" /> The terms are <Tex tex="G_0, \dots, G_{k-1}" /> (one for each <Tex tex="g_j" />), not <Tex tex="G_0, \dots, G_k" />, and the conclusion is that <Tex tex="h" /> is λ-definable (by the term <Tex tex="H" /> of the proof).
        </p>
      </Added>
    ),
    'lam.ldf.prf:proof:3': (
      <Added label="A correction, added for this edition">
        <p className="sans small">
          <Prov kind="added" /> In the recursion equations the right-hand side of the second should be <Tex tex="g(x_1, \dots, x_n, y, h(x_1, \dots, x_n, y))" />: the step function is <Tex tex="g" />, as the lemma says and as the term <Tex tex="D" /> (which applies <Tex tex="G" />) implements. As printed it reads <Tex tex="h(x_1, \dots, x_n, y, h(x_1, \dots, x_n, y))" />. Likewise, in the sentence after the equations it is <Tex tex="g" />, not <Tex tex="h" />, whose application is iterated <Tex tex="y" /> times. The rest of the proof uses <Tex tex="g(n, m, h(n, m)) = h(n, m+1)" />, the corrected equation.
        </p>
      </Added>
    ),
    'lam:ldf:prf:lem:prim': (
      <Added label="Computed: the construction for addition">
        <p className="sans small">
          With <Tex tex="F \equiv \lambda x.\,x" /> (so <Tex tex="h(x, 0) = x" />) and <Tex tex="G \equiv \lambda x y z.\,\mathrm{Succ}\,z" /> (so <Tex tex="h(x, y+1) = h(x, y) + 1" />), the term <i>H</i> of the proof, applied to numerals:
        </p>
        <ValuesTable f={h} rows={[[2, 0], [2, 1], [2, 3], [4, 4]]} expect={([x, y]) => x! + y!} />
      </Added>
    ),
  };
}
