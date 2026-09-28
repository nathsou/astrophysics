// Where each hypothesis of the first incompleteness theorem is used.
//
// This is an authored analysis of the proofs in section 5.3 — not a mechanical check. Each step
// of the two lemmas lists what justifies it; switching a hypothesis off shows which steps, and
// so which conclusions, lose their justification.

import { useMemo, useState, type ReactNode } from 'react';
import { Ref } from '../formal/FormalText';
import { Prov } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { inspect, highlightStore } from '../ui/store';
import { bStore } from '../content/objects';

type Hyp = 'extendsQ' | 'axiomatizable' | 'consistent' | 'omega';

const HYPS: { id: Hyp; label: ReactNode; text: string }[] = [
  { id: 'extendsQ', label: <>T extends <Tex tex="\mathbf{Q}" /></>, text: 'T proves every axiom of Q, and so everything Q proves.' },
  { id: 'axiomatizable', label: 'T is axiomatizable', text: 'The set of axioms of T is decidable, so whether something is a T-derivation is decidable.' },
  { id: 'consistent', label: 'T is consistent', text: 'T does not derive both a sentence and its negation.' },
  { id: 'omega', label: 'T is ω-consistent', text: 'If T derives ¬A(n̄) for every n, it does not derive ∃x A(x).' },
];

/** A justification: a hypothesis, an earlier result, or plain logic. */
type Just = { hyp: Hyp } | { result: string } | { logic: string } | { anyOf: Just[] };

interface Step {
  id: string;
  claim: ReactNode;
  why: ReactNode;
  uses: Just[];
}

interface Result {
  id: string;
  title: ReactNode;
  label?: string;
  statement: ReactNode;
  /** results or hypotheses the result as a whole rests on (for the graph) */
  steps: Step[];
}

const consistentOrOmega: Just = { anyOf: [{ hyp: 'consistent' }, { hyp: 'omega' }] };

const RESULTS: Result[] = [
  {
    id: 'repPrf',
    title: <>Prf<sub>T</sub> is represented in Q</>,
    label: 'inc:req:rel:thm:representing-rels',
    statement: (
      <>
        There is a formula <Tex tex="\mathsf{Prf}_T(x, y)" /> such that Q derives <Tex tex="\mathsf{Prf}_T(\overline m, \overline n)" /> when <Tex tex="m" /> codes a
        T-derivation of the sentence with number <Tex tex="n" />, and its negation otherwise.
      </>
    ),
    steps: [
      { id: 'r1', claim: <>The relation Prf<sub>T</sub>(m, n) is decidable.</>, why: 'Checking that m codes a correct derivation is primitive recursive; checking that its assumptions are axioms of T needs the axioms to be decidable.', uses: [{ hyp: 'axiomatizable' }] },
      { id: 'r2', claim: 'So it is representable in Q.', why: 'Every computable relation is representable in Q.', uses: [{ result: 'thm:representing-rels' }] },
    ],
  },
  {
    id: 'G',
    title: <>The Gödel sentence G<sub>T</sub></>,
    label: 'inc:inp:1in:eqn:qpf',
    statement: (
      <>
        By the fixed-point lemma applied to <Tex tex="\lnot\mathsf{Prov}_T(x)" />, where <Tex tex="\mathsf{Prov}_T(y) = \exists x\,\mathsf{Prf}_T(x, y)" />:{' '}
        <Tex tex="\mathbf{Q} \vdash G_T \leftrightarrow \lnot\mathsf{Prov}_T(\ulcorner G_T \urcorner)" />.
      </>
    ),
    steps: [
      { id: 'g1', claim: <>The formula Prov<sub>T</sub>(y) exists.</>, why: 'It is built from the formula representing Prf_T.', uses: [{ result: 'repPrf' }] },
      { id: 'g2', claim: 'The fixed point exists and Q derives the biconditional.', why: 'The fixed-point lemma (for any formula with one free variable).', uses: [{ result: 'lem:fixed-point' }] },
    ],
  },
  {
    id: 'L1',
    title: <>If T is consistent, T ⊬ G<sub>T</sub></>,
    label: 'inc:inp:1in:lem:cons-G-unprov',
    statement: (
      <>
        <Tex tex="T \nvdash G_T" />
      </>
    ),
    steps: [
      { id: 'l1', claim: <>Suppose T ⊢ G<sub>T</sub>.</>, why: 'For a contradiction.', uses: [{ logic: 'assumption' }] },
      { id: 'l2', claim: <>Then Prf<sub>T</sub>(m, #G<sub>T</sub>#) holds for some m.</>, why: 'A derivation exists; m is its Gödel number.', uses: [{ logic: 'definition of Prf_T' }] },
      { id: 'l3', claim: <>So Q ⊢ Prf<sub>T</sub>(m̄, ⌜G<sub>T</sub>⌝).</>, why: 'Prf_T is represented in Q.', uses: [{ result: 'repPrf' }] },
      { id: 'l4', claim: <>So Q ⊢ Prov<sub>T</sub>(⌜G<sub>T</sub>⌝).</>, why: '∃Intro.', uses: [{ logic: '∃Intro' }] },
      { id: 'l5', claim: <>So Q ⊢ ¬G<sub>T</sub>.</>, why: <>By the fixed-point biconditional <Ref k="inc:inp:1in:eqn:qpf" />.</>, uses: [{ result: 'G' }] },
      { id: 'l6', claim: <>So T ⊢ ¬G<sub>T</sub>.</>, why: 'T extends Q.', uses: [{ hyp: 'extendsQ' }] },
      { id: 'l7', claim: <>T derives G<sub>T</sub> and ¬G<sub>T</sub>: impossible.</>, why: 'This contradicts the consistency of T. (If T is only assumed ω-consistent, consistency follows: an inconsistent theory proves everything, so it is ω-inconsistent.)', uses: [consistentOrOmega] },
    ],
  },
  {
    id: 'L2',
    title: <>If T is ω-consistent, T ⊬ ¬G<sub>T</sub></>,
    label: 'inc:inp:1in:lem:omega-cons-G-unref',
    statement: (
      <>
        <Tex tex="T \nvdash \lnot G_T" />
      </>
    ),
    steps: [
      { id: 'm1', claim: <>Suppose T ⊢ ¬G<sub>T</sub>.</>, why: 'For a contradiction.', uses: [{ logic: 'assumption' }] },
      { id: 'm2', claim: 'T is consistent.', why: 'Every ω-consistent theory is consistent.', uses: [consistentOrOmega] },
      { id: 'm3', claim: <>So T ⊬ G<sub>T</sub>.</>, why: 'The previous lemma.', uses: [{ result: 'L1' }] },
      { id: 'm4', claim: <>So for every n, Q ⊢ ¬Prf<sub>T</sub>(n̄, ⌜G<sub>T</sub>⌝), and so does T.</>, why: 'No n codes a derivation of G_T, and Prf_T is represented (the negative clause); T extends Q.', uses: [{ result: 'repPrf' }, { hyp: 'extendsQ' }] },
      { id: 'm5', claim: <>But T ⊢ ∃x Prf<sub>T</sub>(x, ⌜G<sub>T</sub>⌝).</>, why: <>¬G<sub>T</sub> is equivalent to Prov<sub>T</sub>(⌜G<sub>T</sub>⌝) by <Ref k="inc:inp:1in:eqn:qpf" />, and T extends Q.</>, uses: [{ result: 'G' }, { hyp: 'extendsQ' }] },
      { id: 'm6', claim: 'So T is ω-inconsistent: impossible.', why: 'Steps 4 and 5 are exactly what ω-consistency forbids.', uses: [{ hyp: 'omega' }] },
    ],
  },
  {
    id: 'T',
    title: 'The first incompleteness theorem',
    label: 'inc:inp:1in:thm:first-incompleteness',
    statement: <>T is not complete: it derives neither G<sub>T</sub> nor ¬G<sub>T</sub>.</>,
    steps: [
      { id: 't1', claim: <>T ⊬ G<sub>T</sub>.</>, why: 'First lemma (ω-consistency gives consistency).', uses: [{ result: 'L1' }] },
      { id: 't2', claim: <>T ⊬ ¬G<sub>T</sub>.</>, why: 'Second lemma.', uses: [{ result: 'L2' }] },
    ],
  },
];

const EXTERNAL: Record<string, { label: string; text: ReactNode }> = {
  'thm:representing-rels': { label: 'inc:req:rel:thm:representing-rels', text: 'computable relations are representable in Q' },
  'lem:fixed-point': { label: 'inc:inp:fix:lem:fixed-point', text: 'the fixed-point lemma' },
};

export function IncompletenessExplorer() {
  const [on, setOn] = useState<Record<Hyp, boolean>>({ extendsQ: true, axiomatizable: true, consistent: true, omega: true });
  const [open, setOpen] = useState<string>('L2');

  const status = useMemo(() => {
    const res = new Map<string, boolean>();
    const stepOk = new Map<string, boolean>();
    const justOk = (j: Just): boolean => {
      if ('hyp' in j) return on[j.hyp];
      if ('logic' in j) return true;
      if ('anyOf' in j) return j.anyOf.some(justOk);
      if (j.result in EXTERNAL) return true;
      return res.get(j.result) ?? false;
    };
    for (const r of RESULTS) {
      let ok = true;
      for (const s of r.steps) {
        const sOk = s.uses.every(justOk);
        stepOk.set(s.id, sOk);
        ok &&= sOk;
      }
      res.set(r.id, ok);
    }
    return { res, stepOk, justOk };
  }, [on]);

  const current = RESULTS.find((r) => r.id === open)!;
  return (
    <div className="workbench g1">
      <p className="wb-note">
        <Prov kind="added">authored analysis</Prov> The steps below paraphrase the proofs in <Ref k="inc:inp:1in:sec" />. The dependencies are a reading of those
        proofs, not a mechanical check. Switch a hypothesis off to see which steps lose their justification.
      </p>
      <fieldset className="hyp-toggles">
        <legend className="fi-label">Hypotheses about the theory T</legend>
        {HYPS.map((h) => (
          <label key={h.id} className={`hyp ${on[h.id] ? "on" : "off"}`} title={h.text} data-n={`hyp-${h.id}`}>
            <input type="checkbox" checked={on[h.id]} onChange={(e) => setOn({ ...on, [h.id]: e.target.checked })} />
            {h.label}
          </label>
        ))}
      </fieldset>

      <div className="g1-graph" role="list" aria-label="Results">
        {RESULTS.map((r) => {
          const ok = status.res.get(r.id);
          return (
            <button key={r.id} role="listitem" className={`g1-node ${ok ? 'ok' : 'broken'} ${open === r.id ? 'open' : ''}`} onClick={() => setOpen(r.id)} aria-pressed={open === r.id}>
              <span className="g1-status">{ok ? '✓' : '✗'}</span>
              <span>{r.title}</span>
              {r.label && (
                <span className="g1-ref">
                  <Ref k={r.label} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="g1-detail" aria-live="polite">
        <h3>
          <span>{current.title}</span>{' '}
          {status.res.get(current.id) ? <span className="support ok">supported by the hypotheses</span> : <span className="support broken">no longer supported</span>}
        </h3>
        <p>{current.statement}</p>
        <ol className="g1-steps">
          {current.steps.map((s) => {
            const ok = status.stepOk.get(s.id);
            return (
              <li
                key={s.id}
                className={ok ? 'ok' : 'broken'}
                tabIndex={0}
                onFocus={() => inspect(stepEntry(s, status.justOk))}
                onMouseEnter={() => {
                  inspect(stepEntry(s, status.justOk));
                  highlightStore.set({ primary: s.uses.flatMap((u) => ('hyp' in u ? [`hyp-${u.hyp}`] : 'anyOf' in u ? u.anyOf.flatMap((x) => ('hyp' in x ? [`hyp-${x.hyp}`] : [])) : [])) });
                }}
              >
                <span className="g1-claim">{s.claim}</span>
                <span className="g1-uses">
                  {s.uses.map((u, i) => (
                    <JustChip key={i} j={u} ok={status.justOk(u)} />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
        {current.id === 'L2' && !on.omega && on.consistent && (
          <p className="caveat">
            <strong>Only this lemma needs ω-consistency.</strong> With consistency alone Gödel’s argument still shows <Tex tex="T \nvdash G_T" />. Rosser’s trick (a different
            fixed point) removes ω-consistency altogether: consistency suffices for incompleteness.
          </p>
        )}
        {current.id === 'G' && (
          <p>
            <a className="chip-btn" href="#/s/inc.inp.fix?mode=explore" onClick={() => bStore.set('¬Prov(x)')}>
              construct G in the fixed-point workbench →
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

function JustChip({ j, ok }: { j: Just; ok: boolean }): ReactNode {
  if ('hyp' in j) {
    const h = HYPS.find((x) => x.id === j.hyp)!;
    return (
      <span className={`just hyp ${ok ? 'ok' : 'broken'}`} data-n={`hyp-${j.hyp}`}>
        {h.label}
      </span>
    );
  }
  if ('logic' in j) return <span className="just logic">{j.logic}</span>;
  if ('anyOf' in j)
    return (
      <span className={`just any ${ok ? 'ok' : 'broken'}`}>
        consistency (or ω-consistency, which implies it)
      </span>
    );
  const ext = EXTERNAL[j.result];
  if (ext)
    return (
      <span className="just result ok">
        <Ref k={ext.label} />
      </span>
    );
  const r = RESULTS.find((x) => x.id === j.result)!;
  return <span className={`just result ${ok ? 'ok' : 'broken'}`}>{r.title}</span>;
}

function stepEntry(s: Step, justOk: (j: Just) => boolean) {
  return {
    key: `g1:${s.id}`,
    kicker: 'Proof step',
    title: <>{s.claim}</>,
    body: (
      <>
        <p>{s.why}</p>
        <div className="sec">
          <div className="sec-title">Justified by</div>
          <ul>
            {s.uses.map((u, i) => (
              <li key={i}>
                <JustChip j={u} ok={justOk(u)} />
              </li>
            ))}
          </ul>
        </div>
        <p className="muted small">This dependency analysis is a reading of the proof; it is not machine-checked.</p>
      </>
    ),
  };
}
