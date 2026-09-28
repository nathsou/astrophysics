import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { app, combinator, variable } from '../../../engine/lambda/lambda';
import { Trace } from '../../../workbench/lambda/Fixpoint';

export function useAnnotations(): Annotations {
  const yg = useMemo(() => app(combinator('Y'), variable('g')), []);
  const opts = useMemo(() => ({ labels: true, known: [{ label: 'Y', term: combinator('Y') }, { label: 'U', term: combinator('U') }] }), []);
  return {
    'lam.ldf.fp:thm:1': (
      <Added label="Computed: the first four normal-order steps from Y g">
        <Trace start={yg} steps={4} opts={opts} />
      </Added>
    ),
  };
}
