// Section "Incompleteness via the Halting Problem": where each hypothesis is used in the proofs,
// and what a theory representing Kleene's T proves about ∃z T(ē, ē, z) — for concrete e.
//
// The dependency analysis is authored (this edition's reading of the book's proofs), not a
// mechanical check. The table of indices is computed.

import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../coding';
import { Ref } from '../../formal/FormalText';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { enumerateK } from '../../engine/computability/ce';
import { computationRecord, describeCodeSize, encodeRecord, recordCodeSize } from '../../engine/computability/records';
import { decodeIndex, showDefinition } from '../../engine/computability/indices';
import { Big } from './shared';

type Hyp = 'rep' | 'consistent' | 'omega' | 'ce';

const HYPS: { id: Hyp; label: ReactNode; text: string }[] = [
  { id: 'rep', label: 'T represents the primitive recursive relations', text: 'In particular Kleene’s T(e, x, s): true instances are provable, false ones refutable.' },
  { id: 'ce', label: 'T is c.e.', text: 'The set of (Gödel numbers of) theorems of T is computably enumerable — e.g. T is axiomatizable.' },
  { id: 'consistent', label: 'T is consistent', text: 'T does not prove both a sentence and its negation.' },
  { id: 'omega', label: 'T is ω-consistent', text: 'If T proves ¬A(n̄) for every n, it does not prove ∃x A(x).' },
];

type Just = { hyp: Hyp } | { result: string } | { logic: string } | { anyOf: Just[] };

interface Step {
  id: string;
  claim: ReactNode;
  uses: Just[];
}

interface Result {
  id: string;
  title: ReactNode;
  label: string;
  statement: ReactNode;
  steps: Step[];
}

const consistentOrOmega: Just = { anyOf: [{ hyp: 'consistent' }, { hyp: 'omega' }] };
const TT = (a: string, b: string, c: string) => `\\mathsf{T}(${a}, ${b}, ${c})`;

const RESULTS: Result[] = [
  {
    id: 'undec',
    title: 'T is undecidable',
    label: 'inc:cpi:hal:thm:undecidable',
    statement: <>If T is ω-consistent and represents all primitive recursive relations, T is undecidable.</>,
    steps: [
      { id: 'u1', claim: <>There is a formula <Tex tex={TT('e', 'x', 's')} /> representing Kleene’s T in T.</>, uses: [{ hyp: 'rep' }] },
      { id: 'u2', claim: <>If <Tex tex="\varphi_e(e)\downarrow" />, then <Tex tex={`\\mathbf{T} \\vdash ${TT('\\bar e', '\\bar e', '\\bar k')}`} /> for some k, so <Tex tex={`\\mathbf{T} \\vdash \\exists z\\, ${TT('\\bar e', '\\bar e', 'z')}`} />.</>, uses: [{ hyp: 'rep' }, { logic: '∃Intro' }] },
      { id: 'u3', claim: <>If <Tex tex="\varphi_e(e)\uparrow" />, then <Tex tex={`\\mathbf{T} \\vdash \\lnot ${TT('\\bar e', '\\bar e', '\\bar k')}`} /> for every k.</>, uses: [{ hyp: 'rep' }] },
      { id: 'u4', claim: <>So if <Tex tex="\varphi_e(e)\uparrow" />, then <Tex tex={`\\mathbf{T} \\nvdash \\exists z\\, ${TT('\\bar e', '\\bar e', 'z')}`} />.</>, uses: [{ hyp: 'omega' }] },
      { id: 'u5', claim: <><Tex tex="e \in K" /> iff <Tex tex={`\\mathbf{T} \\vdash \\exists z\\, ${TT('\\bar e', '\\bar e', 'z')}`} />: a decision procedure for T would decide K.</>, uses: [{ logic: 'steps 2 and 4' }] },
      { id: 'u6', claim: <>But K is not decidable.</>, uses: [{ result: 'K' }] },
    ],
  },
  {
    id: 'compdec',
    title: 'Complete, consistent, c.e. ⇒ decidable',
    label: 'inc:cpi:hal:thm:complete-decidable',
    statement: <>If T is a complete consistent c.e. theory, T is decidable.</>,
    steps: [
      { id: 'c1', claim: 'List the theorems of T one by one.', uses: [{ hyp: 'ce' }] },
      { id: 'c2', claim: <>Given A, wait until A or ¬A is listed; one of them will be, since T is complete.</>, uses: [{ logic: 'completeness (the theorem’s own assumption)' }] },
      { id: 'c3', claim: <>If ¬A is listed, A is not a theorem.</>, uses: [consistentOrOmega] },
      { id: 'c4', claim: <>Formally: the non-theorems form a c.e. set, and a set that is c.e. with c.e. complement is computable.</>, uses: [{ result: 'exists' }, { result: 'cecomp' }] },
    ],
  },
  {
    id: 'incomplete',
    title: 'T is incomplete',
    label: 'inc:cpi:hal:sec',
    statement: <>If T is ω-consistent, c.e., and represents all primitive recursive relations, T is incomplete.</>,
    steps: [
      { id: 'i1', claim: 'Suppose T were complete.', uses: [{ logic: 'for a contradiction' }] },
      { id: 'i2', claim: 'T is consistent (ω-consistent theories are).', uses: [consistentOrOmega] },
      { id: 'i3', claim: 'So T is decidable.', uses: [{ result: 'compdec' }] },
      { id: 'i4', claim: 'But T is undecidable.', uses: [{ result: 'undec' }] },
    ],
  },
  {
    id: 'g1',
    title: 'An explicit undecided sentence',
    label: 'inc:cpi:hal:thm:g1',
    statement: (
      <>
        <Tex tex={`G = \\lnot\\exists z\\, ${TT('\\bar k', '\\bar k', 'z')}`} />, where k is an index of g: “search the enumeration of T for a proof of{' '}
        <Tex tex={`\\lnot\\exists z\\, ${TT('\\bar e', '\\bar e', 'z')}`} />, halt if found”.
      </>
    ),
    steps: [
      { id: 'g1', claim: <>g is partial computable, so it has an index k; <Tex tex="g(e)\downarrow" /> iff <Tex tex={`\\mathbf{T} \\vdash \\lnot\\exists z\\, ${TT('\\bar e', '\\bar e', 'z')}`} />.</>, uses: [{ hyp: 'ce' }] },
      { id: 'g2', claim: <>If <Tex tex="g(k)\downarrow" />: T proves G, and (representing T) also <Tex tex={`\\exists z\\, ${TT('\\bar k', '\\bar k', 'z')}`} />.</>, uses: [{ hyp: 'rep' }] },
      { id: 'g3', claim: <>That is a contradiction, so <Tex tex="g(k)\uparrow" /> and <Tex tex="\mathbf{T} \nvdash G" />.</>, uses: [consistentOrOmega] },
      { id: 'g4', claim: <>Since <Tex tex="g(k)\uparrow" />, T refutes every instance <Tex tex={TT('\\bar k', '\\bar k', '\\bar m')} />.</>, uses: [{ hyp: 'rep' }] },
      { id: 'g5', claim: <>So <Tex tex={`\\mathbf{T} \\nvdash \\exists z\\, ${TT('\\bar k', '\\bar k', 'z')}`} />, and T does not prove ¬G either.</>, uses: [{ hyp: 'omega' }] },
    ],
  },
];

const EXTERNAL: Record<string, { label: string }> = {
  K: { label: 'cmp:thy:ncp:thm:K' },
  exists: { label: 'cmp:thy:eqc:thm:exists-char' },
  cecomp: { label: 'cmp:thy:cmp:thm:ce-comp' },
};

export function CpiExplorer() {
  const [on, setOn] = useState<Record<Hyp, boolean>>({ rep: true, ce: true, consistent: true, omega: true });
  const [open, setOpen] = useState('incomplete');
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
    <Panel n={1} title="Where each hypothesis is used" prov={<Prov kind="added">authored analysis</Prov>}>
      <p className="wb-note">
        The steps paraphrase the proofs in <Ref k="inc:cpi:hal:sec" />; which step uses which hypothesis is this edition’s reading of them, not a mechanical check. Switch a
        hypothesis off to see which steps lose their justification.
      </p>
      <fieldset className="hyp-toggles">
        <legend className="fi-label">Hypotheses about the theory T</legend>
        {HYPS.map((h) => (
          <label key={h.id} className={`hyp ${on[h.id] ? 'on' : 'off'}`} title={h.text}>
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
              <span className="g1-ref">
                <Ref k={r.label} />
              </span>
            </button>
          );
        })}
      </div>
      <section className="g1-detail" aria-live="polite">
        <h3>
          <span>{current.title}</span> {status.res.get(current.id) ? <span className="support ok">supported by the hypotheses</span> : <span className="support broken">no longer supported</span>}
        </h3>
        <p>{current.statement}</p>
        <ol className="g1-steps">
          {current.steps.map((s) => (
            <li key={s.id} className={status.stepOk.get(s.id) ? 'ok' : 'broken'}>
              <span className="g1-claim">{s.claim}</span>
              <span className="g1-uses">
                {s.uses.map((u, i) => (
                  <JustChip key={i} j={u} ok={status.justOk(u)} />
                ))}
              </span>
            </li>
          ))}
        </ol>
        {current.id === 'incomplete' && on.rep && on.ce && !on.omega && on.consistent && (
          <p className="caveat">
            <strong>Consistency is not enough for this proof.</strong> Step 4 of the undecidability theorem uses ω-consistency to rule out a proof of{' '}
            <Tex tex="\exists z\, \mathsf{T}(\bar e, \bar e, z)" /> for a non-halting e.
          </p>
        )}
      </section>
    </Panel>
  );
}

function JustChip({ j, ok }: { j: Just; ok: boolean }) {
  if ('hyp' in j) {
    const h = HYPS.find((x) => x.id === j.hyp)!;
    return <span className={`just hyp ${ok ? 'ok' : 'broken'}`}>{h.label}</span>;
  }
  if ('logic' in j) return <span className="just logic">{j.logic}</span>;
  if ('anyOf' in j) return <span className={`just any ${ok ? 'ok' : 'broken'}`}>consistency (ω-consistency implies it)</span>;
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

/** What a theory T that represents Kleene's T proves about ∃z T(ē, ē, z), for the first indices. */
export function KSentencesTable() {
  const [n, setN] = useState(100);
  const k = useMemo(() => enumerateK(Math.max(n, 200)), [n]);
  const rows = useMemo(
    () =>
      k.members.slice(0, n).map((m, e) => {
        const d = decodeIndex(BigInt(e));
        return { e, m, def: d.ok && d.arity === 1 ? showDefinition(d.rf) : null };
      }),
    [k, n],
  );
  const interesting = rows.filter((r) => r.def !== null);
  return (
    <Panel n={2} title={<>The sentences <Tex tex="\exists z\,\mathsf{T}(\bar e, \bar e, z)" />, for small e</>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        For each index e of a one-place definition below {n}: what running <Tex tex="\varphi_e(e)" /> establishes, and what the theorem (<Ref k="inc:cpi:hal:case:def" />,{' '}
        <Ref k="inc:cpi:hal:case:undef" />) then says T proves. The other indices are not one-place definitions: <Tex tex="\varphi_e(e)\uparrow" />, known from e alone.
      </p>
      <div className="ct-controls">
        <label>
          indices below{' '}
          <select className="fi-examples" value={n} onChange={(ev) => setN(Number(ev.target.value))} aria-label="indices below">
            {[40, 100, 200, 400].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="row" scope="col">
                e
              </th>
              <th scope="col">definition</th>
              <th scope="col">
                <Tex tex="\varphi_e(e)" />
              </th>
              <th scope="col">what T proves</th>
            </tr>
          </thead>
          <tbody>
            {interesting.map(({ e, m, def }) => (
              <tr key={e}>
                <th className="row" scope="row">
                  {e}
                </th>
                <td className="left">
                  <code className="ct-deftext">{def}</code>
                </td>
                <td>{m.kind === 'in' ? <span className="ct-o value">↓ {m.value.toString()}</span> : m.kind === 'out' ? <span className="ct-o undef">↑</span> : <span className="ct-o fuel">?</span>}</td>
                <td className="wrap sans">
                  {m.kind === 'in' ? (
                    <>
                      <Tex tex={`\\mathbf{T} \\vdash \\mathsf{T}(\\overline{${e}}, \\overline{${e}}, \\bar s)`} /> for the record s <Witness e={BigInt(e)} />, hence <Tex tex="\exists z\,\mathsf{T}" />
                    </>
                  ) : m.kind === 'out' ? (
                    <>
                      <Tex tex={`\\mathbf{T} \\vdash \\lnot\\mathsf{T}(\\overline{${e}}, \\overline{${e}}, \\bar s)`} /> for every s; if T is ω-consistent, <Tex tex="\mathbf{T} \nvdash \exists z\,\mathsf{T}" />
                    </>
                  ) : (
                    'not known from this run'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NotAProof>
        The table settles finitely many rows, each by a finite computation plus the representability theorem. If T were complete, consistent and c.e., its theorems would
        settle <em>every</em> row by a search — deciding K, which is impossible.
      </NotAProof>
    </Panel>
  );
}

function Witness({ e }: { e: bigint }) {
  const r = computationRecord(e, e, 5000);
  if (r.kind !== 'halted') return null;
  const s = encodeRecord(r.root, 10);
  return <span className="ct-size">({s !== null ? <Big n={s} max={16} /> : describeCodeSize(recordCodeSize(r.root)).text})</span>;
}
