import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { bStore, useParsedFormula } from '../../../content/objects';
import { useFixedPoint, FixedPointDerivation } from '../../../workbench/FixedPointLab';
import { Added, Prov } from '../../../ui/Prov';
import { FormulaView } from '../../../ui/FormulaView';
import { Tex } from '../../../ui/Tex';
import { formatMagnitude, magnitude } from '../../../engine/numbers/nat';

export function useAnnotations(): Annotations {
  const [, , parsed] = useParsedFormula(bStore);
  const c = useFixedPoint(parsed.ok ? parsed.value : null);
  return useMemo(() => {
    if (!c || 'error' in c) return {};
    return {
      'inc:inp:fix:lem:fixed-point': (
        <Added label="Computed, for your B(x)">
          <div className="ann-title sans">
            <b>The construction for your B(x)</b> <Prov kind="computed" />
          </div>
          <p>
            <Tex tex="B(x):" /> <FormulaView node={c.B} />
          </p>
          <p>
            <Tex tex="E(x):" /> <FormulaView node={c.E} />
          </p>
          <p>
            <Tex tex="A = E(\ulcorner E(x)\urcorner):" /> <FormulaView node={c.fixed} />
          </p>
          <p className="sans small muted">
            <Tex tex="\#E(x)\#" /> has at least {formatMagnitude(magnitude(c.encE.number, { lowerBound: true }))}; <Tex tex="\mathrm{diag}(\#E(x)\#) = \#A\#" /> —{' '}
            {c.diagCheck.agrees === 'equal' ? 'verified by decoding and re-encoding.' : c.diagCheck.agrees}
          </p>
        </Added>
      ),
      'inc.inp.fix:proof:1': (
        <Added label="Checked, for your B(x)">
          <FixedPointDerivation c={c} />
        </Added>
      ),
    };
  }, [c]);
}
