// Models of Q: which of Q1–Q8 a structure satisfies, with traces, and why no finite structure
// satisfies both Q1 and Q2 (following the successors of 0 until one repeats).

import { useMemo, useState } from 'react';
import { checkQ, finiteQ1Q2Failure, qSentences } from '../../engine/semantics/arithmetic';
import { satisfiesSearch } from '../../engine/semantics/infinite';
import { showElem, type Elem } from '../../engine/semantics/structure';
import type { FormulaTrace, Truth } from '../../engine/semantics/trace';
import { FormulaView, useAnalysis } from '../../ui/FormulaView';
import { NotAProof, Prov } from '../../ui/Prov';
import { useStore } from '../../ui/store';
import { Panel } from '../coding';
import { StructurePicker, StructureView } from './StructurePicker';
import { TraceTree, TruthBadge } from './TraceTree';
import { labStore, resolve, showAny, type AnyElem, type StructureChoice } from './model';
import './sem.css';

interface Row {
  name: string;
  gloss: string;
  formula: ReturnType<typeof qSentences>[number]['formula'];
  truth: Truth;
  trace: FormulaTrace<AnyElem>;
}

export function QExplorer({ id = 'q', structure = { kind: 'mod', n: 5, mode: 'wrap' } as StructureChoice, finiteArgument = true }: { id?: string; structure?: StructureChoice; finiteArgument?: boolean }) {
  const store = labStore(`${id}.q`, { structure, formula: '', assign: {} });
  const st = useStore(store);
  const choice = st?.structure ?? structure;
  const r = useMemo(() => resolve(choice), [choice]);
  const [limit, setLimit] = useState(25);
  const rows: Row[] = useMemo(() => {
    const qs = qSentences();
    if (r.kind === 'finite') {
      const res = checkQ(r.M);
      return res.results.map((x, i) => ({ name: x.name, gloss: qs[i].gloss, formula: x.formula, truth: x.truth, trace: x.trace as FormulaTrace<AnyElem> }));
    }
    if (r.kind === 'search') return qs.map((q) => {
      const trace = satisfiesSearch(r.S, new Map(), q.formula, { limit }) as FormulaTrace<AnyElem>;
      return { name: q.name, gloss: q.gloss, formula: q.formula, truth: trace.truth, trace };
    });
    return [];
  }, [r, limit]);
  const firstFalse = rows.findIndex((x) => x.truth === false);
  const [sel, setSel] = useState<number | null>(null);
  const cur = rows[sel ?? (firstFalse >= 0 ? firstFalse : 0)];
  const analysis = useAnalysis(cur?.formula);
  const show = (e: AnyElem) => showAny(r, e);
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="A structure for the language of arithmetic" prov={<Prov kind="computed" />}>
        <StructurePicker value={choice} onChange={(s) => store.set({ ...st, structure: s })} scope="arith" />
        <StructureView r={r} compact />
      </Panel>
      {rows.length > 0 && (
        <Panel n={2} title="The axioms of Q in this structure" prov={<Prov kind="computed" />}>
          <div className="sem-scroll">
            <table className="sem-qtable">
              <thead>
                <tr>
                  <th scope="col">axiom</th>
                  <th scope="col">sentence</th>
                  <th scope="col">in {r.kind === 'finite' ? r.M.name : r.kind === 'search' ? r.S.name : ''}</th>
                  <th scope="col">
                    <span className="sr-only">trace</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={x.name} className={cur === x ? 'active' : ''}>
                    <td className="sem-qname">{x.name}</td>
                    <td>
                      <span className="sem-ftext">{x.trace.text}</span>
                      <div className="small muted sans">{x.gloss}</div>
                    </td>
                    <td>
                      <TruthBadge t={x.truth} />
                    </td>
                    <td>
                      <button className="linklike" aria-pressed={cur === x} onClick={() => setSel(i)}>
                        trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="wb-note" aria-live="polite">
            {r.kind === 'finite' ? (
              firstFalse >= 0 ? (
                <>
                  <b>Not a model of Q:</b> {rows.filter((x) => x.truth === false).map((x) => x.name).join(', ')} {rows.filter((x) => x.truth === false).length === 1 ? 'is' : 'are'} false here.
                </>
              ) : (
                <b>All eight axioms are true here.</b>
              )
            ) : (
              <>
                The domain is infinite, so a universal axiom can only be refuted by a counterexample, never confirmed by search.{' '}
                {firstFalse >= 0 ? (
                  <>
                    <b>{rows[firstFalse].name} is refuted.</b>
                  </>
                ) : (
                  <>No counterexample was found among the first {limit} elements; for K and K′ the book shows that all axioms are in fact true (for L, the ones that do not use × or &lt;).</>
                )}{' '}
                <label className="sem-inline">
                  search the first
                  <input type="number" min={5} max={80} value={limit} onChange={(e) => setLimit(Math.max(5, Math.min(80, Number(e.target.value) || 25)))} />
                  elements
                </label>
              </>
            )}
          </p>
          {cur && (
            <>
              <div className="wb-formula">
                <b className="sans small">{cur.name}: </b>
                <FormulaView node={cur.formula} analysis={analysis ?? undefined} />
              </div>
              <TraceTree key={`${cur.name}|${JSON.stringify(choice)}|${limit}`} trace={cur.trace} show={show} analysis={analysis} />
            </>
          )}
        </Panel>
      )}
      {finiteArgument && r.kind === 'finite' && <FiniteArgument r={r} />}
    </div>
  );
}

function FiniteArgument({ r }: { r: Extract<ReturnType<typeof resolve>, { kind: 'finite' }> }) {
  const res = useMemo(() => finiteQ1Q2Failure(r.M), [r]);
  const body = useMemo(() => ('fail' in res ? null : res.witnessTrace.formula), [res]);
  const analysis = useAnalysis(body);
  if ('fail' in res)
    return (
      <Panel n={3} title="Why no finite structure satisfies Q1 and Q2" prov={<Prov kind="computed" />}>
        <p className="wb-note">{res.fail}. Pick a structure that interprets 0 and ′.</p>
      </Panel>
    );
  return (
    <Panel n={3} title="Why no finite structure satisfies both Q1 and Q2" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Follow 0, 0′, 0′′, … in {r.M.name}. The domain is finite, so some element must come round again. Where the chain first loops back decides which axiom fails:
      </p>
      <Orbit orbit={res.orbit} back={res.repeatsAt} />
      <p aria-live="polite">{res.argument}</p>
      <p className="wb-note">
        The counterexample of the argument, checked against the definition of satisfaction ({res.axiom}’s matrix under{' '}
        {res.axiom === 'Q2' ? `x ↦ ${showElem(res.elements.x)}` : `x ↦ ${showElem(res.elements.x)}, y ↦ ${showElem(res.elements.y as Elem)}`}):
      </p>
      <TraceTree trace={res.witnessTrace} show={showElem} analysis={analysis} />
      <NotAProof>
        This is one structure. That <em>every</em> finite structure fails Q1 or Q2 follows from the argument itself, which works for any finite domain: an injective function on a finite set is also surjective, so 0 would be a successor.
      </NotAProof>
    </Panel>
  );
}

/** The chain m0 → m1 → … → m(j−1), and the arrow back to m(i). */
export function Orbit({ orbit, back }: { orbit: Elem[]; back: number }) {
  const W = 64;
  const width = Math.max(200, orbit.length * W + 40);
  const cy = 34;
  const x = (i: number) => 30 + i * W;
  const last = orbit.length - 1;
  return (
    <div className="sem-orbit" role="img" aria-label={`The successors of 0: ${orbit.map(showElem).join(', ')}, and then back to ${showElem(orbit[back])}.`}>
      <svg width={width} height={96} viewBox={`0 0 ${width} 96`}>
        <defs>
          <marker id="sem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {orbit.slice(0, -1).map((_, i) => (
          <line key={i} className="edge" x1={x(i) + 15} y1={cy} x2={x(i + 1) - 16} y2={cy} markerEnd="url(#sem-arrow)" style={{ color: 'var(--ink-2)' }} />
        ))}
        <path
          className="edge back"
          d={back === last ? `M ${x(last) + 12} ${cy + 10} C ${x(last) + 40} ${cy + 50}, ${x(last) - 30} ${cy + 55}, ${x(last) - 8} ${cy + 14}` : `M ${x(last)} ${cy + 16} C ${x(last)} ${cy + 58}, ${x(back)} ${cy + 58}, ${x(back)} ${cy + 17}`}
          markerEnd="url(#sem-arrow)"
          style={{ color: 'var(--danger)' }}
        />
        {orbit.map((m, i) => (
          <g key={i} className={`node ${i === 0 ? 'zero' : ''} ${i === back ? 'hit' : ''}`}>
            <circle cx={x(i)} cy={cy} r={15} />
            <text x={x(i)} y={cy + 5} textAnchor="middle">
              {showElem(m)}
            </text>
            <text className="lbl" x={x(i)} y={12} textAnchor="middle">
              m{i}
            </text>
          </g>
        ))}
        <text className="lbl" x={(x(last) + x(back)) / 2} y={92} textAnchor="middle">
          ′ of m{last} is m{back}
        </text>
      </svg>
    </div>
  );
}
