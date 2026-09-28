// Structures, assignments and satisfaction: pick a structure, enter a formula, choose values
// for its free variables, and follow the recursive definition of satisfaction as a trace.

import { useMemo, useState } from 'react';
import { tryParseFormula } from '../../engine/syntax/parse';
import { freeVars } from '../../engine/syntax/ops';
import { varName } from '../../engine/syntax/language';
import { missingSymbols } from '../../engine/semantics/satisfaction';
import { decisivePath } from '../../engine/semantics/trace';
import { ABBREVIATIONS } from '../../content/objects';
import { FormulaInput } from '../../ui/FormulaInput';
import { FormulaView, useAnalysis } from '../../ui/FormulaView';
import { Prov } from '../../ui/Prov';
import { useStore } from '../../ui/store';
import { Panel } from '../coding';
import { StructurePicker, StructureView, type PickerScope } from './StructurePicker';
import { TraceTree, TruthBadge } from './TraceTree';
import { elementChoices, evaluateIn, labStore, resolve, showAny, type AnyElem, type LabState, type Resolved, type StructureChoice } from './model';
import './sem.css';

export interface SatisfactionLabProps {
  /** Identifies the lab's saved state (one per section). */
  id: string;
  structure?: StructureChoice;
  formula?: string;
  assign?: Record<string, string>;
  scope?: PickerScope;
  examples?: { label: string; value: string }[];
  /** Show the structure's tables (default true). */
  tables?: boolean;
}

const GENERAL_EXAMPLES = [
  { label: 'the book: ∃x (R(b, x) ∨ R(x, b))', value: '∃x (R(b, x) ∨ R(x, b))' },
  { label: 'the book: ∀x (R(a, x) → R(x, a))', value: '∀x (R(a, x) → R(x, a))' },
  { label: 'the book: ∀x (R(a, x) → ∃y R(x, y))', value: '∀x (R(a, x) → ∃y R(x, y))' },
  { label: 'the book: ∃x (R(a, x) ∧ ∀y R(x, y))', value: '∃x (R(a, x) ∧ ∀y R(x, y))' },
  { label: 'every element has a successor-predecessor: ∀x (x = 0 ∨ ∃y x = y′)', value: '∀x (x = 0 ∨ ∃y x = y′)' },
  { label: 'Q1: ∀x ∀y (x′ = y′ → x = y)', value: '∀x ∀y (x′ = y′ → x = y)' },
  { label: 'Q2: ∀x ¬0 = x′', value: '∀x ¬0 = x′' },
  { label: 'a square root of 4: ∃x (x × x) = 4', value: '∃x (x × x) = 4' },
  { label: 'x is even (free x): ∃y (y + y) = x', value: '∃y (y + y) = x' },
  { label: 'R is total: ∀x ∃y R(x, y)', value: '∀x ∃y R(x, y)' },
  { label: 'irreflexive: ∀x ¬x < x', value: '∀x ¬x < x' },
];

export function SatisfactionLab({ id, structure = { kind: 'preset', id: 'book-sat' }, formula = '∀x (R(a, x) → ∃y R(x, y))', assign = { x: '1' }, scope = 'all', examples = GENERAL_EXAMPLES, tables = true }: SatisfactionLabProps) {
  const store = labStore(id, { structure, formula, assign });
  const raw = useStore(store);
  const st: LabState = raw && raw.structure && typeof raw.formula === 'string' ? raw : { structure, formula, assign };
  const set = (p: Partial<LabState>) => store.set({ ...st, ...p });
  const r = useMemo(() => resolve(st.structure), [st.structure]);
  const parsed = useMemo(() => tryParseFormula(st.formula, { abbreviations: ABBREVIATIONS }), [st.formula]);
  const F = parsed.ok ? parsed.value : null;
  const analysis = useAnalysis(F);
  const [exhaustive, setExhaustive] = useState(false);
  const [limit, setLimit] = useState(40);
  const free = useMemo(() => (F ? [...freeVars(F)].sort((a, b) => a - b) : []), [F]);
  const res = useMemo(() => (F ? evaluateIn(r, F, st.assign ?? {}, { exhaustive, limit }) : null), [F, r, st.assign, exhaustive, limit]);
  const missing = useMemo(() => (F && r.kind === 'finite' ? missingSymbols(r.M, F) : []), [F, r]);
  const show = (e: AnyElem) => showAny(r, e);
  const trace = res?.trace ?? null;
  const path = useMemo(() => (trace ? decisivePath(trace) : null), [trace]);
  const choices = elementChoices(r);

  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="The structure" prov={<Prov kind="computed" />}>
        <StructurePicker value={st.structure} onChange={(structure) => set({ structure })} scope={scope} />
        {tables && <StructureView r={r} />}
      </Panel>

      <Panel n={2} title="The formula and the assignment" prov={<Prov kind="computed" />}>
        <FormulaInput value={st.formula} onChange={(formula) => set({ formula })} parsed={parsed} label="A" examples={examples} />
        {F && (
          <div className="wb-formula">
            <FormulaView node={F} analysis={analysis ?? undefined} />
          </div>
        )}
        {missing.length > 0 && (
          <p className="wb-note danger">
            This structure does not interpret {missing.join('; ')}. Pick a structure for the language of your formula, or define one.
          </p>
        )}
        {F && (
          <AssignmentEditor r={r} free={free} value={st.assign ?? {}} choices={choices} onChange={(a) => set({ assign: a })} />
        )}
      </Panel>

      {F && trace && (
        <Panel n={3} title={<>Is {r.kind === 'finite' ? r.M.name : r.kind === 'search' ? r.S.name : 'M'}, s ⊨ A?</>} prov={<Prov kind="computed" />}>
          <div className="sem-result" aria-live="polite">
            <TruthBadge t={trace.truth} />
            <span>
              {trace.truth === 'unknown' ? (
                <>
                  <b>Not settled.</b> {trace.reason}
                </>
              ) : (
                <>
                  <b>{trace.truth ? 'Satisfied.' : 'Not satisfied.'}</b> {trace.detail}
                </>
              )}
            </span>
          </div>
          {res && res.errors.length > 0 && <p className="wb-note danger">{res.errors.join('; ')}</p>}
          {path && path.bindings.length > 0 && (
            <p className="wb-note">
              {trace.truth === false ? 'The counterexample, read off the trace: ' : 'The witnesses, read off the trace: '}
              {path.bindings.map((b, i) => (
                <span key={i} className={`sem-binding ${b.role}`}>
                  {varName(b.variable)} = {show(b.element)} ({b.role})
                </span>
              ))}
            </p>
          )}
          <div className="sem-options">
            <label className="sem-check">
              <input type="checkbox" checked={exhaustive} onChange={(e) => setExhaustive(e.target.checked)} />
              try every x-variant (the letter of the definition), not just until a witness or counterexample is found
            </label>
            {r.kind === 'search' && (
              <label className="sem-inline">
                search the first
                <input type="number" min={5} max={200} value={limit} onChange={(e) => setLimit(Math.max(5, Math.min(200, Number(e.target.value) || 40)))} />
                elements
              </label>
            )}
          </div>
          <TraceTree key={`${st.formula}|${JSON.stringify(st.structure)}|${JSON.stringify(st.assign)}|${exhaustive}|${limit}`} trace={trace} show={show} analysis={analysis} />
          {r.kind === 'search' && (
            <p className="wb-note">
              On an infinite domain, “unknown” means the search found neither a witness nor a counterexample among the elements it tried — not that the formula is false (or true).
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

function AssignmentEditor({ r, free, value, choices, onChange }: { r: Resolved; free: number[]; value: Record<string, string>; choices: string[]; onChange: (a: Record<string, string>) => void }) {
  if (r.kind === 'error') return null;
  if (free.length === 0)
    return (
      <p className="wb-note">
        A is a <b>sentence</b>: whether it is satisfied does not depend on the assignment (the book’s Proposition on sentences), so any assignment gives the same answer.
      </p>
    );
  return (
    <div className="sem-assign">
      <span className="fi-label">The assignment s (only the free variables matter)</span>
      <div className="sem-assign-row">
        {free.map((i) => {
          const name = varName(i);
          const cur = value[name] ?? '';
          return (
            <label key={i} className="sem-inline">
              s({name}) =
              {r.kind === 'finite' ? (
                <select value={cur} onChange={(e) => onChange({ ...value, [name]: e.target.value })}>
                  <option value="">—</option>
                  {choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="sem-elem-input" value={cur} placeholder={choices.slice(0, 3).join(', ')} onChange={(e) => onChange({ ...value, [name]: e.target.value })} />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
