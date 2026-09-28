// Second-order satisfaction on small finite domains: the quantifiers ∀X, ∃X, ∀u, ∃u run through
// every relation or function on the domain, so the answers are exact — and the search is
// exponential, so the domains are tiny.

import { useMemo, useState } from 'react';
import {
  S, showSolValue, solAssignment, solAleph0Set, solAleph1Set, solCount, solCountSet, solEquinumerous, solFin, solIdentity, solIdentityImp, solInduction, solInf,
  solInfSet, solLeq, solNoLarger, solSatisfies, solSchroederBernstein, solSubset, solText, solTransitiveClosure, relVarName,
  type RelVar, type SolFormula, type SolTrace,
} from '../../engine/semantics/sol';
import { GENERIC, showElem, tuples, type Elem, type Structure } from '../../engine/semantics/structure';
import { Prov } from '../../ui/Prov';
import { useStore } from '../../ui/store';
import { Panel } from '../coding';
import { StructurePicker, StructureView, type PickerScope } from './StructurePicker';
import { TruthBadge } from './TraceTree';
import { labStore, resolve, type StructureChoice } from './model';
import './sem.css';

interface Preset {
  id: string;
  label: string;
  note: string;
  build(): SolFormula;
  obj?: string[];
  rel?: RelVar[];
  /** needs a structure interpreting R (2-place) / 0 and ′ */
  needs?: 'R' | 'arith';
}

const X1 = S.X(0, 1);
const Y1 = S.X(1, 1);
const X2 = S.X(0, 2);

const lemBody = S.all('x', S.or(S.rel(X1, S.v('x')), S.not(S.rel(X1, S.v('x')))));

export const SOL_PRESETS: Preset[] = [
  { id: 'lemA', label: '∀X ∀x (X(x) ∨ ¬X(x))', note: 'Every set either contains or fails to contain a given object: true in every structure.', build: () => S.allR(X1, lemBody) },
  { id: 'lemE', label: '∃X ∀x (X(x) ∨ ¬X(x))', note: 'Also true in every structure: any X will do.', build: () => S.exR(X1, lemBody) },
  { id: 'compl', label: '∀z (X(z) ↔ ¬Y(z)): X and Y are complements', note: 'No second-order quantifier, but the free relation variables X and Y get their values from the assignment.', build: () => S.all('z', S.iff(S.rel(X1, S.v('z')), S.not(S.rel(Y1, S.v('z'))))), rel: [X1, Y1] },

  { id: 'inf', label: 'Inf: the domain is infinite', note: 'An injective function u that is not surjective exists iff the domain is (Dedekind) infinite.', build: solInf },
  { id: 'fin', label: 'Fin ≡ ¬Inf: the domain is finite', note: 'The negation of Inf.', build: solFin },
  { id: 'count', label: 'Count: the domain is countable', note: 'Some z and u such that z, u(z), u(u(z)), … exhaust the domain: every u-closed set containing z is everything.', build: solCount },
  { id: 'id', label: '∀X (X(x) ↔ X(y)): identity without =', note: 'x and y are elements of the same subsets iff they are the same element.', build: solIdentity, obj: ['x', 'y'] },
  { id: 'idimp', label: '∀X (X(x) → X(y)): also identity', note: 'The book’s problem: → suffices, because X may be {x}.', build: solIdentityImp, obj: ['x', 'y'] },
  { id: 'tc', label: 'R*(X): X is the transitive closure of R', note: 'X is transitive, includes R, and is included in every transitive relation Y that includes R.', build: () => solTransitiveClosure(GENERIC.R(2), X2), rel: [X2], needs: 'R' },
  { id: 'sub', label: 'X ⊆ Y', note: '∀x (X(x) → Y(x)).', build: () => solSubset(X1, Y1), rel: [X1, Y1] },
  { id: 'le', label: 'X ≼ Y: X is no larger than Y', note: 'Some injective u maps X into Y.', build: () => solNoLarger(X1, Y1), rel: [X1, Y1] },
  { id: 'eqn', label: 'X ≈ Y: X and Y are equinumerous', note: 'Some injective u maps X onto Y.', build: () => solEquinumerous(X1, Y1), rel: [X1, Y1] },
  { id: 'sb', label: 'Schröder–Bernstein: ∀X ∀Y ((X ≼ Y ∧ Y ≼ X) → X ≈ Y)', note: 'A valid sentence; here it is checked on one small domain.', build: solSchroederBernstein },
  { id: 'infX', label: 'Inf(X): s(X) is infinite', note: 'u maps X injectively into X and misses some element of X — impossible for a finite X.', build: () => solInfSet(X1), rel: [X1] },
  { id: 'countX', label: 'Count(X): s(X) is countable', note: 'X contains z and is included in every u-closed set containing z, so X is z, u(z), u(u(z)), …', build: () => solCountSet(X1), rel: [X1] },
  { id: 'aleph0', label: 'Aleph₀(X) ≡ Inf(X) ∧ Count(X)', note: 's(X) is countably infinite — false for every set on a finite domain.', build: () => solAleph0Set(X1), rel: [X1] },
  { id: 'aleph1', label: 'Aleph₁(X): s(X) has size ℵ₁', note: 'X is infinite but not of size ℵ₀, and each subset is finite, of size ℵ₀ or as large as X (the quantifier is written Z here, since Inf and Count use Y). No finite set satisfies it.', build: () => solAleph1Set(X1), rel: [X1] },
  { id: 'ind', label: 'The induction axiom of PA²', note: 'Every set containing 0 and closed under successor is the whole domain.', build: solInduction, needs: 'arith' },
  { id: 'leq', label: 'A≤(x, y): x ≤ y in PA²†', note: 'Every set containing x and closed under successor contains y (bound variable renamed z).', build: solLeq, obj: ['x', 'y'], needs: 'arith' },
];

type RelValue = boolean[] | boolean[][];

export function SolLab({ id = 'sol', presets, initial = 'inf', structure = { kind: 'pure', n: 3 } as StructureChoice, scope = 'finite' }: { id?: string; presets?: string[]; initial?: string; structure?: StructureChoice; scope?: PickerScope }) {
  const list = presets ? SOL_PRESETS.filter((p) => presets.includes(p.id)) : SOL_PRESETS;
  const store = labStore(`${id}.sol`, { structure, formula: initial, assign: {} });
  const st = useStore(store);
  const choice = st?.structure ?? structure;
  const preset = list.find((p) => p.id === st?.formula) ?? list[0];
  const r = useMemo(() => resolve(choice), [choice]);
  const M = r.kind === 'finite' ? r.M : null;
  const F = useMemo(() => preset.build(), [preset]);
  const [obj, setObj] = useState<Record<string, number>>({ x: 0, y: 1 });
  const [rels, setRels] = useState<Record<string, RelValue>>({});
  const n = M?.domain.length ?? 0;
  const relVal = (X: RelVar): RelValue => {
    const v = rels[`${X.arity}/${X.index}`];
    const ok = v && v.length === n && (X.arity === 1 ? typeof v[0] === 'boolean' || n === 0 : Array.isArray(v[0]));
    if (ok) return v;
    if (X.arity === 1) return Array.from({ length: n }, (_, i) => i === 0);
    // two-place (the transitive closure preset): start from the empty relation
    return Array.from({ length: n }, () => Array.from({ length: n }, () => false));
  };
  const s = useMemo(() => {
    if (!M) return null;
    return solAssignment({
      obj: Object.fromEntries((preset.obj ?? []).map((v) => [v, M.domain[Math.min(obj[v] ?? 0, n - 1)]])),
      rel: (preset.rel ?? []).map((X) => {
        const v = relVal(X);
        const ts: Elem[][] = X.arity === 1 ? M.domain.filter((_, i) => (v as boolean[])[i]).map((e) => [e]) : tuples(M.domain, 2).filter(([a, b]) => (v as boolean[][])[M.domain.indexOf(a)][M.domain.indexOf(b)]);
        return { X, tuples: ts };
      }),
    });
  }, [M, preset, obj, rels, n]);
  const trace = useMemo(() => (M && s ? solSatisfies(M, s, F, { maxSteps: 1_500_000, maxCandidates: 20_000 }) : null), [M, s, F]);
  const setPreset = (pid: string) => store.set({ ...st, formula: pid });

  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="A second-order formula" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor={`${id}-sol-preset`}>
          Formula
        </label>
        <select id={`${id}-sol-preset`} className="fi-examples sem-select" value={preset.id} onChange={(e) => setPreset(e.target.value)}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="sem-sol-text">{solText(F)}</p>
        <p className="wb-note">{preset.note}</p>
      </Panel>
      <Panel n={2} title="A small structure" prov={<Prov kind="computed" />}>
        <StructurePicker value={choice} onChange={(c) => store.set({ ...st, structure: c })} scope={scope} />
        <StructureView r={r} compact />
        {preset.needs === 'R' && M && !M.relations.has('2/12') && <p className="wb-note danger">This formula uses the 2-place predicate R: choose “Your own finite structure” and tick R.</p>}
        {preset.needs === 'arith' && M && !(M.constants.has(0) && M.functions.has('1/0')) && <p className="wb-note danger">This formula uses 0 and ′: choose a structure that interprets them.</p>}
        {M && (preset.obj?.length || preset.rel?.length) ? (
          <div className="sem-assign">
            <span className="fi-label">The assignment s</span>
            <div className="sem-assign-row">
              {(preset.obj ?? []).map((v) => (
                <label key={v} className="sem-inline">
                  s({v}) =
                  <select value={Math.min(obj[v] ?? 0, n - 1)} onChange={(e) => setObj({ ...obj, [v]: Number(e.target.value) })}>
                    {M.domain.map((d, i) => (
                      <option key={i} value={i}>
                        {showElem(d)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {(preset.rel ?? []).map((X) => (
                <RelEditor key={`${X.arity}/${X.index}`} X={X} M={M} value={relVal(X)} onChange={(v) => setRels({ ...rels, [`${X.arity}/${X.index}`]: v })} />
              ))}
            </div>
          </div>
        ) : null}
      </Panel>
      {trace && <SolResult trace={trace} M={M!} />}
    </div>
  );
}

function RelEditor({ X, M, value, onChange }: { X: RelVar; M: Structure; value: RelValue; onChange: (v: RelValue) => void }) {
  const name = relVarName(X);
  if (X.arity === 1)
    return (
      <fieldset className="sem-editor">
        <legend className="sem-k">s({name}) ⊆ |M|</legend>
        <div className="sem-symbols">
          {M.domain.map((d, i) => (
            <label key={i} className="sem-check">
              <input type="checkbox" checked={(value as boolean[])[i]} onChange={(e) => onChange((value as boolean[]).map((b, j) => (j === i ? e.target.checked : b)))} />
              {showElem(d)}
            </label>
          ))}
        </div>
      </fieldset>
    );
  const v = value as boolean[][];
  return (
    <fieldset className="sem-editor">
      <legend className="sem-k">s({name}) ⊆ |M|²</legend>
      <div className="sem-scroll">
        <table className="sem-table">
          <thead>
            <tr>
              <th scope="col">x \ y</th>
              {M.domain.map((d, i) => (
                <th key={i} scope="col">
                  {showElem(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {M.domain.map((a, i) => (
              <tr key={i}>
                <th scope="row">{showElem(a)}</th>
                {M.domain.map((b, j) => (
                  <td key={j}>
                    <input type="checkbox" aria-label={`⟨${showElem(a)}, ${showElem(b)}⟩ ∈ ${name}`} checked={v[i][j]} onChange={(e) => onChange(v.map((row, k) => row.map((x, l) => (k === i && l === j ? e.target.checked : x))))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

function SolResult({ trace, M }: { trace: SolTrace; M: Structure }) {
  const q = trace.quantifier;
  return (
    <Panel n={3} title={<>Is {M.name}, s ⊨ A?</>} prov={<Prov kind="computed" />}>
      <div className="sem-result" aria-live="polite">
        <TruthBadge t={trace.truth} />
        <span>
          {trace.truth === 'unknown' ? (
            <>
              <b>Not evaluated.</b> {trace.reason}. Choose a smaller domain.
            </>
          ) : (
            <>
              <b>{trace.truth ? 'Satisfied.' : 'Not satisfied.'}</b> {q ? trace.detail : `${trace.clause} — ${trace.detail}`}
            </>
          )}
        </span>
      </div>
      {q && (
        <p className="wb-note">
          The outermost quantifier ranges over {q.total} value{q.total === 1 ? '' : 's'}; {q.tried} {q.tried === 1 ? 'was' : 'were'} tried
          {q.witness || q.counterexample ? ' before the answer was settled' : ''}.
        </p>
      )}
      <div className="sem-trace">
        <SolRow t={trace} depth={0} />
      </div>
    </Panel>
  );
}

function SolRow({ t, depth }: { t: SolTrace; depth: number }) {
  const [open, setOpen] = useState(depth < 3);
  const q = t.quantifier;
  const v = q?.witness ?? q?.counterexample;
  return (
    <div className={`sem-row depth-${Math.min(depth, 6)}`}>
      <div className="sem-row-head">
        {t.children.length > 0 ? (
          <button className="sem-twisty" aria-expanded={open} aria-label={open ? 'collapse' : 'expand'} onClick={() => setOpen((x) => !x)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="sem-twisty-sp" />
        )}
        <TruthBadge t={t.truth} />
        <span className="sem-ftext">{t.text}</span>
      </div>
      <div className="sem-row-why">
        <span className="sem-clause">{t.clause}</span>
        {!(q && v) && <span className="sem-detail">{t.detail}</span>}
        {q && v && (
          <span className="sem-detail">
            {q.witness ? 'witness' : 'counterexample'}: {q.variable} = <span className="sem-value">{showSolValue(v)}</span> (after {q.tried} of {q.total})
          </span>
        )}
      </div>
      {open && t.children.length > 0 && (
        <div className="sem-kids">
          {t.children.map((c, i) => (
            <SolRow key={i} t={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

