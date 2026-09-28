// The derivation builder: a proof debugger you can build with.
//
// Start from a goal sentence and assumptions Γ. Select a goal (a dashed box) and choose a rule:
// the goal becomes the rule's conclusion and its premises become new goals (bottom-up). Or add
// assumptions as pieces and apply rules to them (top-down), then use a finished piece for a goal
// with the same sentence. After every change the whole tree goes to the checker; its verdicts
// and its error messages are what is shown. Undo walks back through every change — including,
// for a loaded example, the construction of the book's derivation goal by goal.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Formula, Term } from '../../engine/syntax/ast';
import { formulaEq, constants, isSentence, termEq } from '../../engine/syntax/ops';
import { constName } from '../../engine/syntax/language';
import { linearize, RULE_NAMES, type Deriv, type Rule } from '../../engine/proof/nd';
import { nd, ndMessage, ndTex, ndText, parseND, parseNDTerm } from '../../engine/proof/ndlang';
import {
  addAssumption, availableAt, checkState, constructionOf, dropPiece, findNode, forward, FORWARD_ARITY, FORWARD_NEEDS, freshEigen, freshLabel, NEEDS, plug, refine, retract, setLabel, start, suggest,
  type BState, type ForwardRule, type RefineParams, type RefineRule, type Result,
} from '../../engine/proof/builder';
import { ND_EXAMPLES, exampleById, type NDExample } from '../../engine/proof/ndExamples';
import { FormulaInput } from '../../ui/FormulaInput';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { NDTree, ruleShort, leafTex } from './NDTree';
import { PALETTE_RULES, RuleCard } from './RulePalette';
import './nd.css';

const MAX_STEPS = 300;

interface History {
  past: BState[];
  present: BState;
  future: BState[];
}

export interface DerivationBuilderProps {
  /** An example to load at first (finished, with its construction to undo through). */
  example?: string;
  /** Start from the example's goal only. */
  fromGoal?: boolean;
  /** Which examples the menu offers (default: all). */
  examples?: string[];
  /** A goal and assumptions to start from (when no example is given). */
  goal?: string;
  gamma?: string[];
  /** Called whenever the state is a complete, accepted derivation of the goal from Γ. */
  onDone?: (done: boolean) => void;
  /** Hide the goal/assumption editor and the example menu (for exercises). */
  fixed?: boolean;
  /** Axioms of a theory, by name (the leaves `axiom` must match them). */
  axioms?: Map<string, Formula>;
  title?: ReactNode;
}

const parseList = (s: string): { ok: true; value: Formula[] } | { ok: false; error: string } => {
  const parts = s.split(';').map((x) => x.trim()).filter(Boolean);
  const out: Formula[] = [];
  for (const p of parts) {
    const r = parseND(p);
    if (!r.ok) return { ok: false, error: `“${p}”: ${r.error}` };
    out.push(r.value);
  }
  return { ok: true, value: out };
};

export function DerivationBuilder({ example, fromGoal, examples, goal = '(¬A ∨ B) → (A → B)', gamma = [], onDone, fixed, axioms, title }: DerivationBuilderProps) {
  const initialEx = example ? exampleById(example) : undefined;
  const [goalText, setGoalText] = useState(initialEx ? ndText(initialEx.goal) : goal);
  const [gammaText, setGammaText] = useState(initialEx ? initialEx.gamma.map(ndText).join('; ') : gamma.join('; '));
  const [loaded, setLoaded] = useState<NDExample | null>(initialEx && !fromGoal ? initialEx : null);
  const [hist, setHist] = useState<History>(() => initHistory(initialEx, fromGoal, goalText, gammaText, axioms));
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const s = hist.present;
  const bc = useMemo(() => checkState(s), [s]);
  const steps = useMemo(() => linearize(s.root), [s]);
  const numbers = useMemo(() => new Map(steps.map((d, i) => [d.id, i + 1])), [steps]);
  const selNode = sel ? findNode(s.root, sel) : null;
  const selIsGoal = !!sel && s.goals.has(sel);

  useEffect(() => {
    onDone?.(bc.done);
  }, [bc.done, onDone]);

  // keep a sensible selection: the first goal
  useEffect(() => {
    if (!sel || (!findNode(s.root, sel) && !s.pieces.some((p) => findNode(p, sel)))) setSel(bc.goals[0]?.id ?? null);
  }, [s, sel, bc.goals]);

  const apply = (r: Result) => {
    if (!r.ok) {
      setMsg(r.error);
      return false;
    }
    if (linearize(r.state.root).length > MAX_STEPS) {
      setMsg(`The builder keeps derivations below ${MAX_STEPS} steps.`);
      return false;
    }
    setHist((h) => ({ past: [...h.past, h.present], present: r.state, future: [] }));
    setMsg(null);
    // move on to the next open goal, if the change closed the selected one
    const next = r.focus && r.state.goals.has(r.focus) ? r.focus : linearize(r.state.root).find((d) => r.state.goals.has(d.id))?.id ?? r.focus;
    if (next) setSel(next);
    return true;
  };
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));

  const goalParsed = useMemo(() => parseND(goalText), [goalText]);
  const gammaParsed = useMemo(() => parseList(gammaText), [gammaText]);
  const restart = () => {
    if (!goalParsed.ok || !gammaParsed.ok) return;
    setLoaded(null);
    setHist({ past: [], present: start(goalParsed.value, gammaParsed.value, axioms), future: [] });
    setSel(null);
    setMsg(null);
  };
  const load = (ex: NDExample, mode: 'finished' | 'goal') => {
    setGoalText(ndText(ex.goal));
    setGammaText(ex.gamma.map(ndText).join('; '));
    setLoaded(mode === 'goal' ? null : ex);
    if (mode === 'goal') setHist({ past: [], present: start(ex.goal, ex.gamma, axioms), future: [] });
    else {
      const states = constructionOf(ex.build(), ex.gamma, axioms);
      setHist({ past: states.slice(0, -1), present: states[states.length - 1], future: [] });
    }
    setSel(null);
    setMsg(null);
  };

  const offered = (examples ? examples.map(exampleById).filter(Boolean) : ND_EXAMPLES) as NDExample[];
  const [exPick, setExPick] = useState(initialEx?.id ?? offered[0]?.id ?? '');

  const liveId = useId();

  return (
    <div className="ndb">
      {title && <div className="ndb-kicker">{title}</div>}
      {!fixed && (
        <div className="ndb-setup">
          {offered.length > 0 && (
            <div className="ndb-row">
              <label className="ndb-kicker" htmlFor={`${liveId}-ex`}>
                Book example
              </label>
              <select id={`${liveId}-ex`} className="ndb-select grow" value={exPick} onChange={(e) => setExPick(e.target.value)}>
                {offered.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                    {e.incorrect ? ' (incorrect, as in the book)' : ''}
                  </option>
                ))}
              </select>
              <button type="button" className="chip-btn" onClick={() => load(exampleById(exPick)!, 'finished')}>
                Load the book’s derivation
              </button>
              <button type="button" className="chip-btn" onClick={() => load(exampleById(exPick)!, 'goal')}>
                Start from its goal
              </button>
            </div>
          )}
          <details>
            <summary className="ndb-kicker">Your own goal and assumptions</summary>
            <FormulaInput label="Goal (A, B, C, D are formula letters; a, b, c, d constants)" value={goalText} onChange={setGoalText} parsed={goalParsed} />
            <div className="ndb-field">
              <label htmlFor={`${liveId}-gamma`}>Assumptions Γ, separated by semicolons (may be empty)</label>
              <input id={`${liveId}-gamma`} className={`ndb-input ${gammaParsed.ok ? '' : 'invalid'}`} value={gammaText} onChange={(e) => setGammaText(e.target.value)} spellCheck={false} placeholder="e.g. ∀x (A(x) → B); ∃y A(y)" />
              {!gammaParsed.ok && <span className="ndb-err">{gammaParsed.error}</span>}
            </div>
            <button type="button" className="chip-btn primary" disabled={!goalParsed.ok || !gammaParsed.ok || (goalParsed.ok && freeVarsOf(goalParsed.value))} onClick={restart}>
              Start a new derivation
            </button>
            {goalParsed.ok && freeVarsOf(goalParsed.value) && <p className="ndb-err">The goal must be a sentence: derivations contain sentences only.</p>}
          </details>
        </div>
      )}

      {loaded && <ExampleNote ex={loaded} valid={bc.check.valid} />}

      <div className="ndb-toolbar" role="toolbar" aria-label="Derivation">
        <button type="button" className="chip-btn" onClick={undo} disabled={!hist.past.length} aria-label="Undo">
          ↶ Undo
        </button>
        <button type="button" className="chip-btn" onClick={redo} disabled={!hist.future.length} aria-label="Redo">
          ↷ Redo
        </button>
        <button type="button" className="chip-btn" onClick={() => setHist((h) => ({ past: [], present: start(h.present.root.concl, h.present.gamma, axioms), future: [] }))}>
          Clear to the goal
        </button>
        <span className="spacer" />
        <span className="seg" role="radiogroup" aria-label="View" style={{ margin: 0 }}>
          <button type="button" role="radio" aria-checked={view === 'tree'} className="chip-btn" onClick={() => setView('tree')}>
            tree
          </button>
          <button type="button" role="radio" aria-checked={view === 'list'} className="chip-btn" onClick={() => setView('list')}>
            steps
          </button>
        </span>
      </div>

      <p className="ndb-hint">
        Γ = {s.gamma.length ? <Tex tex={`\\{${s.gamma.map(ndTex).join(',\\ ')}\\}`} /> : '∅'} · {hist.past.length} change{hist.past.length === 1 ? '' : 's'} to undo
      </p>

      {view === 'tree' ? (
        <NDTree root={s.root} check={bc.check} goals={s.goals} selected={sel} onSelect={setSel} numbers={numbers} />
      ) : (
        <StepList steps={steps} s={s} bc={bc} numbers={numbers} sel={sel} onSelect={setSel} />
      )}

      <Status bc={bc} s={s} numbers={numbers} onSelect={setSel} liveId={liveId} msg={msg} />

      <div className="ndb-cols two">
        <div className="ndb-box">
          {selNode && selIsGoal ? (
            <GoalActions key={sel} s={s} goal={selNode} onApply={apply} axioms={axioms} />
          ) : selNode ? (
            <StepInfo key={sel} s={s} d={selNode} bc={bc} numbers={numbers} onApply={apply} onSelect={setSel} />
          ) : (
            <p className="ndb-hint">{bc.goals.length ? 'Select a goal (a dashed box) or a step in the tree.' : 'No goals left. Select a step to inspect it.'}</p>
          )}
        </div>
        <Pieces s={s} onApply={apply} selectedGoal={selIsGoal ? selNode : null} axioms={axioms} />
      </div>
    </div>
  );
}

/** Not a sentence: some variable is free. */
const freeVarsOf = (f: Formula): boolean => !isSentence(f);

function initHistory(ex: NDExample | undefined, fromGoal: boolean | undefined, goalText: string, gammaText: string, axioms?: Map<string, Formula>): History {
  if (ex && !fromGoal) {
    const states = constructionOf(ex.build(), ex.gamma, axioms);
    return { past: states.slice(0, -1), present: states[states.length - 1], future: [] };
  }
  if (ex) return { past: [], present: start(ex.goal, ex.gamma, axioms), future: [] };
  const g = parseND(goalText);
  const gl = parseList(gammaText);
  return { past: [], present: start(g.ok ? g.value : nd('A → A'), gl.ok ? gl.value : [], axioms), future: [] };
}

function ExampleNote({ ex, valid }: { ex: NDExample; valid: boolean }) {
  return (
    <div className="ndb-note" role="note">
      <div>
        <b>The book’s derivation</b> — {ex.where}.{' '}
        {valid ? <Prov kind="checked">accepted by the checker</Prov> : <Prov kind="failed">rejected by the checker</Prov>}
      </div>
      {ex.incorrect && <p style={{ margin: '4px 0 0' }}>The book gives this derivation as an example of what the rules do <em>not</em> allow.</p>}
      {ex.note && <p style={{ margin: '4px 0 0' }}>{ex.note}</p>}
      <p className="ndb-hint" style={{ margin: '4px 0 0' }}>
        Undo takes the derivation apart goal by goal, back to the bare goal.
      </p>
    </div>
  );
}

function Status({ bc, s, numbers, onSelect, liveId, msg }: { bc: ReturnType<typeof checkState>; s: BState; numbers: Map<string, number>; onSelect: (id: string) => void; liveId: string; msg: string | null }) {
  const errs = bc.check.errors;
  const cls = bc.done ? 'done' : errs.length ? 'errors' : '';
  const assumptions = bc.check.open.filter((o) => o.kind === 'assume');
  return (
    <div className={`ndb-status ${cls}`} aria-live="polite" id={liveId}>
      {msg && (
        <p className="ndb-err" role="alert" style={{ margin: '0 0 4px' }}>
          {msg}
        </p>
      )}
      {bc.done ? (
        <div>
          <Prov kind="checked">Checked: {bc.check.size} steps</Prov>{' '}
          <Tex tex={`${s.gamma.length ? s.gamma.map(ndTex).join(', ') : ''} \\vdash ${ndTex(s.root.concl)}`} /> — every inference accepted, every undischarged assumption in Γ.
        </div>
      ) : (
        <div>
          {bc.goals.length > 0 ? (
            <span>
              <span className="ndb-goaltag">{bc.goals.length} goal{bc.goals.length === 1 ? '' : 's'}</span> still to derive.{' '}
            </span>
          ) : null}
          {errs.length === 0 ? <span>The checker accepts every inference so far.</span> : <span>The checker rejects {errs.length === 1 ? 'one inference' : `${errs.length} inferences`}:</span>}
        </div>
      )}
      {errs.length > 0 && (
        <ul className="ndb-errors">
          {errs.map((e, i) => (
            <li key={i}>
              <button type="button" className="linklike" onClick={() => onSelect(e.id)}>
                step {numbers.get(e.id) ?? '?'}
              </button>
              : {ndMessage(e.message)}
            </li>
          ))}
        </ul>
      )}
      {bc.outsideGamma.length > 0 && (
        <p style={{ margin: '4px 0 0' }}>
          Undischarged assumption{bc.outsideGamma.length === 1 ? '' : 's'} not in Γ:{' '}
          {bc.outsideGamma.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ', '}
              <button type="button" className="linklike" onClick={() => onSelect(d.id)}>
                <Tex tex={leafTex(d)} />
              </button>
            </span>
          ))}{' '}
          <span className="ndb-hint">(allowed by the rules, but then this is not a derivation from Γ; discharge them or add them to Γ)</span>
        </p>
      )}
      {!bc.done && (
        <p className="ndb-hint" style={{ margin: '4px 0 0' }}>
          Undischarged so far: {assumptions.length ? assumptions.map((o) => `${ndText(o.formula)}${o.label !== undefined ? ` [${o.label}]` : ''}`).join('; ') : 'none'}.
        </p>
      )}
    </div>
  );
}

function StepList({ steps, s, bc, numbers, sel, onSelect }: { steps: Deriv[]; s: BState; bc: ReturnType<typeof checkState>; numbers: Map<string, number>; sel: string | null; onSelect: (id: string) => void }) {
  return (
    <ol className="ndb-steps" aria-label="Steps, premises before conclusions">
      {steps.map((d) => {
        const goal = s.goals.has(d.id);
        const st = bc.check.steps.get(d.id);
        const bad = !goal && st && !st.ok;
        return (
          <li key={d.id} className={`${sel === d.id ? 'sel' : ''} ${bad ? 'bad' : ''}`}>
            <span className="n">{numbers.get(d.id)}</span>
            <button type="button" className={`ndb-f f ${goal ? 'goal' : ''} ${sel === d.id ? 'sel' : ''}`} onClick={() => onSelect(d.id)} aria-pressed={sel === d.id}>
              <Tex tex={goal ? ndTex(d.concl) : leafTex(d)} />
            </button>
            <span className="r">
              {goal ? (
                <span className="ndb-goaltag">goal</span>
              ) : d.rule === 'assume' ? (
                'assumption'
              ) : d.rule === 'axiom' || d.rule === 'hyp' ? (
                d.name
              ) : (
                <>
                  {ruleShort(d)} {d.premises.map((p) => numbers.get(p.id)).join(', ')}
                  {d.label !== undefined && <span style={{ color: 'var(--number)' }}> [{d.label}]</span>}
                </>
              )}{' '}
              {!goal && (bad ? <span className="ndb-no" aria-label="rejected">✗</span> : <span className="ndb-yes" aria-label="accepted">✓</span>)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ selected step

function StepInfo({ s, d, bc, numbers, onApply, onSelect }: { s: BState; d: Deriv; bc: ReturnType<typeof checkState>; numbers: Map<string, number>; onApply: (r: Result) => boolean; onSelect: (id: string) => void }) {
  const st = bc.check.steps.get(d.id);
  const canLabel = ['assume', 'orE', 'impI', 'notI', 'botC', 'exE'].includes(d.rule);
  const [lab, setLab] = useState(d.label === undefined ? '' : String(d.label));
  return (
    <div>
      <h4>
        <span className="ndb-kicker">Step {numbers.get(d.id)}</span>
        <Tex tex={leafTex(d)} />
      </h4>
      <p style={{ margin: '0 0 6px' }}>
        {d.rule === 'assume' ? (
          <>An assumption{d.label !== undefined ? <> labelled {d.label}: an inference below labelled {d.label} may discharge it</> : ', unlabelled: it stays undischarged'}.</>
        ) : d.rule === 'axiom' ? (
          <>Axiom {d.name}.</>
        ) : d.rule === 'hyp' ? (
          <>Hypothesis {d.name}.</>
        ) : (
          <>
            By <b>{ruleShort(d)}</b> from {d.premises.length ? d.premises.map((p) => `step ${numbers.get(p.id)}`).join(', ') : 'no premises'}
            {d.label !== undefined ? `, discharging label ${d.label}` : ''}.
          </>
        )}
      </p>
      {!['assume', 'axiom', 'hyp'].includes(d.rule) && <RuleCard rule={d.rule} />}
      {st && (
        <div style={{ marginTop: 8 }}>
          {st.ok ? (
            <Prov kind="checked">the checker accepts this inference</Prov>
          ) : (
            <>
              <Prov kind="failed">the checker rejects it</Prov>
              <ul className="ndb-errors">
                {st.errors.map((e, i) => (
                  <li key={i}>{ndMessage(e)}</li>
                ))}
              </ul>
            </>
          )}
          {st.discharged.length > 0 && (
            <p style={{ margin: '6px 0 0' }}>
              Discharges:{' '}
              {st.discharged.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <button type="button" className="linklike" onClick={() => onSelect(o.id)}>
                    <Tex tex={`[${ndTex(o.formula)}]^{${o.label}}`} />
                  </button>
                </span>
              ))}
            </p>
          )}
          <p style={{ margin: '6px 0 0' }}>
            Depends on:{' '}
            {st.open.length === 0 ? (
              <span className="ndb-hint">nothing — no undischarged assumptions</span>
            ) : (
              st.open.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <Tex tex={o.label !== undefined ? `[${ndTex(o.formula)}]^{${o.label}}` : ndTex(o.formula)} />
                </span>
              ))
            )}
          </p>
        </div>
      )}
      <div className="ndb-row" style={{ marginTop: 10 }}>
        <button type="button" className="chip-btn" onClick={() => onApply(retract(s, d.id))}>
          Retract (make it a goal again)
        </button>
        {canLabel && (
          <>
            <label className="ndb-hint" htmlFor={`lab-${d.id}`}>
              label
            </label>
            <input id={`lab-${d.id}`} className="ndb-input small" inputMode="numeric" value={lab} onChange={(e) => setLab(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            <button type="button" className="chip-btn" onClick={() => onApply(setLabel(s, d.id, lab === '' ? undefined : Number(lab)))}>
              {lab === '' ? 'Remove label' : 'Set label'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ goal actions (bottom-up)

const fitsGoal = (r: Rule, g: Formula): boolean => {
  switch (r) {
    case 'andI':
      return g.k === 'and';
    case 'orI':
      return g.k === 'or';
    case 'impI':
      return g.k === 'imp';
    case 'notI':
      return g.k === 'not';
    case 'notE':
      return g.k === 'bot';
    case 'allI':
      return g.k === 'forall';
    case 'exI':
      return g.k === 'exists';
    case 'eqI':
      return g.k === 'eq' && termEq(g.l, g.r);
    default:
      return false;
  }
};

function GoalActions({ s, goal, onApply, axioms }: { s: BState; goal: Deriv; onApply: (r: Result) => boolean; axioms?: Map<string, Formula> }) {
  const avail = useMemo(() => availableAt(s, goal.id), [s, goal.id]);
  const inGamma = s.gamma.some((g) => formulaEq(g, goal.concl));
  const matchingPieces = s.pieces.filter((p) => formulaEq(p.concl, goal.concl));
  const matchingAxioms = axioms ? [...axioms.entries()].filter(([, f]) => formulaEq(f, goal.concl)).map(([n]) => n) : [];
  const [rule, setRule] = useState<RefineRule | null>(null);
  const [other, setOther] = useState('');
  return (
    <div>
      <h4>
        <span className="ndb-kicker">Goal</span>
        <Tex tex={ndTex(goal.concl)} />
      </h4>
      <div className="ndb-field">
        <span className="lab">Close it as an assumption</span>
        <div className="ndb-row">
          {avail.map((a) => (
            <button key={`${a.label}-${ndText(a.formula)}`} type="button" className="chip-btn" disabled={!formulaEq(a.formula, goal.concl)} onClick={() => onApply(refine(s, goal.id, 'assume', { label: a.label }))} title={formulaEq(a.formula, goal.concl) ? `assume it, labelled ${a.label}: discharged by ${RULE_NAMES[a.rule]} below` : 'a different sentence'}>
              <Tex tex={`[${ndTex(a.formula)}]^{${a.label}}`} />
            </button>
          ))}
          <button type="button" className="chip-btn" onClick={() => onApply(refine(s, goal.id, 'assume', {}))} title="an undischarged assumption">
            {inGamma ? 'from Γ' : 'undischarged'} <Tex tex={ndTex(goal.concl)} />
          </button>
          <span className="ndb-row">
            <label className="ndb-hint" htmlFor={`as-${goal.id}`}>
              or labelled
            </label>
            <input id={`as-${goal.id}`} className="ndb-input small" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="n" />
            <button type="button" className="chip-btn" disabled={!other} onClick={() => onApply(refine(s, goal.id, 'assume', { label: Number(other) }))}>
              assume
            </button>
          </span>
        </div>
        {avail.length > 0 && !avail.some((a) => formulaEq(a.formula, goal.concl)) && <span className="ndb-hint">The labelled assumptions available here are different sentences.</span>}
        {!inGamma && avail.length === 0 && <span className="ndb-hint">This sentence is not in Γ and no inference below discharges it: assuming it leaves it undischarged.</span>}
      </div>
      {(matchingPieces.length > 0 || matchingAxioms.length > 0) && (
        <div className="ndb-field">
          <span className="lab">Use what is already derived</span>
          <div className="ndb-row">
            {matchingPieces.map((p) => (
              <button key={p.id} type="button" className="chip-btn" onClick={() => onApply(plug(s, goal.id, p.id))}>
                piece: <Tex tex={ndTex(p.concl)} />
              </button>
            ))}
            {matchingAxioms.map((n) => (
              <button key={n} type="button" className="chip-btn" onClick={() => onApply(refine(s, goal.id, 'axiom', { axiom: n }))}>
                axiom {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ndb-field">
        <span className="lab">Or derive it by a rule (the goal becomes its conclusion)</span>
        <div className="ndb-palette" role="group" aria-label="Rules">
          {PALETTE_RULES.map((r) => (
            <RuleCard key={r} rule={r} onPick={(x) => setRule(x as RefineRule)} picked={rule === r} fits={fitsGoal(r, goal.concl)} />
          ))}
        </div>
      </div>
      {rule && <RuleForm key={rule} s={s} goal={goal} rule={rule} onApply={onApply} axioms={axioms} />}
    </div>
  );
}

function useFormulaField(initial = '') {
  const [text, setText] = useState(initial);
  const parsed = useMemo(() => (text.trim() ? parseND(text) : null), [text]);
  return { text, setText, parsed, value: parsed?.ok ? parsed.value : undefined };
}

function useTermField(initial = '') {
  const [text, setText] = useState(initial);
  const parsed = useMemo(() => (text.trim() ? parseNDTerm(text) : null), [text]);
  return { text, setText, parsed, value: parsed?.ok ? (parsed.value as Term) : undefined };
}

function EigenSelect({ s, value, onChange, extra, id }: { s: BState; value: number; onChange: (n: number) => void; extra: Formula[]; id: string }) {
  const fresh = freshEigen(s, extra);
  const used = useMemo(() => {
    const out = new Set<number>();
    for (const f of [...s.gamma, ...extra, ...linearize(s.root).map((d) => d.concl), ...s.pieces.flatMap((p) => linearize(p).map((d) => d.concl))]) for (const c of constants(f)) out.add(c);
    return out;
  }, [s, extra]);
  return (
    <div className="ndb-field">
      <label htmlFor={id}>Eigenvariable (a constant)</label>
      <select id={id} className="ndb-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
          <option key={c} value={c}>
            {constName(c)}
            {c === fresh ? ' — fresh' : used.has(c) ? ' — already occurs in the derivation' : ''}
          </option>
        ))}
      </select>
      <span className="ndb-hint">The checker enforces the eigenvariable condition; choosing a constant that occurs elsewhere may violate it.</span>
    </div>
  );
}

function RuleForm({ s, goal, rule, onApply, axioms }: { s: BState; goal: Deriv; rule: RefineRule; onApply: (r: Result) => boolean; axioms?: Map<string, Formula> }) {
  const need = NEEDS[rule];
  const id = useId();
  const f = useFormulaField('');
  const t = useTermField('');
  const [eigen, setEigen] = useState(() => freshEigen(s));
  const [label, setLabel] = useState(() => String(freshLabel(s)));
  const [side, setSide] = useState<0 | 1>(0);
  const [edit, setEdit] = useState(false);
  const [premTexts, setPremTexts] = useState<string[] | null>(null);
  const params: RefineParams = {
    formula: f.value,
    term: t.value,
    eigen: need.eigen ? eigen : undefined,
    label: need.label && label !== '' ? Number(label) : undefined,
    side,
  };
  const sg = suggest(rule, goal.concl, params);
  const edited = edit && premTexts ? premTexts.map((x) => parseND(x)) : null;
  const editedOk = edited ? edited.every((x) => x.ok) : true;
  const apply = () => {
    const p: RefineParams = { ...params };
    if (edited && editedOk) p.premises = edited.map((x) => (x as { ok: true; value: Formula }).value);
    onApply(refine(s, goal.id, rule, p));
  };
  return (
    <div className="ndb-box" style={{ marginTop: 8, background: 'var(--paper)' }}>
      <h4>
        Apply {RULE_NAMES[rule]} to <Tex tex={ndTex(goal.concl)} />
      </h4>
      {need.formula && (
        <div className="ndb-field">
          <label htmlFor={`${id}-f`}>{need.formula.label}</label>
          <input id={`${id}-f`} className={`ndb-input ${f.parsed && !f.parsed.ok ? 'invalid' : ''}`} value={f.text} onChange={(e) => f.setText(e.target.value)} placeholder={need.formula.placeholder} spellCheck={false} autoComplete="off" />
          {f.parsed && !f.parsed.ok && <span className="ndb-err">{f.parsed.error}</span>}
          {axioms && rule === 'allE' && (
            <div className="ndb-row">
              <span className="ndb-hint">or an axiom:</span>
              {[...axioms.entries()].map(([n, ax]) => (
                <button key={n} type="button" className="chip-btn" onClick={() => f.setText(ndText(ax))}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {need.term && (
        <div className="ndb-field">
          <label htmlFor={`${id}-t`}>
            {need.term.label}
            {need.term.optional ? ' (optional: the checker can find it)' : ''}
          </label>
          <input id={`${id}-t`} className={`ndb-input ${t.parsed && !t.parsed.ok ? 'invalid' : ''}`} value={t.text} onChange={(e) => t.setText(e.target.value)} placeholder="e.g. a" spellCheck={false} autoComplete="off" />
          {t.parsed && !t.parsed.ok && <span className="ndb-err">{t.parsed.error}</span>}
        </div>
      )}
      {need.eigen && <EigenSelect s={s} value={eigen} onChange={setEigen} extra={[goal.concl, ...(f.value ? [f.value] : [])]} id={`${id}-e`} />}
      {need.label && (
        <div className="ndb-field">
          <label htmlFor={`${id}-l`}>Discharge label n (empty: none)</label>
          <input id={`${id}-l`} className="ndb-input small" inputMode="numeric" value={label} onChange={(e) => setLabel(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </div>
      )}
      {need.side && (
        <div className="ndb-field">
          <span className="lab">{need.side.label}</span>
          <div className="seg" role="radiogroup" aria-label={need.side.label}>
            {need.side.options.map((o, i) => (
              <button key={o} type="button" className="chip-btn" role="radio" aria-checked={side === i} onClick={() => setSide(i as 0 | 1)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ndb-field">
        <span className="lab">Premises (new goals)</span>
        {!edit ? (
          sg.ok ? (
            <div className="ndb-preview">
              {sg.premises.length === 0 ? <span className="ndb-hint">none: the goal is derived outright</span> : sg.premises.map((p, i) => <span key={i} className="ndb-f goal"><Tex tex={ndTex(p)} /></span>)}
              {sg.note && <span className="ndb-hint">{sg.note}</span>}
            </div>
          ) : (
            <span className="ndb-err">{sg.error}</span>
          )
        ) : (
          (premTexts ?? []).map((x, i) => (
            <div key={i}>
              <input aria-label={`premise ${i + 1}`} className={`ndb-input ${edited && !edited[i].ok ? 'invalid' : ''}`} value={x} onChange={(e) => setPremTexts((ps) => ps!.map((y, j) => (j === i ? e.target.value : y)))} spellCheck={false} />
              {edited && !edited[i].ok && <span className="ndb-err">{(edited[i] as { error: string }).error}</span>}
            </div>
          ))
        )}
        {rule !== 'assume' && rule !== 'axiom' && rule !== 'eqI' && (
          <button
            type="button"
            className="linklike"
            style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
            onClick={() => {
              if (!edit) setPremTexts(sg.ok ? sg.premises.map(ndText) : Array.from({ length: FORWARD_ARITY[rule as ForwardRule] ?? 1 }, () => ''));
              setEdit(!edit);
            }}
          >
            {edit ? 'use the suggested premises' : 'edit the premises (the checker will judge them)'}
          </button>
        )}
      </div>
      <button type="button" className="chip-btn primary" disabled={edit ? !editedOk : !sg.ok} onClick={apply}>
        Apply {RULE_NAMES[rule]}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ pieces (top-down)

const FORWARD_RULES = PALETTE_RULES as ForwardRule[];

function Pieces({ s, onApply, selectedGoal, axioms }: { s: BState; onApply: (r: Result) => boolean; selectedGoal: Deriv | null; axioms?: Map<string, Formula> }) {
  const id = useId();
  const a = useFormulaField('');
  const [lab, setLab] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [rule, setRule] = useState<ForwardRule>('andE');
  const checks = useMemo(() => new Map(checkState(s).pieces.map((p) => [p.piece.id, p.check])), [s]);
  // forget picks of pieces that no longer exist
  const live = picked.filter((p) => s.pieces.some((x) => x.id === p));
  const toggle = (pid: string) => setPicked((ps) => (ps.includes(pid) ? ps.filter((x) => x !== pid) : [...ps, pid]));
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="ndb-box" ref={ref}>
      <h4>
        <span className="ndb-kicker">Top-down</span> Pieces
      </h4>
      <p className="ndb-hint" style={{ marginTop: 0 }}>
        Add assumptions, apply rules to them, and use a finished piece for a goal with the same sentence.
      </p>
      <div className="ndb-field">
        <label htmlFor={`${id}-a`}>Assume a sentence</label>
        <div className="ndb-row">
          <input id={`${id}-a`} className={`ndb-input grow ${a.parsed && !a.parsed.ok ? 'invalid' : ''}`} value={a.text} onChange={(e) => a.setText(e.target.value)} placeholder="e.g. ¬A ∨ B" spellCheck={false} autoComplete="off" />
          <input aria-label="label (optional)" className="ndb-input small" inputMode="numeric" value={lab} placeholder="label" onChange={(e) => setLab(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          <button type="button" className="chip-btn" disabled={!a.value} onClick={() => a.value && onApply(addAssumption(s, a.value, lab ? Number(lab) : undefined)) && a.setText('')}>
            Add
          </button>
        </div>
        {a.parsed && !a.parsed.ok && <span className="ndb-err">{a.parsed.error}</span>}
        {s.gamma.length > 0 && (
          <div className="ndb-row">
            <span className="ndb-hint">from Γ:</span>
            {s.gamma.map((g, i) => (
              <button key={i} type="button" className="chip-btn" onClick={() => onApply(addAssumption(s, g))}>
                <Tex tex={ndTex(g)} />
              </button>
            ))}
          </div>
        )}
        {axioms && (
          <div className="ndb-row">
            <span className="ndb-hint">axiom:</span>
            {[...axioms.entries()].map(([n, f]) => (
              <button key={n} type="button" className="chip-btn" onClick={() => onApply(addAssumption(s, f, undefined, n))}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {s.pieces.length > 0 && (
        <>
          <div className="ndb-pieces" role="group" aria-label="Pieces">
            {s.pieces.map((p) => {
              const order = live.indexOf(p.id);
              const c = checks.get(p.id);
              return (
                <div key={p.id} className={`ndb-piece ${order >= 0 ? 'picked' : ''}`}>
                  <input type="checkbox" aria-label={`use ${ndText(p.concl)} as a premise`} checked={order >= 0} onChange={() => toggle(p.id)} />
                  <span className="ndb-piece-order">{order >= 0 ? order + 1 : ''}</span>
                  <NDTree root={p} check={c} small label={`piece ${ndText(p.concl)}`} />
                  <span className="ndb-row" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                    {c && (c.errors.length ? <span className="ndb-no" title={c.errors.map((e) => ndMessage(e.message)).join('; ')}>✗</span> : <span className="ndb-yes">✓</span>)}
                    {selectedGoal && formulaEq(selectedGoal.concl, p.concl) && (
                      <button type="button" className="chip-btn" onClick={() => onApply(plug(s, selectedGoal.id, p.id))}>
                        use for the goal
                      </button>
                    )}
                    <button type="button" className="linklike" style={{ fontSize: 12 }} onClick={() => onApply(dropPiece(s, p.id))}>
                      delete
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          {[...checks.values()].some((c) => c.errors.length > 0) && (
            <ul className="ndb-errors" style={{ fontSize: 13 }}>
              {[...checks.entries()].flatMap(([pid, c]) => c.errors.map((e, i) => <li key={`${pid}-${i}`}>{ndMessage(e.message)}</li>))}
            </ul>
          )}
          <div className="ndb-field">
            <label htmlFor={`${id}-r`}>Apply a rule to the checked pieces, in the order checked</label>
            <select id={`${id}-r`} className="ndb-select" value={rule} onChange={(e) => setRule(e.target.value as ForwardRule)}>
              {FORWARD_RULES.map((r) => (
                <option key={r} value={r}>
                  {RULE_NAMES[r]} ({FORWARD_ARITY[r]} premise{FORWARD_ARITY[r] === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </div>
          <ForwardForm key={rule} s={s} rule={rule} picked={live} onApply={(r) => { const ok = onApply(r); if (ok) setPicked([]); return ok; }} />
        </>
      )}
      {s.pieces.length === 0 && (
        <p className="ndb-hint">
          No pieces yet. =Intro needs no premises:{' '}
          <ForwardForm s={s} rule="eqI" picked={[]} onApply={onApply} inline />
        </p>
      )}
    </div>
  );
}

function ForwardForm({ s, rule, picked, onApply, inline }: { s: BState; rule: ForwardRule; picked: string[]; onApply: (r: Result) => boolean; inline?: boolean }) {
  const need = FORWARD_NEEDS[rule];
  const id = useId();
  const f = useFormulaField('');
  const t = useTermField('');
  const [eigen, setEigen] = useState(() => freshEigen(s));
  const [label, setLabel] = useState(() => String(freshLabel(s)));
  const [side, setSide] = useState<0 | 1>(0);
  const run = () =>
    onApply(
      forward(s, rule, picked, {
        formula: f.value,
        term: t.value,
        eigen: need.eigen ? eigen : undefined,
        label: need.label && label !== '' ? Number(label) : undefined,
        side,
      }),
    );
  if (inline)
    return (
      <span className="ndb-row" style={{ display: 'inline-flex' }}>
        <input aria-label="closed term t for t = t" className="ndb-input small" value={t.text} onChange={(e) => t.setText(e.target.value)} placeholder="t" />
        <button type="button" className="chip-btn" disabled={!t.value} onClick={run}>
          add t = t
        </button>
      </span>
    );
  const n = FORWARD_ARITY[rule];
  return (
    <div>
      {need.formula && (
        <div className="ndb-field">
          <label htmlFor={`${id}-f`}>{need.formula.label}</label>
          <input id={`${id}-f`} className={`ndb-input ${f.parsed && !f.parsed.ok ? 'invalid' : ''}`} value={f.text} onChange={(e) => f.setText(e.target.value)} placeholder={need.formula.placeholder} spellCheck={false} autoComplete="off" />
          {f.parsed && !f.parsed.ok && <span className="ndb-err">{f.parsed.error}</span>}
        </div>
      )}
      {need.term && (
        <div className="ndb-field">
          <label htmlFor={`${id}-t`}>{need.term.label}</label>
          <input id={`${id}-t`} className={`ndb-input ${t.parsed && !t.parsed.ok ? 'invalid' : ''}`} value={t.text} onChange={(e) => t.setText(e.target.value)} placeholder="e.g. a" spellCheck={false} autoComplete="off" />
          {t.parsed && !t.parsed.ok && <span className="ndb-err">{t.parsed.error}</span>}
        </div>
      )}
      {need.eigen && <EigenSelect s={s} value={eigen} onChange={setEigen} extra={[]} id={`${id}-e`} />}
      {need.label && (
        <div className="ndb-field">
          <label htmlFor={`${id}-l`}>Discharge label n (empty: none)</label>
          <input id={`${id}-l`} className="ndb-input small" inputMode="numeric" value={label} onChange={(e) => setLabel(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </div>
      )}
      {need.side && (
        <div className="ndb-field">
          <span className="lab">{need.side.label}</span>
          <div className="seg" role="radiogroup" aria-label={need.side.label}>
            {need.side.options.map((o, i) => (
              <button key={o} type="button" className="chip-btn" role="radio" aria-checked={side === i} onClick={() => setSide(i as 0 | 1)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="chip-btn primary" disabled={picked.length !== n} onClick={run}>
        Apply {RULE_NAMES[rule]} to {picked.length}/{n} checked piece{n === 1 ? '' : 's'}
      </button>
    </div>
  );
}
