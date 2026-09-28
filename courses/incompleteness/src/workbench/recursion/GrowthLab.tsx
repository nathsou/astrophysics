// Computable functions that outgrow the primitive recursive ones (section "Non-Primitive
// Recursive Functions"): the hierarchy g₀(x) = x + 1, g_{n+1}(x) = g_nˣ(x), its diagonal
// G(x) = g_x(x), each g_n as a primitive recursive definition, and the Ackermann–Péter function
// by rewriting. Everything is run with a budget; running out says nothing about the value
// except that it takes more steps than that.

import { useMemo, useState } from 'react';
import { ackermann, gHierarchy } from '../../engine/computability/ackermann';
import { gLevel } from '../../engine/computability/primrec';
import { evaluate } from '../../engine/recursive/rf';
import { Panel } from '../coding';
import { Stepper } from '../../ui/Stepper';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { DefTree, fmtBig, FuelControl, NumField } from './common';

const N = 4;
const X = 6;

export function GrowthLab() {
  const [fuel, setFuel] = useState(100_000);
  const [sel, setSel] = useState<{ n: number; x: number }>({ n: 2, x: 3 });
  const table = useMemo(
    () => Array.from({ length: N + 1 }, (_, n) => Array.from({ length: X + 1 }, (_, x) => gHierarchy(n, x, { fuel, maxTrace: 0 }))),
    [fuel],
  );
  const cell = useMemo(() => gHierarchy(sel.n, sel.x, { fuel, maxTrace: 300 }), [sel, fuel]);
  return (
    <div className="workbench">
      <Panel n={1} title={<>The hierarchy <Tex tex="g_0(x) = x + 1,\ g_{n+1}(x) = g_n^x(x)" /></>} prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Each entry is computed by unfolding the definition down to <Tex tex="g_0" />, counting one step per application of some <Tex tex="g_k" />. The diagonal entries are{' '}
          <Tex tex="G(x) = g_x(x)" />, essentially the Ackermann–Péter function. Choose an entry to see its computation.
        </p>
        <FuelControl value={fuel} onChange={setFuel} options={[10_000, 100_000, 500_000]} />
        <div className="rc-scroll">
          <table className="rc-table rc-growth" aria-label="Values of g_n(x)">
            <thead>
              <tr>
                <th scope="col">
                  <Tex tex="n \backslash x" />
                </th>
                {Array.from({ length: X + 1 }, (_, x) => (
                  <th key={x} scope="col" className="num">
                    {x}
                  </th>
                ))}
                <th scope="col">closed form</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, n) => (
                <tr key={n}>
                  <th scope="row">
                    <Tex tex={`g_{${n}}`} />
                  </th>
                  {row.map((r, x) => (
                    <td key={x} className={`num ${n === x ? 'diag' : ''} ${r.status !== 'ok' ? 'big' : ''}`}>
                      <button className="rc-rowbtn" aria-pressed={sel.n === n && sel.x === x} onClick={() => setSel({ n, x })} aria-label={`g_${n}(${x})`}>
                        {r.status === 'ok' ? fmtBig(r.value, 10) : '?'}
                      </button>
                    </td>
                  ))}
                  <td className="small sans muted">{['x + 1', '2x', '2ˣ · x', 'about a tower of x 2’s', 'grows faster still'][n]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small sans muted">? = no answer within {fuel.toLocaleString('en-US')} steps. Highlighted: the diagonal <Tex tex="G(x)" />.</p>
        <p className="wb-note">
          For instance <Tex tex="g_3(3) = g_2(g_2(g_2(3))) = g_2(g_2(24)) = g_2(402{,}653{,}184) = 2^{402653184}\cdot 402653184" />, a number with about 121 million digits (using
          the closed form <Tex tex="g_2(x) = 2^x \cdot x" /> from the text); computing it by unfolding would take more than <Tex tex="10^{8}" /> steps.
        </p>
      </Panel>
      <Panel n={2} title={<>Unfolding <Tex tex={`g_{${sel.n}}(${sel.x})`} /></>} prov={<Prov kind="computed" />}>
        <p className="wb-result" aria-live="polite">
          {cell.status === 'ok' ? (
            <>
              <Tex tex={`g_{${sel.n}}(${sel.x}) = ${fmtBig(cell.value, 30)}`} /> <span className="small muted sans">in {cell.steps.toLocaleString('en-US')} steps</span>
            </>
          ) : (
            <span className="rc-unknown">No answer within {fuel.toLocaleString('en-US')} steps. The value exists (each g_n is total); it just takes longer to reach by unfolding.</span>
          )}
        </p>
        <div className="rc-calls" role="list" aria-label="The first steps">
          {cell.trace.map((t, i) => (
            <div key={i} role="listitem" style={{ paddingLeft: Math.min(t.depth, 12) * 14 }} className="rc-line">
              <span className="rc-mono">{t.note}</span>
              {t.value !== undefined && <span className="rc-hint">= {fmtBig(t.value, 16)}</span>}
            </div>
          ))}
          {cell.traceTruncated && <p className="rc-hint">… the first {cell.trace.length} of {cell.steps.toLocaleString('en-US')} steps are shown.</p>}
        </div>
      </Panel>
      {sel.n <= 3 && <GnIsPr n={sel.n} />}
      <AckermannPanel />
    </div>
  );
}

function GnIsPr({ n }: { n: number }) {
  const g = useMemo(() => gLevel(n), [n]);
  const vals = useMemo(
    () =>
      Array.from({ length: n === 3 ? 3 : 5 }, (_, x) => {
        const r = evaluate(g, [BigInt(x)], { fuel: 300_000, maxTraceDepth: -1 });
        return r.status === 'ok' ? r.value : undefined;
      }),
    [g, n],
  );
  return (
    <Panel n={3} title={<>Each <Tex tex="g_n" /> is primitive recursive: <Tex tex={`g_{${n}}`} /></>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="g_{n+1}(x) = \mathit{it}_n(x, x)" /> where <Tex tex="\mathit{it}_n(x, 0) = x" /> and <Tex tex="\mathit{it}_n(x, y+1) = g_n(\mathit{it}_n(x, y))" />: one more
        primitive recursion for each level. Evaluated by this definition: {vals.map((v, x) => (
          <span key={x}>
            <Tex tex={`g_{${n}}(${x}) = ${v ?? '?'}`} />
            {x < vals.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </p>
      <DefTree f={g} openNames={1} />
      <p className="wb-note">
        So every <Tex tex="g_n" /> is primitive recursive, but each needs more nested recursions than the one before. <Tex tex="G(x) = g_x(x)" /> would need all of them at once —
        and it eventually exceeds every primitive recursive function, so it is not one.
      </p>
      <NotAProof>The definitions for n ≤ 3 are built and checked against the table; that G outgrows every primitive recursive function is a theorem mentioned, not proved, in the text.</NotAProof>
    </Panel>
  );
}

function AckermannPanel() {
  const [m, setM] = useState('2');
  const [n, setN] = useState('2');
  const mv = /^\d+$/.test(m) && Number(m) <= 4 ? Number(m) : null;
  const nv = /^\d+$/.test(n) && Number(n) <= 20 ? Number(n) : null;
  const r = useMemo(() => (mv !== null && nv !== null ? ackermann(mv, nv, { fuel: 200_000, maxTrace: 400 }) : null), [mv, nv]);
  const [step, setStep] = useState(0);
  const s = r ? Math.min(step, r.trace.length - 1) : 0;
  return (
    <Panel n={4} title="The Ackermann–Péter function, by rewriting" prov={<Prov kind="computed" />}>
      <div className="rc-eqs">
        <Tex display tex="\begin{aligned} A(0, n) &= n + 1 \\ A(m+1, 0) &= A(m, 1) \\ A(m+1, n+1) &= A(m, A(m+1, n)) \end{aligned}" />
      </div>
      <div className="rc-row">
        <NumField id="ack-m" label="m =" value={m} onChange={(v) => { setM(v); setStep(0); }} width={50} hint="at most 4" />
        <NumField id="ack-n" label="n =" value={n} onChange={(v) => { setN(v); setStep(0); }} width={50} hint="at most 20" />
        {(mv === null || nv === null) && <span className="rc-err">m ≤ 4, n ≤ 20</span>}
      </div>
      {r && (
        <>
          <p className="wb-result" aria-live="polite">
            {r.status === 'ok' ? (
              <>
                <Tex tex={`A(${mv}, ${nv}) = ${fmtBig(r.value, 30)}`} /> <span className="small muted sans">after {r.steps.toLocaleString('en-US')} rewriting steps</span>
              </>
            ) : (
              <span className="rc-unknown">No answer within 200,000 rewriting steps.</span>
            )}
          </p>
          {r.trace.length > 0 && (
            <Stepper
              step={s}
              count={r.trace.length}
              onStep={setStep}
              label="rewriting step"
              describe={(i) => (
                <>
                  <span className="rc-mono">{r.trace[i].expr.length > 160 ? `${r.trace[i].expr.slice(0, 160)}…` : r.trace[i].expr}</span> <span className="muted">by {r.trace[i].rule}</span>
                </>
              )}
            />
          )}
          {r.traceTruncated && <p className="rc-hint">Only the first {r.trace.length} steps are kept for stepping.</p>}
        </>
      )}
    </Panel>
  );
}
