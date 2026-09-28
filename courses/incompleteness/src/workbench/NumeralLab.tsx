// num(n) = #n̄#, by primitive recursion (Proposition "num is primitive recursive").

import { useMemo, useState } from 'react';
import * as A from '../engine/syntax/ast';
import { godel } from '../engine/coding/godel';
import { symbolCode } from '../engine/syntax/language';
import { formatMagnitude, lit, magnitude } from '../engine/numbers/nat';
import { Stepper } from '../ui/Stepper';
import { Tex } from '../ui/Tex';
import { Prov } from '../ui/Prov';
import { Panel } from './coding';

const S = symbolCode({ k: 'fn', arity: 1, index: 0 });
const O = symbolCode({ k: 'logical', name: '(' });
const C = symbolCode({ k: 'logical', name: ')' });
const Z = symbolCode({ k: 'const', index: 0 });

export function NumeralLab() {
  const [n, setN] = useState(3);
  const [step, setStep] = useState(0);
  const steps = useMemo(() => {
    const out: { k: number; codes: string[] }[] = [];
    let codes: string[] = [String(Z)];
    out.push({ k: 0, codes });
    for (let k = 1; k <= n; k++) {
      codes = [String(S), String(O), ...codes, String(C)];
      out.push({ k, codes });
    }
    return out;
  }, [n]);
  const s = Math.min(step, steps.length - 1);
  const cur = steps[s];
  const term = A.numeral(lit(BigInt(cur.k)));
  const size = formatMagnitude(magnitude(godel(term).number));
  return (
    <Panel n="★" title={<>Computing num(n) by primitive recursion</>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="\mathrm{num}(0) = \#0\#,\qquad \mathrm{num}(n+1) = \#{}'(\# \frown \mathrm{num}(n) \frown \#)\#" />
      </p>
      <label className="args-input sans">
        n ={' '}
        <input
          type="number"
          min={0}
          max={12}
          value={n}
          onChange={(e) => {
            setN(Math.max(0, Math.min(12, Number(e.target.value) || 0)));
            setStep(0);
          }}
        />
      </label>
      <Stepper
        step={s}
        count={steps.length}
        onStep={setStep}
        label="recursion"
        describe={(i) =>
          i === 0 ? (
            <>num(0) is the Gödel number of the one-symbol term 0, that is ⟨{String(Z)}⟩.</>
          ) : (
            <>
              num({i}) wraps num({i - 1}) in <Tex tex="{}'(" /> … <Tex tex=")" />: prepend the codes {String(S)}, {String(O)} and append {String(C)} (in bold).
            </>
          )
        }
      />
      <div className="num-codes">
        <Tex tex={`\\mathrm{num}(${cur.k}) = \\langle ${cur.codes.map((c, i) => (cur.k > 0 && (i < 2 || i === cur.codes.length - 1) ? `\\mathbf{${c}}` : c)).join(', ')} \\rangle`} />
        <span className="nat-size">
          the numeral <Tex tex={`\\overline{${cur.k}}`} /> has {3 * cur.k + 1} symbol{cur.k === 0 ? '' : 's'}; its Gödel number has {size}
        </span>
      </div>
    </Panel>
  );
}
