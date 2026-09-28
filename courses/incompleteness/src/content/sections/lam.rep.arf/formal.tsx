import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added, Prov } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { parseLambda } from '../../../engine/lambda/lambda';
import { Outcome } from '../../../workbench/lambda/ChurchPanels';
import { Trace } from '../../../workbench/lambda/Fixpoint';

export function useAnnotations(): Annotations {
  const succ0 = useMemo(() => parseLambda('(λa f x. f (a f x)) (λf x. x)'), []);
  const printed = useMemo(() => parseLambda('(λa b. a (Add a) 0) 2 3'), []);
  const corrected = useMemo(() => parseLambda('(λa b. a (Add b) 0) 2 3'), []);
  return {
    'lam.rep.arf:ex:1': (
      <Added label="Computed: the same reduction by normal order">
        <Trace start={succ0} steps={3} opts={{}} />
      </Added>
    ),
    'lam.rep.arf:prob:2': (
      <Added label="A correction, added for this edition">
        <p className="sans small">
          <Prov kind="added" /> As printed, <Tex tex="\mathrm{Mult}' \equiv \lambda ab.\,a(\mathrm{Add}\,a)\overline 0" /> adds <i>a</i> to <Tex tex="\overline 0" />, <i>a</i> times: it computes <Tex tex="a \cdot a" />, whatever <i>b</i> is. The intended term is <Tex tex="\lambda ab.\,a(\mathrm{Add}\,b)\overline 0" />. Computed by normal order:
        </p>
        <dl className="lam-kv">
          <dt>
            <Tex tex="(\lambda ab.\,a(\mathrm{Add}\,a)\overline 0)\,\overline 2\,\overline 3" />
          </dt>
          <dd>
            <Outcome term={printed} expect={6} />
          </dd>
          <dt>
            <Tex tex="(\lambda ab.\,a(\mathrm{Add}\,b)\overline 0)\,\overline 2\,\overline 3" />
          </dt>
          <dd>
            <Outcome term={corrected} expect={6} />
          </dd>
        </dl>
      </Added>
    ),
  };
}
