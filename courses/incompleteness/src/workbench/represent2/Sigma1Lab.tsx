// Σ1-completeness (section "Σ1 completeness"): classify a formula by the book's definitions,
// highlight its bounded quantifiers, search for the witness of a Σ1 sentence (with a limit), and
// unfold the proof of Lemma Δ0-completeness for the resulting Δ0 instance.

import { useMemo, useState } from 'react';
import type { Formula } from '../../engine/syntax/ast';
import { nodeById } from '../../engine/syntax/ast';
import { tryParseFormula } from '../../engine/syntax/parse';
import { formulaTex, termTex } from '../../engine/syntax/print';
import { varName } from '../../engine/syntax/language';
import { boundedForm, classify, evaluateInN } from '../../engine/semantics/standard';
import { sigma1Plan, type PlanNode } from '../../engine/proof/sigma1';
import { persistedStore, useStore } from '../../ui/store';
import { FormulaInput } from '../../ui/FormulaInput';
import { FormulaView } from '../../ui/FormulaView';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import './represent2.css';

export const sigmaStore = persistedStore('ic.s1c.formula', '∃x (20 < x ∧ ∀y (y < x → ∀z (z < x → ¬ (y′′ × z′′) = x)))');

const EXAMPLES = [
  { label: 'a prime above 20 (Σ1)', value: '∃x (20 < x ∧ ∀y (y < x → ∀z (z < x → ¬ (y′′ × z′′) = x)))' },
  { label: 'a square root of 49 (Σ1)', value: '∃x (x × x) = 49' },
  { label: 'no square is 2 — searched (Σ1, false)', value: '∃x (x × x) = 2' },
  { label: 'squares below 25 (Δ0)', value: '∀x (x < 5 → (x × x) < 25)' },
  { label: 'a false Δ0 sentence', value: '∀x (x < 5 → (x × x) < 10)' },
  { label: 'two unbounded ∃ (not literally Σ1)', value: '∃x ∃y (x × y) = 6' },
  { label: 'a Π1 sentence', value: '∀x ¬ x′ = 0' },
  { label: 'bound mentions the variable', value: '∀x (x < x′ → x = x)' },
  { label: 'nested bound on a bound variable (Σ1)', value: '∃x ∀y (y < x → ∃z (z < x ∧ y < z))' },
];

const LEVEL_TEXT: Record<string, string> = { Δ0: 'Δ₀', Σ1: 'Σ₁', Π1: 'Π₁', other: 'none of Δ₀, Σ₁, Π₁' };

export function Sigma1Lab() {
  const text = useStore(sigmaStore);
  const parsed = useMemo(() => tryParseFormula(text), [text]);
  const [limit, setLimit] = useState(1000);
  return (
    <div className="workbench">
      <Panel n={1} title="A formula, classified by the book’s definitions" prov={<Prov kind="computed" />}>
        <FormulaInput value={text} onChange={sigmaStore.set} parsed={parsed} label="Formula of arithmetic" examples={EXAMPLES} />
        {parsed.ok && <Classified f={parsed.value} />}
      </Panel>
      {parsed.ok && <Search f={parsed.value} limit={limit} setLimit={setLimit} />}
    </div>
  );
}

function Classified({ f }: { f: Formula }) {
  const c = useMemo(() => classify(f), [f]);
  const marked = [...c.bounded, ...(c.problem ? [c.problem.node] : [])];
  return (
    <div aria-live="polite">
      <div className="r2-formula-line">
        <FormulaView node={f} marked={marked} />
      </div>
      <p className="wb-note">
        <span className={`r2-badge ${c.level === 'other' ? 'warn' : 'good'}`}>{LEVEL_TEXT[c.level]}</span> {c.explanation}
      </p>
      {(c.bounded.length > 0 || c.unbounded || c.problem) && (
        <ul className="r2-small sans" style={{ margin: '4px 0', paddingLeft: 20 }}>
          {c.unbounded && (
            <li>
              unbounded <Tex tex={c.unbounded.kind === 'exists' ? `\\exists ${varName(c.unbounded.variable)}` : `\\forall ${varName(c.unbounded.variable)}`} /> in front
            </li>
          )}
          {c.bounded.map((id) => {
            const q = nodeById(f, id) as Formula | null;
            const b = q ? boundedForm(q) : null;
            if (!b || 'reason' in b) return null;
            return (
              <li key={id}>
                bounded: <Tex tex={`${b.kind === 'forall' ? '\\forall' : '\\exists'} ${varName(b.variable)} < ${termTex(b.bound)}`} />, i.e. <Tex tex={b.kind === 'forall' ? `\\forall ${varName(b.variable)}\\,(${varName(b.variable)} < ${termTex(b.bound)} \\rightarrow \\ldots)` : `\\exists ${varName(b.variable)}\\,(${varName(b.variable)} < ${termTex(b.bound)} \\land \\ldots)`} />
              </li>
            );
          })}
          {c.problem && <li className="r2-bad" style={{ fontWeight: 400 }}>in the way: {c.problem.reason}</li>}
        </ul>
      )}
      <p className="wb-note">
        The book’s bounded quantifiers are the abbreviations of <Ref k="inc:inp:s1c:defn:bd-quant" />; this workbench recognizes them literally and also requires that the quantified variable not occur in the bound <Tex tex="t" /> (otherwise the “bound” depends on the variable and bounds nothing). Underlined in the formula: the bounded quantifiers with their scopes (or, if there is one, the part that is in the way).
      </p>
    </div>
  );
}

function Search({ f, limit, setLimit }: { f: Formula; limit: number; setLimit: (n: number) => void }) {
  const plan = useMemo(() => sigma1Plan(f, { limit }), [f, limit]);
  const tries = useMemo(() => {
    if (plan.classification.level !== 'Σ1') return null;
    const r = evaluateInN(f, new Map(), { limit, maxSteps: 400_000 });
    return r.trace?.quantifier ?? null;
  }, [f, limit, plan.classification.level]);
  const isSigma = plan.classification.level === 'Σ1';
  const q = f as Formula & { k: 'exists' };
  return (
    <>
      <Panel n={2} title={isSigma ? 'Looking for a witness' : 'Truth in ℕ'} prov={<Prov kind="computed" />}>
        {isSigma && (
          <div className="r2-row">
            <span>Search limit:</span>
            <span className="seg" role="radiogroup" aria-label="Search limit" style={{ margin: 0 }}>
              {[100, 1000, 10000].map((l) => (
                <button key={l} className="chip-btn" role="radio" aria-checked={limit === l} aria-pressed={limit === l} onClick={() => setLimit(l)}>
                  {l.toLocaleString('en-US')}
                </button>
              ))}
            </span>
          </div>
        )}
        {tries && (
          <div className="r2-search" aria-label="values tried">
            {tries.variants.slice(0, 60).map((v) => (
              <span key={String(v.element)} className={v.truth === true ? 'hit' : 'miss'}>
                {varName(q.v.index)}={String(v.element)} {v.truth === true ? '✓' : v.truth === false ? '✗' : '?'}
              </span>
            ))}
            {tries.variants.length > 60 && <span className="miss">… {tries.variants.length - 60} more</span>}
          </div>
        )}
        <p className="wb-note" aria-live="polite">
          <span className={`r2-badge ${plan.status === 'true' ? 'good' : plan.status === 'false' ? 'warn' : 'info'}`}>{plan.status === 'not-applicable' ? 'theorem does not apply' : plan.status === 'unknown' ? 'no answer' : plan.status}</span> {plan.message}
        </p>
        {isSigma && plan.status === 'unknown' && (
          <p className="wb-note">
            A search that finds nothing proves nothing: if the sentence is true, its witness lies beyond the limit. (Deciding in general whether a Σ<sub>1</sub> sentence is true is as hard as the halting problem.)
          </p>
        )}
      </Panel>
      {(plan.plan || plan.negationPlan) && (
        <Panel n={3} title="The proof, unfolded for this sentence" prov={<Prov kind="computed" />}>
          <p className="wb-note">
            {plan.witness !== undefined ? (
              <>
                The proof of <Ref k="inc:inp:s1c:thm:sigma1-completeness" /> applies <Ref k="inc:inp:s1c:lem:delta0-completeness" /> to the Δ<sub>0</sub> sentence <Tex tex={`A(\\overline{${plan.witness}})`} />, then infers <Tex tex={`\\exists ${varName(q.v.index)}\\, A(${varName(q.v.index)})`} /> by ∃Intro. The lemma’s proof is an induction on the sentence; here is that induction, case by case, for this one.
              </>
            ) : plan.plan ? (
              <>
                The proof of <Ref k="inc:inp:s1c:lem:delta0-completeness" /> is an induction on the sentence. Here it is case by case for this one.
              </>
            ) : (
              <>
                The sentence is false, so Q does not prove it (Q is true in ℕ). The same lemma, applied to its negation, shows Q proves <Tex tex="\lnot A" />:
              </>
            )}
          </p>
          <p className="r2-small r2-muted sans">
            {plan.nodes.toLocaleString('en-US')} step{plan.nodes === 1 ? '' : 's'}. Leaves are atomic sentences, settled by <Ref k="inc:inp:s1c:lem:atomic-completeness" />; bounded quantifiers use <Ref k="inc:inp:s1c:lem:bounded-quant-equiv" />. Cases marked “added” (→, ↔, ⊤, ⊥) are handled by logic in the same way; the book’s list of cases covers ∧, ∨, ¬ and the bounded quantifiers.
          </p>
          {plan.witness !== undefined && (
            <p className="r2-goal">
              <Tex tex={`\\mathbf Q \\vdash ${formulaTex(f)}`} /> <span className="r2-muted r2-small sans">by ∃Intro from</span>
            </p>
          )}
          <ul className="r2-plan root">
            <PlanItem node={(plan.plan ?? plan.negationPlan)!} depth={0} />
          </ul>
          <NotAProof>
            This is the shape of the book’s proof for one sentence, not a derivation in Q: the lemmas it cites are proved in the text for all sentences, and no natural deduction derivation is generated here.
          </NotAProof>
        </Panel>
      )}
    </>
  );
}

function PlanItem({ node, depth }: { node: PlanNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const goal = (
    <span className="r2-goal">
      <Tex tex={`\\mathbf Q \\vdash ${node.goal === 'refute' ? `\\lnot ${formulaTex(node.sentence, {}, false)}` : formulaTex(node.sentence)}`} />
    </span>
  );
  const caseLine = (
    <span className="r2-case">
      {node.case}
      {node.added && <span className="r2-badge info">added</span>}
    </span>
  );
  if (node.children.length === 0) {
    return (
      <li>
        <span className="r2-leaf">{goal}</span>
        {caseLine}
      </li>
    );
  }
  return (
    <li>
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{goal}</summary>
        {caseLine}
        {open && (
          <ul className="r2-plan">
            {node.children.map((c, i) => (
              <PlanItem key={i} node={c} depth={depth + 1} />
            ))}
            {node.omitted ? <li className="r2-muted r2-small">… and {node.omitted} more instances (not listed)</li> : null}
          </ul>
        )}
      </details>
    </li>
  );
}

/** The theorem applied to the reader's sentence, briefly (for Formal mode). */
export function Sigma1Summary() {
  const text = useStore(sigmaStore);
  const parsed = useMemo(() => tryParseFormula(text), [text]);
  const plan = useMemo(() => (parsed.ok ? sigma1Plan(parsed.value, { limit: 1000 }) : null), [parsed]);
  if (!parsed.ok || !plan) return <p className="r2-err">Your sentence (set in Explore mode) does not parse.</p>;
  return (
    <div>
      <div className="r2-formula-line">
        <FormulaView node={parsed.value} />
      </div>
      <p className="wb-note">
        <span className="r2-badge">{LEVEL_TEXT[plan.classification.level]}</span> {plan.message}
        {plan.nodes > 0 && <> The unfolded proof has {plan.nodes.toLocaleString('en-US')} steps (see Explore mode).</>}
      </p>
    </div>
  );
}
