import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added, Prov } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { BOOK_DEFS, app, churchNumeral, minimization, parseLambda } from '../../../engine/lambda/lambda';
import { Outcome } from '../../../workbench/lambda/ChurchPanels';

export function useAnnotations(): Annotations {
  const corrected = useMemo(() => app(minimization(parseLambda('Sub'), 1), churchNumeral(2)), []);
  const printed = useMemo(
    () =>
      parseLambda('Y SearchAsPrinted Sub 2 0', {
        defs: { ...BOOK_DEFS, SearchAsPrinted: { src: 'λg f x y. IsZero (f x y) y (g x (Succ y))', label: 'Search' } },
      }),
    [],
  );
  return {
    'lam:ldf:min:lem:min': (
      <Added label="A correction, added for this edition">
        <p className="sans small">
          <Prov kind="added" /> The recursive call in <Tex tex="\mathrm{Search}" /> should read <Tex tex="g\,f\,\vec x\,(\mathrm{Succ}\,y)" />: <i>g</i> stands for <Tex tex="Y\,\mathrm{Search}" />, whose first argument is <i>f</i>. As printed, <Tex tex="g\,\vec x\,(\mathrm{Succ}\,y)" /> passes <Tex tex="\vec x" /> in place of <i>f</i>. Computed for <Tex tex="f(x, y) = x \mathbin{\dot-} y" /> (so <Tex tex="\mu y\,[f(2, y) = 0] = 2" />) and <Tex tex="x = 2" />:
        </p>
        <dl className="lam-kv">
          <dt>corrected</dt>
          <dd>
            <Outcome term={corrected} expect={2} fuel={20_000} />
          </dd>
          <dt>as printed</dt>
          <dd>
            <Outcome term={printed} expect={2} fuel={1500} />
          </dd>
        </dl>
      </Added>
    ),
  };
}
