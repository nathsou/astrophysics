// The object a section works with, editable in every mode.

import { useMemo, useState } from 'react';
import type { SectionPlan } from '../content/course';
import { bStore, buildRF, functionStore, sequenceStore, substStore, useParsedFormula, useParsedTerm, ABBREVIATIONS } from '../content/objects';
import { useStore } from './store';
import { FormulaInput } from './FormulaInput';
import { FormulaView } from './FormulaView';
import { tryParseFormula, tryParseTerm } from '../engine/syntax/parse';
import { arity, rfTex } from '../engine/recursive/rf';
import { Tex } from './Tex';
import { FORMULA_EXAMPLES, B_EXAMPLES } from './examples';

const LABEL: Record<NonNullable<SectionPlan['object']>, string> = {
  formula: 'Your formula',
  term: 'Your term',
  subst: 'Your substitution',
  B: 'Your B(x)',
  function: 'Your function',
  sequence: 'Your sequence',
};

export function ObjectBar({ kind }: { kind: NonNullable<SectionPlan['object']> }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="object-bar" role="region" aria-label="The object you are working with">
      <span className="label">{LABEL[kind]}</span>
      {editing ? (
        <>
          {kind === 'formula' && <FormulaObject />}
          {kind === 'term' && <TermObject />}
          {kind === 'subst' && <SubstObject />}
          {kind === 'B' && <BObject />}
          {kind === 'function' && <FunctionObject />}
          {kind === 'sequence' && <SequenceObject />}
        </>
      ) : (
        <span className="object-view">
          <ObjectView kind={kind} />
        </span>
      )}
      <button className="chip-btn object-edit" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
        {editing ? 'done' : 'edit'}
      </button>
      <span className="object-note" title="The same object is used in Intuition, Explore and Formal mode">
        kept across modes
      </span>
    </div>
  );
}

function ObjectView({ kind }: { kind: NonNullable<SectionPlan['object']> }) {
  const [, , pf] = useParsedFormula();
  const [, , pt] = useParsedTerm();
  const [, , pb] = useParsedFormula(bStore);
  const s = useStore(substStore);
  const f = useStore(functionStore);
  const seq = useStore(sequenceStore);
  const rf = useMemo(() => buildRF(f.spec), [f.spec]);
  switch (kind) {
    case 'formula':
      return pf.ok ? <FormulaView node={pf.value} label="your formula" /> : <span className="fi-error">(does not parse — edit it)</span>;
    case 'term':
      return pt.ok ? <FormulaView node={pt.value} label="your term" /> : <span className="fi-error">(does not parse)</span>;
    case 'B':
      return pb.ok ? <FormulaView node={pb.value} label="B(x)" /> : <span className="fi-error">(does not parse)</span>;
    case 'subst':
      return (
        <span className="mono small">
          {s.formula} [ {s.term} / {s.variable} ]
        </span>
      );
    case 'function':
      return (
        <span>
          <Tex tex={rfTex(rf)} /> <span className="muted small">at ({f.args})</span>
        </span>
      );
    case 'sequence':
      return <span className="mono">⟨{seq}⟩</span>;
  }
}

function FormulaObject() {
  const [text, set, parsed] = useParsedFormula();
  return (
    <>
      <FormulaInput value={text} onChange={set} parsed={parsed} label="formula A" examples={FORMULA_EXAMPLES} palette={false} size="compact" />
      {parsed.ok && <FormulaView node={parsed.value} label="your formula" />}
    </>
  );
}

function TermObject() {
  const [text, set, parsed] = useParsedTerm();
  return (
    <>
      <FormulaInput value={text} onChange={set} parsed={parsed} label="term t" palette={false} size="compact" />
      {parsed.ok && <FormulaView node={parsed.value} label="your term" />}
    </>
  );
}

function SubstObject() {
  const s = useStore(substStore);
  const pf = useMemo(() => tryParseFormula(s.formula, { abbreviations: ABBREVIATIONS }), [s.formula]);
  const pt = useMemo(() => tryParseTerm(s.term), [s.term]);
  return (
    <span className="subst-object">
      <FormulaInput value={s.formula} onChange={(formula) => substStore.set({ ...s, formula })} parsed={pf} label="A" palette={false} size="compact" />
      <span className="subst-bracket">[</span>
      <FormulaInput value={s.term} onChange={(term) => substStore.set({ ...s, term })} parsed={pt} label="t" palette={false} size="compact" />
      <span>/</span>
      <label className="var-select">
        <span className="sr-only">variable</span>
        <select value={s.variable} onChange={(e) => substStore.set({ ...s, variable: e.target.value })}>
          {['x', 'y', 'z', 'u', 'w'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <span className="subst-bracket">]</span>
    </span>
  );
}

function BObject() {
  const [text, set, parsed] = useParsedFormula(bStore);
  return (
    <>
      <FormulaInput value={text} onChange={set} parsed={parsed} label="B(x)" examples={B_EXAMPLES} palette={false} size="compact" />
      {parsed.ok && <FormulaView node={parsed.value} label="B(x)" />}
    </>
  );
}

function FunctionObject() {
  const f = useStore(functionStore);
  const rf = useMemo(() => buildRF(f.spec), [f.spec]);
  const ar = arity(rf);
  return (
    <span className="fn-object">
      <Tex tex={rfTex(rf)} />
      <span className="muted">{ar.ok ? `${ar.arity}-place` : 'ill-formed'}</span>
      <label className="args-input">
        at
        <input value={f.args} onChange={(e) => functionStore.set({ ...f, args: e.target.value })} aria-label="arguments" />
      </label>
    </span>
  );
}

function SequenceObject() {
  const s = useStore(sequenceStore);
  return (
    <label className="args-input">
      ⟨<input value={s} onChange={(e) => sequenceStore.set(e.target.value)} aria-label="sequence" />⟩
    </label>
  );
}
