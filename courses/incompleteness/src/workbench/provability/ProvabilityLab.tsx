// Proofs from the derivability conditions (sections 5.6–5.9), checked line by line.
//
// The engine (engine/provability/pl.ts) checks every line: P1 applications, P2 and P3 instances,
// and propositional steps by truth table (Prov(⌜…⌝) counts as an atom). Conditions and
// hypotheses can be switched off to see which lines lose their justification.

import { useMemo, useState, type ReactNode } from 'react';
import {
  checkProof,
  eq,
  logicClaim,
  lob,
  p2Instance,
  p3Instance,
  secondIncompleteness,
  show,
  tarski,
  tex,
  truthTable,
  tryParsePF,
  type Just,
  type Line,
  type LineCheck,
  type PF,
} from '../../engine/provability/pl';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { persist, persisted } from '../../ui/store';
import { labelText } from '../../content/source';
import './provability.css';

export type ProofName = 'g2' | 'lob' | 'tarski';

const PROOFS: Record<ProofName, { lines: () => Line[]; judgement: string; conditions: boolean; intro: ReactNode }> = {
  g2: {
    lines: secondIncompleteness,
    judgement: 'T \\vdash',
    conditions: true,
    intro: <>Every line is claimed to be derivable in T. The last line, Con → G, together with the first incompleteness theorem, gives the second.</>,
  },
  lob: {
    lines: lob,
    judgement: 'T \\vdash',
    conditions: true,
    intro: <>Every line is claimed to be derivable in T, given the fixed point D and the theorem’s assumption T ⊢ Prov(⌜A⌝) → A.</>,
  },
  tarski: {
    lines: tarski,
    judgement: '\\mathfrak{N} \\vDash',
    conditions: false,
    intro: <>Here the lines are claims about truth in the standard model 𝔑, not derivability. Truth in a structure obeys propositional logic, so the same truth-table check applies.</>,
  },
};

/** The engine tags lines with the book's label names (G2-5, L-8); show the book's equation numbers instead. */
const BOOK_SECTION: Record<string, string> = { G2: '2in', L: 'lob' };
function bookTag(tag: string): string {
  const m = /^(G2|L)-(\d+)$/.exec(tag);
  return m ? labelText(`inc:inp:${BOOK_SECTION[m[1]]}:${tag}`) : tag;
}
function relabel(text: string): string {
  return text.replace(/\((G2|L)-(\d+)\)/g, (_m, p: string, n: string) => bookTag(`${p}-${n}`));
}

const COND_TEXT: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'If T ⊢ A, then T ⊢ Prov(⌜A⌝).',
  P2: 'T ⊢ Prov(⌜A → B⌝) → (Prov(⌜A⌝) → Prov(⌜B⌝)).',
  P3: 'T ⊢ Prov(⌜A⌝) → Prov(⌜Prov(⌜A⌝)⌝).',
};

function justText(j: Just): string {
  switch (j.r) {
    case 'hyp':
      return j.name;
    case 'logic':
      return j.from.length ? `logic, from ${j.from.join(', ')}` : 'logic';
    case 'P1':
      return `P1, from ${j.from}`;
    case 'Lob':
      return `Löb, from ${j.from}`;
    default:
      return j.r;
  }
}

export function ProvabilityProof({ which }: { which: ProofName }) {
  const spec = PROOFS[which];
  const [bookCites, setBookCites] = useState(false);
  const lines = useMemo(
    () => spec.lines().map((l) => (bookCites && l.bookFrom && l.just.r === 'logic' ? { ...l, just: { r: 'logic' as const, from: l.bookFrom } } : l)),
    [spec, bookCites],
  );
  const hasBookCites = useMemo(() => spec.lines().some((l) => l.bookFrom), [spec]);
  const hyps = useMemo(() => [...new Set(lines.flatMap((l) => (l.just.r === 'hyp' ? [l.just.name] : [])))], [lines]);
  const [cond, setCond] = useState({ P1: true, P2: true, P3: true });
  const [offHyps, setOffHyps] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<number>(lines[lines.length - 1].n);
  const checks = useMemo(() => checkProof(lines, { conditions: cond, hypotheses: new Set(hyps.filter((h) => !offHyps.has(h))) }), [lines, cond, hyps, offHyps]);
  const last = lines[lines.length - 1];
  const lastCheck = checks.get(last.n)!;
  const selLine = lines.find((l) => l.n === sel)!;
  const premises = new Set(selLine.just.r === 'logic' ? selLine.just.from : selLine.just.r === 'P1' ? [selLine.just.from] : []);

  return (
    <div className="workbench pv">
      <p className="wb-note">
        {spec.conditions ? (
          <>
            <Prov kind="checked">checked relative to the conditions</Prov> {spec.intro} Each step is verified mechanically: P1 applications and P2/P3 instances by their shape,
            propositional steps by a truth table in which every <Tex tex="\mathsf{Prov}(\ulcorner\dots\urcorner)" /> is an atom. The conditions themselves are not checked — the
            book asks us to take them on faith, and so does this workbench.
          </>
        ) : (
          <>
            <Prov kind="checked">checked relative to the hypotheses</Prov> {spec.intro} Each step is verified mechanically by a truth table in which{' '}
            <Tex tex="A" /> and <Tex tex="D(\ulcorner A\urcorner)" /> are atoms. The two hypotheses are not checked: the first comes from the fixed-point lemma and the truth of Q in 𝔑,
            the second is the assumption the proof refutes.
          </>
        )}
      </p>
      <fieldset className="hyp-toggles pv-toggles">
        <legend className="fi-label">{spec.conditions ? 'Conditions and hypotheses' : 'Hypotheses'}</legend>
        {spec.conditions &&
          (['P1', 'P2', 'P3'] as const).map((c) => (
            <label key={c} className={`hyp ${cond[c] ? 'on' : 'off'}`} title={COND_TEXT[c]}>
              <input type="checkbox" checked={cond[c]} onChange={(e) => setCond({ ...cond, [c]: e.target.checked })} />
              {c}
            </label>
          ))}
        {hasBookCites && (
          <label className="hyp on" title="Use the premises the book cites, where they differ from the checked version">
            <input type="checkbox" checked={bookCites} onChange={(e) => setBookCites(e.target.checked)} />
            the book’s citations
          </label>
        )}
        {hyps.map((h) => (
          <label key={h} className={`hyp ${offHyps.has(h) ? 'off' : 'on'}`}>
            <input
              type="checkbox"
              checked={!offHyps.has(h)}
              onChange={(e) => {
                const s = new Set(offHyps);
                if (e.target.checked) s.delete(h);
                else s.add(h);
                setOffHyps(s);
              }}
            />
            {h}
          </label>
        ))}
      </fieldset>

      <ol className="pv-lines" aria-label="Lines of the proof">
        {lines.map((l) => {
          const c = checks.get(l.n)!;
          return (
            <li key={l.n} className={`pv-line ${c.ok ? 'ok' : 'bad'} ${sel === l.n ? 'sel' : ''} ${premises.has(l.n) ? 'premise' : ''}`}>
              <button className="pv-row" onClick={() => setSel(l.n)} aria-pressed={sel === l.n} aria-label={`Line ${l.n}${l.book ? ` ${bookTag(l.book)}` : ''}: ${show(l.f)}. ${c.ok ? 'Justified' : 'Not justified'}.`}>
                <span className="pv-n">{l.n}</span>
                <span className="pv-book">{l.book ? bookTag(l.book) : l.just.r === 'P2' ? 'implicit' : ''}</span>
                <span className="pv-f">
                  <Tex tex={`${spec.judgement} ${tex(l.f)}`} />
                </span>
                <span className="pv-just">{justText(l.just)}</span>
                <span className="pv-status" aria-hidden>
                  {c.ok ? '✓' : '✗'}
                </span>
              </button>
              {sel === l.n && <LineDetail line={l} check={c} lines={lines} />}
            </li>
          );
        })}
      </ol>
      <p className={`pv-verdict ${lastCheck.ok ? 'ok' : 'bad'}`} aria-live="polite">
        {lastCheck.ok ? (
          <>
            ✓ The conclusion <Tex tex={tex(last.f)} /> is justified, using {[...lastCheck.uses].join('; ')}.
          </>
        ) : (
          <>✗ With these switched off, the conclusion is no longer justified by this proof. (That does not show it is underivable — only that this argument breaks.)</>
        )}
      </p>
    </div>
  );
}

function LineDetail({ line, check, lines }: { line: Line; check: LineCheck; lines: Line[] }) {
  const j = line.just;
  const byN = new Map(lines.map((l) => [l.n, l]));
  let body: ReactNode = null;
  if (j.r === 'hyp') body = <p>Given: {j.name}.</p>;
  else if (j.r === 'P1') {
    const p = byN.get(j.from);
    body = (
      <p>
        Condition P1 turns “<Tex tex={`T \\vdash ${p ? tex(p.f) : '?'}`} />” (line {j.from}) into “<Tex tex={`T \\vdash \\mathsf{Prov}(\\ulcorner ${p ? tex(p.f) : '?'} \\urcorner)`} />”. It is
        a rule about T: it applies to derivable sentences, not to assumptions.
      </p>
    );
  } else if (j.r === 'Lob') {
    body = <p>Löb’s theorem, used as a rule: from T ⊢ Prov(⌜A⌝) → A (line {j.from}) infer T ⊢ A.</p>;
  } else if (j.r === 'P2') {
    const inst = p2Instance(line.f);
    body = inst ? (
      <p>
        An instance of P2 with <Tex tex={`A \\equiv ${tex(inst.A)}`} /> and <Tex tex={`B \\equiv ${tex(inst.B)}`} />.
      </p>
    ) : null;
  } else if (j.r === 'P3') {
    const inst = p3Instance(line.f);
    body = inst ? (
      <p>
        An instance of P3 with <Tex tex={`A \\equiv ${tex(inst.A)}`} />.
      </p>
    ) : null;
  } else {
    const prem = j.from.map((n) => byN.get(n)).filter((l): l is Line => !!l);
    const claim = logicClaim(
      prem.map((p) => p.f),
      line.f,
    );
    body = (
      <>
        <p>
          Propositional logic: the sentence <Tex tex={tex(claim)} /> is a tautology when its atoms{' '}
          {check.truthTable ? (
            <>
              ({check.truthTable.atoms.map((a, i) => (
                <span key={a}>
                  {i > 0 && ', '}
                  <code>{a}</code>
                </span>
              ))}
              )
            </>
          ) : null}{' '}
          are treated as independent sentence letters{check.truthTable ? <> — true in all {check.truthTable.rows} rows</> : null}.
        </p>
        <TruthTable f={claim} />
      </>
    );
  }
  return (
    <div className="pv-detail">
      {body}
      {line.note && <p className="pv-note">{relabel(line.note)}</p>}
      {check.errors.map((e, i) => (
        <p key={i} className="pv-error">
          ✗ {e}
        </p>
      ))}
      {check.uses.size > 0 && (
        <p className="pv-uses">
          Rests on:{' '}
          {[...check.uses].map((u) => (
            <span key={u} className="pv-chip">
              {u}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function TruthTable({ f }: { f: PF }) {
  const [open, setOpen] = useState(false);
  const t = useMemo(() => (open ? truthTable(f) : null), [open, f]);
  return (
    <div className="pv-tt">
      <button className="linklike" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide the truth table' : 'Show the truth table'}
      </button>
      {open && !t && <p className="muted small">Too many atoms to display.</p>}
      {t && (
        <div className="pv-tt-wrap">
          <table className="pv-tt-table">
            <thead>
              <tr>
                {t.atoms.map((a) => (
                  <th key={a} scope="col">
                    {a}
                  </th>
                ))}
                <th scope="col">claim</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i} className={r.result ? '' : 'bad'}>
                  {r.values.map((v, k) => (
                    <td key={k}>{v ? 'T' : 'F'}</td>
                  ))}
                  <td>{r.result ? 'T' : 'F'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ writing your own proof

interface DraftLine {
  text: string;
  rule: 'logic' | 'P1' | 'P2' | 'P3' | 'Lob';
  from: string;
}

/** A proof editor: given lines, and lines the reader adds; each is checked as typed. */
export function ProvabilityEditor({ id, given, goal, children, lob = false }: { id: string; given: Line[]; goal: string; children?: ReactNode; lob?: boolean }) {
  const key = `ic.pv.${id}`;
  const [draft, setDraftState] = useState<DraftLine[]>(() => persisted<DraftLine[]>(key, [{ text: '', rule: 'logic', from: '' }]));
  const setDraft = (d: DraftLine[]) => {
    setDraftState(d);
    persist(key, d);
  };
  const goalF = useMemo(() => {
    const p = tryParsePF(goal);
    if (!p.ok) throw new Error(`bad goal ${goal}`);
    return p.value;
  }, [goal]);

  const parsed = draft.map((d) => tryParsePF(d.text));
  const lines: Line[] = [...given];
  draft.forEach((d, i) => {
    const p = parsed[i];
    if (!p.ok) return;
    const n = given.length + i + 1;
    const from = d.from
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((x) => Number.isInteger(x));
    const just: Just = d.rule === 'logic' ? { r: 'logic', from } : d.rule === 'P1' || d.rule === 'Lob' ? { r: d.rule, from: from[0] ?? -1 } : { r: d.rule };
    lines.push({ n, f: p.value, just });
  });
  const checks = checkProof(lines);
  const solved = lines.some((l) => l.n > given.length && checks.get(l.n)!.ok && eq(l.f, goalF));

  const update = (i: number, patch: Partial<DraftLine>) => setDraft(draft.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  return (
    <div className="workbench pv pv-editor">
      {children}
      <p className="wb-note">
        Goal: <Tex tex={`T \\vdash ${tex(goalF)}`} />. Type formulas as <code>Prov(G) -&gt; ~G</code>, <code>Con</code> (for <Tex tex="\lnot\mathsf{Prov}(\ulcorner\bot\urcorner)" />),{' '}
        <code>_|_</code>, <code>&amp;</code>, <code>|</code>, <code>&lt;-&gt;</code>. For “logic”{lob ? ', P1 and Löb' : ' and P1'}, give the numbers of the lines used.
      </p>
      <ol className="pv-lines">
        {given.map((l) => (
          <li key={l.n} className="pv-line ok given">
            <div className="pv-row static">
              <span className="pv-n">{l.n}</span>
              <span className="pv-book">given</span>
              <span className="pv-f">
                <Tex tex={`T \\vdash ${tex(l.f)}`} />
              </span>
              <span className="pv-just">{justText(l.just)}</span>
              <span className="pv-status">✓</span>
            </div>
          </li>
        ))}
        {draft.map((d, i) => {
          const n = given.length + i + 1;
          const p = parsed[i];
          const c = p.ok ? checks.get(n) : undefined;
          return (
            <li key={i} className={`pv-line ${c?.ok ? 'ok' : d.text ? 'bad' : ''}`}>
              <div className="pv-edit">
                <span className="pv-n">{n}</span>
                <input className="fi-field pv-input" value={d.text} onChange={(e) => update(i, { text: e.target.value })} aria-label={`Formula of line ${n}`} placeholder="formula" spellCheck={false} />
                <select value={d.rule} onChange={(e) => update(i, { rule: e.target.value as DraftLine['rule'] })} aria-label={`Rule of line ${n}`}>
                  <option value="logic">logic</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  {lob && <option value="Lob">Löb</option>}
                </select>
                {(d.rule === 'logic' || d.rule === 'P1' || d.rule === 'Lob') && (
                  <input className="fi-field pv-from" value={d.from} onChange={(e) => update(i, { from: e.target.value })} aria-label={`Lines used by line ${n}`} placeholder="from" />
                )}
                <button className="chip-btn" onClick={() => setDraft(draft.filter((_, k) => k !== i))} aria-label={`Delete line ${n}`}>
                  ×
                </button>
              </div>
              {d.text && (
                <div className="pv-edit-status" aria-live="polite">
                  {!p.ok ? (
                    <span className="pv-error">
                      {p.error} (at {p.pos})
                    </span>
                  ) : c?.ok ? (
                    <span className="pv-okmsg">
                      ✓ <Tex tex={tex(p.value)} />
                    </span>
                  ) : (
                    <span className="pv-error">✗ {c?.errors.join('; ')}</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="fi-row">
        <button className="chip-btn" onClick={() => setDraft([...draft, { text: '', rule: 'logic', from: '' }])}>
          Add a line
        </button>
        <button className="chip-btn" onClick={() => setDraft([{ text: '', rule: 'logic', from: '' }])}>
          Start over
        </button>
      </div>
      <p className={`pv-verdict ${solved ? 'ok' : ''}`} aria-live="polite">
        {solved ? (
          <>
            <Prov kind="checked" /> Every line checks and the goal is reached (relative to P1–P3 and the given lines).
          </>
        ) : (
          'The goal has not been reached by a checked line yet.'
        )}
      </p>
    </div>
  );
}

export { show as showPF };
