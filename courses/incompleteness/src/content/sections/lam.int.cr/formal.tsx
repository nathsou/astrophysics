import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { parseLambda } from '../../../engine/lambda/lambda';
import { GraphView } from '../../../workbench/lambda/GraphView';

export function useAnnotations(): Annotations {
  const term = useMemo(() => parseLambda('(λx.(λy.y x) z) v'), []);
  return {
    'lam:int:cr:thm:church-rosser': (
      <Added label="Computed: the book’s example from the previous section">
        <div className="ann-title sans">
          <b>The reduction graph of (λx.(λy.yx)z)v</b>
        </div>
        <GraphView term={term} />
      </Added>
    ),
  };
}
