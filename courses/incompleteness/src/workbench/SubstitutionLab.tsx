// Substitution A[t/u]: free and bound occurrences, capture, α-renaming, and Subst on Gödel numbers.

import { useMemo, useState } from 'react';
import { substStore, ABBREVIATIONS } from '../content/objects';
import { useStore, highlightStore, inspect } from '../ui/store';
import { tryParseFormula, tryParseTerm } from '../engine/syntax/parse';
import { substitute, freeFor, type SubstStep } from '../engine/syntax/subst';
import { analyze } from '../engine/syntax/analysis';
import { occurrences } from '../engine/syntax/ops';
import { varIndex, varName, symTex } from '../engine/syntax/language';
import { hSubst } from '../engine/coding/arith';
import { natEq } from '../engine/numbers/nat';
import { FormulaView } from '../ui/FormulaView';
import { FormulaInput } from '../ui/FormulaInput';
import { Stepper } from '../ui/Stepper';
import { Prov, NotAProof } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { Panel } from './coding';
import { Ref } from '../formal/FormalText';
import type { Formula, Term } from '../engine/syntax/ast';

const EXAMPLES = [
  { formula: '∃y x < y ∧ x = 2', variable: 'x', term: 'y′', label: 'capture: y′ under ∃y' },
  { formula: '∀x (x = 0 ∨ ∃y x = y′)', variable: 'x', term: '3', label: 'x is bound everywhere' },
  { formula: 'x = 0 ∧ ∀x x = x', variable: 'x', term: '(z + 1)', label: 'free and bound occurrences' },
  { formula: '∃z (z + z) = x', variable: 'x', term: '4', label: 'x is even, for x := 4' },
  { formula: '∃z (z + z) = x', variable: 'x', term: 'z′', label: 'x is even, for x := z′ (capture)' },
];

export function SubstitutionLab({ arithmetized = true }: { arithmetized?: boolean }) {
  const s = useStore(substStore);
  const pf = useMemo(() => tryParseFormula(s.formula, { abbreviations: ABBREVIATIONS }), [s.formula]);
  const pt = useMemo(() => tryParseTerm(s.term), [s.term]);
  const u = varIndex(s.variable) ?? 0;
  const [mode, setMode] = useState<'naive' | 'avoid'>('naive');
  const A = pf.ok ? pf.value : null;
  const t = pt.ok ? pt.value : null;
  return (
    <div className="workbench">
      <div className="subst-inputs">
        <FormulaInput value={s.formula} onChange={(formula) => substStore.set({ ...s, formula })} parsed={pf} label="A" />
        <div className="subst-row">
          <FormulaInput value={s.term} onChange={(term) => substStore.set({ ...s, term })} parsed={pt} label="the term t" palette={false} size="compact" />
          <label className="fi-label var-select">
            for the variable
            <select value={s.variable} onChange={(e) => substStore.set({ ...s, variable: e.target.value })}>
              {['x', 'y', 'z', 'u', 'w'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <select className="fi-examples" aria-label="Examples" value="" onChange={(e) => e.target.value && substStore.set(EXAMPLES[Number(e.target.value)])}>
            <option value="">Examples…</option>
            {EXAMPLES.map((x, i) => (
              <option key={i} value={i}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {A && t && <Lab A={A} t={t} u={u} mode={mode} setMode={setMode} arithmetized={arithmetized} />}
    </div>
  );
}

function Lab({ A, t, u, mode, setMode, arithmetized }: { A: Formula; t: Term; u: number; mode: 'naive' | 'avoid'; setMode: (m: 'naive' | 'avoid') => void; arithmetized: boolean }) {
  const aA = useMemo(() => analyze(A), [A]);
  const occ = useMemo(() => occurrences(A, u), [A, u]);
  const free = occ.filter((o) => o.free);
  const bound = occ.filter((o) => !o.free);
  const ff = useMemo(() => freeFor(t, u, A), [t, u, A]);
  const res = useMemo(() => substitute(A, u, t, mode), [A, u, t, mode]);
  const aR = useMemo(() => analyze(res.result), [res]);
  const [step, setStep] = useState(0);
  const steps = res.steps;
  const cur: SubstStep | undefined = steps[Math.min(step, steps.length - 1)];
  const un = varName(u);
  const captured = res.captures.map((c) => c.binder);
  return (
    <>
      <Panel n={1} title={<>Occurrences of {un} in A</>} prov={<Prov kind="computed" />}>
        <div className="wb-formula">
          <FormulaView node={A} analysis={aA} marked={free.map((o) => o.node.id)} />
        </div>
        <p className="wb-note">
          {free.length === 0 ? (
            <>
              <b>{un} has no free occurrence</b>, so <Tex tex={`A[t/${un}]`} /> is just A.
            </>
          ) : (
            <>
              <b>
                {free.length} free occurrence{free.length === 1 ? '' : 's'}
              </b>{' '}
              (marked) will be replaced.
            </>
          )}{' '}
          {bound.length > 0 && (
            <>
              {bound.length} bound occurrence{bound.length === 1 ? '' : 's'} will not: hover {bound.length === 1 ? 'it' : 'them'} to see the quantifier that binds{' '}
              {bound.length === 1 ? 'it' : 'them'}.
            </>
          )}
        </p>
      </Panel>

      <Panel n={2} title={<>Is <Tex tex="t" /> free for {un} in A?</>} prov={<Prov kind="computed" />}>
        {ff.ok ? (
          <p>
            <b>Yes.</b> No free occurrence of {un} lies in the scope of a quantifier binding a variable of <Tex tex="t" />, so substituting cannot change what those variables refer to.
          </p>
        ) : (
          <>
            <p>
              <b>No.</b> {ff.hazards.length === 1 ? 'A free occurrence' : `${ff.hazards.length} free occurrences`} of {un} lie
              {ff.hazards.length === 1 ? 's' : ''} in the scope of a quantifier binding{' '}
              {[...new Set(ff.hazards.map((h) => varName(h.variable)))].join(', ')}, a variable of <Tex tex="t" />. After substitution that variable would be <b>captured</b>:
              it would refer to the quantifier’s variable, not to whatever it referred to in <Tex tex="t" />.
            </p>
            <div className="hazards">
              {ff.hazards.map((h, i) => (
                <button
                  key={i}
                  className="chip-btn"
                  onMouseEnter={() => highlightStore.set({ primary: [h.occurrence], binder: [h.binder] })}
                  onMouseLeave={() => highlightStore.set(null)}
                >
                  hazard {i + 1}: show the occurrence and the capturing quantifier
                </button>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel
        n={3}
        title={
          <>
            The result <Tex tex={`A[t/${un}]`} />
          </>
        }
        prov={<Prov kind="computed" />}
      >
        <div className="seg" role="radiogroup" aria-label="Substitution">
          <button className="chip-btn" role="radio" aria-checked={mode === 'naive'} aria-pressed={mode === 'naive'} onClick={() => setMode('naive')}>
            as the book defines it
          </button>
          <button className="chip-btn" role="radio" aria-checked={mode === 'avoid'} aria-pressed={mode === 'avoid'} onClick={() => setMode('avoid')}>
            capture-avoiding (rename first)
          </button>
        </div>
        <div className="wb-formula">
          <FormulaView node={res.result} analysis={aR} marked={[...res.captures.map((c) => c.occurrence), ...captured]} />
        </div>
        {mode === 'naive' && res.captures.length > 0 && (
          <p className="wb-note danger">
            The book’s substitution replaces every free occurrence regardless — that is why its rules require “<Tex tex="t" /> is free for <Tex tex="x" />”. Here the result
            says something different from what was intended: the variable of <Tex tex="t" /> is now bound.
          </p>
        )}
        {mode === 'avoid' && res.renamed.length > 0 && (
          <p className="wb-note">
            First the bound variable {res.renamed.map((r) => `${varName(r.from)} → ${varName(r.to)}`).join(', ')} is renamed (α-conversion: renaming a bound variable does not change
            the meaning); then the substitution is safe.
          </p>
        )}
        {steps.length > 0 && (
          <Stepper
            step={Math.min(step, steps.length - 1)}
            count={steps.length}
            onStep={(i) => {
              setStep(i);
              const st = steps[i];
              highlightStore.set({ primary: [st.node, ...('copy' in st ? [st.copy] : [])], binder: 'binder' in st ? [st.binder] : [] });
            }}
            label="substitution"
            describe={() => (cur ? <>{cur.note}.</> : null)}
          />
        )}
      </Panel>

      {arithmetized && <ArithPanel A={A} t={t} u={u} />}
    </>
  );
}

export function ArithPanel({ A, t, u }: { A: Formula; t: Term; u: number }) {
  const r = useMemo(() => hSubst(A, t, u), [A, t, u]);
  const [step, setStep] = useState(0);
  if (!r.ok) {
    return (
      <Panel n={4} title="The same substitution, on Gödel numbers">
        <p className="muted">{r.error}</p>
      </Panel>
    );
  }
  const i = Math.min(step, r.steps.length - 1);
  const shown = r.steps[i];
  // The output built so far: the result items up to shown.length.
  const out = r.result.slice(0, shown.length);
  const agree = natEq(r.resultNumber, r.expected);
  return (
    <Panel n={4} title="The same substitution, on Gödel numbers" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        The function of <Ref k="inc:art:sub:prop:subst-primrec" /> works symbol by symbol on <Tex tex="x = \#A\#" />: at each position <Tex tex="i" />, if <Tex tex="\mathrm{FreeOcc}(x, z, i)" /> it appends all of{' '}
        <Tex tex="y = \#t\#" />, and otherwise the symbol <Tex tex="(x)_i" /> itself.
      </p>
      <Stepper
        step={i}
        count={r.steps.length}
        onStep={(k) => {
          setStep(k);
          highlightStore.set({ primary: [r.steps[k].item.node] });
        }}
        label="hSubst"
        describe={(k) => {
          const st = r.steps[k];
          return (
            <>
              <Tex tex={`i = ${k}`} />: <Tex tex={`(x)_{${k}}`} /> is{' '}
              {st.item.k === 'sym' ? <Tex tex={symTex(st.item.sym)} /> : 'a block'}
              {st.freeOcc ? (
                <>
                  , a <b>free occurrence</b> of the variable: append <Tex tex="\#t\#" /> ({r.y.length} symbols).
                </>
              ) : (
                <>, not a free occurrence: append it unchanged.</>
              )}{' '}
              Now <Tex tex={`\\mathrm{len}(\\mathrm{hSubst}(x,y,z,${k + 1})) = ${st.length}`} />.
            </>
          );
        }}
      />
      <div className="hsubst-strips">
        <div className="hs-row">
          <span className="hs-label">x = #A#</span>
          <span className="hs-strip">
            {r.x.map((it, k) => (
              <span key={k} className={`hs-cell ${k === i ? 'current' : ''} ${r.steps[k].freeOcc ? 'free' : ''} ${k > i ? 'future' : ''}`} data-n={it.node}>
                {it.k === 'sym' ? <Tex tex={symTex(it.sym)} /> : '▦'}
              </span>
            ))}
          </span>
        </div>
        <div className="hs-row">
          <span className="hs-label">output</span>
          <span className="hs-strip">
            {out.map((it, k) => (
              <span key={k} className={`hs-cell ${r.y.includes(it) ? 'inserted' : ''}`} data-n={it.node}>
                {it.k === 'sym' ? <Tex tex={symTex(it.sym)} /> : '▦'}
              </span>
            ))}
          </span>
        </div>
      </div>
      <p className={`wb-check ${agree === 'equal' ? 'ok' : 'bad'}`}>
        <Tex tex={`\\mathrm{Subst}(\\#A\\#, \\#t\\#, \\#${varName(u)}\\#) ${agree === 'equal' ? '=' : '\\neq'} \\#A[t/${varName(u)}]\\#`} />{' '}
        {agree === 'equal' ? <Prov kind="computed">equal, compared exactly</Prov> : <Prov kind="failed">{agree}</Prov>}
      </p>
      <NotAProof>
        This compares the two numbers for your A and t. <Ref k="inc:art:sub:prop:subst-primrec" /> says the equation holds for every formula, term and variable.
      </NotAProof>
      <button className="chip-btn" onClick={() => inspect({ key: 'hsubst-def', kicker: 'Definition', title: 'hSubst', body: <Tex display tex={'\\begin{aligned}\\mathrm{hSubst}(x,y,z,0) &= \\Lambda\\\\ \\mathrm{hSubst}(x,y,z,i+1) &= \\begin{cases}\\mathrm{hSubst}(x,y,z,i) \\frown y & \\text{if } \\mathrm{FreeOcc}(x,z,i)\\\\ \\mathrm{append}(\\mathrm{hSubst}(x,y,z,i), (x)_i) & \\text{otherwise}\\end{cases}\\end{aligned}'} /> }, true)}>
        show the definition
      </button>
    </Panel>
  );
}
