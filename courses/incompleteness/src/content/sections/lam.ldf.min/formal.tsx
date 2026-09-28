import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { app, churchNumeral, minimization, parseLambda } from '../../../engine/lambda/lambda';
import { Outcome } from '../../../workbench/lambda/ChurchPanels';

export function useAnnotations(): Annotations {
  const h2 = useMemo(() => app(minimization(parseLambda('Sub'), 1), churchNumeral(2)), []);
  return {
    'lam:ldf:min:lem:min': (
      <Added label="Computed by normal order">
        <p className="sans small">
          For <Tex tex="f(x, y) = x \mathbin{\dot-} y" />, λ-defined by <Tex tex="\mathrm{Sub}" />, <Tex tex="h(2) = \mu y\,[f(2, y) = 0] = 2" />:
        </p>
        <dl className="lam-kv">
          <dt>
            <Tex tex="H\,\overline 2" />
          </dt>
          <dd>
            <Outcome term={h2} expect={2} fuel={20_000} />
          </dd>
        </dl>
      </Added>
    ),
  };
}
