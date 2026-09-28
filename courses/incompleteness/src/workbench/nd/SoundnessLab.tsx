// Soundness, observed: a derivation, a finite structure, and for every step the question the
// soundness theorem answers — if M satisfies the undischarged assumptions this step depends on,
// does M satisfy the step's sentence? A search runs through every structure with a small domain.

import { useMemo, useState } from 'react';
import { check, linearize } from '../../engine/proof/nd';
import { ndTex } from '../../engine/proof/ndlang';
import { ND_EXAMPLES, exampleById } from '../../engine/proof/ndExamples';
import { emptyModel, modelCount, relKey, search, SEARCH_CAP, sentencesOf, signatureOf, stepVerdicts, type Model, type Search, type StepStatus } from '../../engine/proof/soundness';
import type { Truth } from '../../engine/semantics/trace';
import { constName } from '../../engine/syntax/language';
import { tupleKey, tuples } from '../../engine/semantics/structure';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { Panel } from '../coding';
import { NDTree, leafTex, ruleShort } from './NDTree';
import './nd.css';

const CHOICES = ND_EXAMPLES.filter((e) => e.section !== 'fol.ntd.der' && e.id !== 'ntd-and-imp');

const STATUS_TEXT: Record<StepStatus, string> = {
  preserved: 'holds',
  vacuous: 'vacuous',
  violated: 'fails',
  unknown: 'unknown',
};

function T({ t }: { t: Truth }) {
  return <span className={`ndb-t ${String(t)}`}>{t === 'unknown' ? '?' : t ? 'T' : 'F'}</span>;
}

export function SoundnessLab({ initial = 'qrl-bad' }: { initial?: string }) {
  const [exId, setExId] = useState(initial);
  const ex = exampleById(exId)!;
  const d = useMemo(() => ex.build(), [ex]);
  const c = useMemo(() => check(d), [d]);
  const sig = useMemo(() => signatureOf(sentencesOf(d)), [d]);
  const [size, setSize] = useState(2);
  const [model, setModel] = useState<Model>(() => emptyModel(sig, 2));
  const [found, setFound] = useState<Search | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  // reset the model when the derivation changes
  const [forId, setForId] = useState(exId);
  if (forId !== exId) {
    setForId(exId);
    setModel(emptyModel(sig, size));
    setFound(null);
    setSel(null);
  }
  const m = model.size === size ? model : { ...model, size, constants: new Map([...model.constants].map(([k, v]) => [k, Math.min(v, size - 1)])) };
  const verdicts = useMemo(() => (sig.unsupported.length ? null : stepVerdicts(d, c, sig, m)), [d, c, sig, m]);
  const steps = useMemo(() => linearize(d), [d]);
  const numbers = useMemo(() => new Map(steps.map((x, i) => [x.id, i + 1])), [steps]);
  const violated = verdicts?.filter((v) => v.status === 'violated') ?? [];
  const firstBad = violated[0];
  const domain = Array.from({ length: size }, (_, i) => i);

  const setRel = (key: string, tuple: number[], on: boolean) => {
    const rels = new Map(m.rels);
    const set = new Set(rels.get(key) ?? []);
    const k = tupleKey(tuple);
    if (on) set.add(k);
    else set.delete(k);
    rels.set(key, set);
    setModel({ ...m, rels });
  };

  return (
    <div className="workbench ndb">
      <Panel n={1} title="A derivation" prov={c.valid ? <Prov kind="checked" /> : <Prov kind="failed">rejected by the checker</Prov>}>
        <div className="ndb-row">
          <label className="ndb-kicker" htmlFor="snd-ex">
            Derivation
          </label>
          <select id="snd-ex" className="ndb-select grow" value={exId} onChange={(e) => setExId(e.target.value)}>
            {CHOICES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
                {e.incorrect ? ' — incorrect (as in the book)' : ''}
                {e.discrepancy ? ' — book version' : ''}
              </option>
            ))}
          </select>
        </div>
        <NDTree root={d} check={c} selected={sel ?? firstBad?.id ?? null} onSelect={setSel} numbers={numbers} highlight={new Set(violated.map((v) => v.id))} />
        {!c.valid && (
          <ul className="ndb-errors" style={{ fontSize: 13 }}>
            {c.errors.map((e, i) => (
              <li key={i}>
                step {numbers.get(e.id)}: {e.message.replace(/\(\)/g, '')}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel n={2} title="A finite structure M" prov={<Prov kind="computed" />}>
        {sig.unsupported.length > 0 ? (
          <p className="wb-note">This model checker interprets constants and predicate or formula letters only; the derivation uses {sig.unsupported.join(', ')}.</p>
        ) : (
          <div className="ndb-model">
            <div className="ndb-row">
              <span className="ndb-kicker">Domain</span>
              <span className="seg" role="radiogroup" aria-label="Domain size" style={{ margin: 0 }}>
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" className="chip-btn" role="radio" aria-checked={size === n} aria-pressed={size === n} onClick={() => { setSize(n); setFound(null); }}>
                    <Tex tex={`\\{${domain.length && n ? Array.from({ length: n }, (_, i) => i).join(', ') : ''}\\}`} />
                  </button>
                ))}
              </span>
            </div>
            {sig.constants.length > 0 && (
              <div className="ndb-row">
                {sig.constants.map((k) => (
                  <label key={k} className="ndb-row" style={{ gap: 4 }}>
                    <Tex tex={`${constName(k)}^M =`} />
                    <select className="ndb-select" value={m.constants.get(k) ?? 0} onChange={(e) => setModel({ ...m, constants: new Map(m.constants).set(k, Number(e.target.value)) })}>
                      {domain.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {sig.preds.map((p) => {
              const key = relKey(p);
              const rel = m.rels.get(key) ?? new Set<string>();
              if (p.arity === 0)
                return (
                  <label key={key} className="ndb-row" style={{ gap: 6 }}>
                    <input type="checkbox" checked={rel.has('[]')} onChange={(e) => setRel(key, [], e.target.checked)} />
                    <span>
                      <Tex tex={p.name} /> is true in M (a sentence letter is interpreted by a truth value)
                    </span>
                  </label>
                );
              if (p.arity === 1)
                return (
                  <div key={key} className="ndb-row" role="group" aria-label={`the extension of ${p.name}`}>
                    <Tex tex={`${p.name}^M = \\{`} />
                    {domain.map((x) => (
                      <label key={x} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        <input type="checkbox" checked={rel.has(tupleKey([x]))} onChange={(e) => setRel(key, [x], e.target.checked)} />
                        {x}
                      </label>
                    ))}
                    <Tex tex="\}" />
                  </div>
                );
              if (p.arity === 2)
                return (
                  <div key={key} className="ndb-scroll">
                    <table className="ndb-grid" aria-label={`the relation ${p.name}: row x, column y, checked if ⟨x, y⟩ ∈ ${p.name}`}>
                      <thead>
                        <tr>
                          <th>
                            <Tex tex={p.name} />
                          </th>
                          {domain.map((y) => (
                            <th key={y}>{y}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {domain.map((x) => (
                          <tr key={x}>
                            <th>{x}</th>
                            {domain.map((y) => (
                              <td key={y}>
                                <input type="checkbox" aria-label={`⟨${x}, ${y}⟩ ∈ ${p.name}`} checked={rel.has(tupleKey([x, y]))} onChange={(e) => setRel(key, [x, y], e.target.checked)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              return (
                <div key={key} className="ndb-row">
                  <Tex tex={`${p.name}^M`} />
                  {tuples(domain, p.arity).map((tu) => (
                    <label key={tupleKey(tu)} style={{ display: 'inline-flex', gap: 3 }}>
                      <input type="checkbox" checked={rel.has(tupleKey(tu))} onChange={(e) => setRel(key, tu as number[], e.target.checked)} />⟨{tu.join(', ')}⟩
                    </label>
                  ))}
                </div>
              );
            })}
            <div className="ndb-row">
              <button
                type="button"
                className="chip-btn primary"
                onClick={() => {
                  const r = search(d, c, sig, size);
                  setFound(r);
                  if (r.counterexample) {
                    setModel(r.counterexample.model);
                    setSel(r.counterexample.stepId);
                  }
                }}
              >
                Search all {modelCount(sig, size).toLocaleString('en')} structures with {size} element{size === 1 ? '' : 's'}
              </button>
              {modelCount(sig, size) > SEARCH_CAP && <span className="ndb-hint">(more than {SEARCH_CAP.toLocaleString('en')}: choose a smaller domain)</span>}
            </div>
            {found && (
              <div className="ndb-status" aria-live="polite">
                {!found.searched ? (
                  <>There are {found.total.toLocaleString('en')} structures of this size — too many to run through here.</>
                ) : found.counterexample ? (
                  <>
                    <Prov kind="computed" /> Found a structure (now shown above) in which step {numbers.get(found.counterexample.stepId)} fails: its assumptions are true and its sentence is false.
                    {found.counterexample.rootViolated ? ' The conclusion itself fails too: the derivation’s undischarged assumptions do not entail its conclusion.' : ''}
                  </>
                ) : (
                  <>
                    <Prov kind="computed" /> In none of the {found.total.toLocaleString('en')} structures with {found.size} element{found.size === 1 ? '' : 's'} does any step fail ({found.rootApplicable.toLocaleString('en')} of them make all of the conclusion’s assumptions true).
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      {verdicts && (
        <Panel n={3} title="Step by step: M ⊨ Γₛ ⇒ M ⊨ Aₛ ?" prov={<Prov kind="computed" />}>
          <p className="wb-note">
            Each step s concludes a sentence Aₛ from the undischarged assumptions Γₛ of the sub-derivation ending there. The soundness theorem says Γₛ ⊨ Aₛ, so in every structure: if all of Γₛ is true, Aₛ is
            true. A step <em>fails</em> in M when Γₛ is true in M and Aₛ is false.
          </p>
          <div className="ndb-scroll">
            <table className="ndb-verdicts">
              <thead>
                <tr>
                  <th>#</th>
                  <th>sentence Aₛ</th>
                  <th>rule</th>
                  <th>Γₛ in M</th>
                  <th>Aₛ in M</th>
                  <th>claim</th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((v) => {
                  const st = steps.find((x) => x.id === v.id)!;
                  return (
                    <tr key={v.id} className={`${v.status === 'violated' ? 'violated' : ''} ${sel === v.id ? 'sel' : ''}`} onClick={() => setSel(v.id)}>
                      <td>{numbers.get(v.id)}</td>
                      <td className="f">
                        <Tex tex={leafTex(st)} />
                      </td>
                      <td className="small">{st.rule === 'assume' ? 'assumption' : ruleShort(st)}</td>
                      <td>
                        {v.open.length === 0 ? (
                          <span className="ndb-hint">none</span>
                        ) : (
                          v.open.map((o, i) => (
                            <span key={o.id} style={{ whiteSpace: 'nowrap' }}>
                              {i > 0 && ', '}
                              <Tex tex={ndTex(o.formula)} />: <T t={o.truth} />
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        <T t={v.concl} />
                      </td>
                      <td>
                        <span className={`ndb-status-chip ${v.status}`}>{STATUS_TEXT[v.status]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {firstBad ? (
            <p className="wb-note danger">
              Step {numbers.get(firstBad.id)} ({ruleShort(steps.find((x) => x.id === firstBad.id)!)}) fails in this M. Its premises’ sub-derivations do not fail here, so this inference is where truth is lost.{' '}
              {c.steps.get(firstBad.id)?.ok === false
                ? `The checker rejects this very inference: ${(c.steps.get(firstBad.id)?.errors ?? []).join('; ').replace(/\(\)/g, '')}.`
                : c.valid
                  ? 'The checker accepted the derivation — by the soundness theorem this cannot happen.'
                  : 'The checker accepts this inference but rejects another step.'}
            </p>
          ) : (
            <p className="wb-note">No step fails in this structure{c.valid ? ', as the soundness theorem guarantees for every structure' : ''}.</p>
          )}
          <NotAProof>
            Checking finitely many finite structures proves neither the soundness theorem nor that this derivation’s assumptions entail its conclusion: entailment is about all structures, of every size. The
            theorem is proved in the text, by induction on the number of inferences. A structure in which a step fails, on the other hand, does show that the step’s sentence does not follow from its assumptions.
          </NotAProof>
        </Panel>
      )}
    </div>
  );
}
