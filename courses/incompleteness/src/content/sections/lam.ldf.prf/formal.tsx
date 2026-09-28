import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { parseLambda, primitiveRecursion } from '../../../engine/lambda/lambda';
import { ValuesTable } from '../../../workbench/lambda/ChurchPanels';

export function useAnnotations(): Annotations {
  const h = useMemo(() => primitiveRecursion(parseLambda('λx. x'), parseLambda('λx y z. Succ z')), []);
  return {
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
