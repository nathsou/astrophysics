// Section "The Syntax of the Lambda Calculus": the conventions (abbreviated vs official syntax),
// free and bound variables, α-equivalence; section "Reduction": substitution M[N/x].

import { useMemo, useState } from 'react';
import {
  alphaEq,
  alphaRename,
  allNames,
  freeFor,
  freeVars,
  freshName,
  naiveSubstitute,
  nodeById,
  substitute,
  VAR_NAME,
  type Abs,
  type NodeId,
  type Term,
} from '../../engine/lambda/lambda';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { TermView } from './TermView';
import { TermInput, TermTex, useParsedLambda, ParseError } from './shared';
import './lambda.css';

const SYNTAX_PRESETS = [
  {
    group: 'From the text',
    items: [
      { src: 'λxy.xxyx λz.xz', label: 'λxy.xxyx λz.xz (the book’s example)' },
      { src: '(λz.yz)x', label: '(λz.yz)x — y and x free, z bound' },
      { src: 'λx.x', label: 'λx.x' },
      { src: 'mnpq', label: 'mnpq — application associates to the left: ((mn)p)q' },
    ],
  },
];

/** Abbreviated and official syntax, free and bound variables, and α-renaming of a chosen binder. */
export function SyntaxLab() {
  const [src, setSrc] = useState('λxy.xxyx λz.xz');
  const [single, setSingle] = useState(true);
  const parsed = useParsedLambda(src, single);
  const [renamed, setRenamed] = useState<{ base: Term; term: Term } | null>(null);
  const [binder, setBinder] = useState<{ id: NodeId; name: string; error?: string } | null>(null);
  const term = parsed.ok ? (renamed && renamed.base === parsed.value ? renamed.term : parsed.value) : null;
  const fv = term ? [...freeVars(term)] : [];
  const bound = term ? [...allNames(term)].filter((x) => hasBinder(term, x)) : [];
  const abs = binder && term ? (nodeById(term, binder.id) as Abs | null) : null;
  return (
    <Panel n={1} title="Reading a λ-term" prov={<Prov kind="computed" />}>
      <TermInput value={src} onChange={(s) => { setSrc(s); setRenamed(null); setBinder(null); }} label="Term" parsed={parsed} presets={SYNTAX_PRESETS} singleLetter={single} onSingleLetter={setSingle} />
      {term && (
        <>
          <dl className="lam-kv">
            <dt>as written (conventions)</dt>
            <dd>
              <TermTex term={term} />
            </dd>
            <dt>official syntax</dt>
            <dd>
              <TermTex term={term} opts={{ parens: 'full' }} />
            </dd>
            <dt>free variables</dt>
            <dd>{fv.length ? fv.map((x) => <i key={x}>{x} </i>) : 'none: the term is closed'}</dd>
            <dt>bound (λ-bound names)</dt>
            <dd>{bound.length ? bound.map((x) => <i key={x}>{x} </i>) : 'none'}</dd>
          </dl>
          <p className="wb-note">Hover a variable to see the λ that binds it (free variables are shown in orange). Click a bound variable after a λ to rename it.</p>
          <TermView term={term} onBinder={(id) => { const a = nodeById(term, id) as Abs; setBinder({ id, name: freshName(a.param, allNames(term)) }); }} ariaLabel="The term" />
          {binder && abs && (
            <form
              className="lam-rename"
              onSubmit={(e) => {
                e.preventDefault();
                const r = alphaRename(term, binder.id, binder.name.trim());
                if (!r.ok) setBinder({ ...binder, error: r.error });
                else {
                  setRenamed({ base: parsed.ok ? parsed.value : term, term: r.result });
                  setBinder(null);
                }
              }}
            >
              <span>
                Rename the bound <i>{abs.param}</i> to
              </span>
              <input aria-label="New name" value={binder.name} onChange={(e) => setBinder({ ...binder, name: e.target.value, error: undefined })} autoFocus spellCheck={false} />
              <button className="chip-btn primary" type="submit">
                Rename
              </button>
              <button className="chip-btn" type="button" onClick={() => setBinder(null)}>
                Cancel
              </button>
              {binder.error && (
                <span className="fi-error" role="alert" style={{ flexBasis: '100%' }}>
                  Not an α-conversion: {binder.error}.
                </span>
              )}
            </form>
          )}
          {renamed && parsed.ok && (
            <p className="wb-note" aria-live="polite">
              After renaming: <TermTex term={term} /> — α-equivalent to the term you typed: {alphaEq(term, parsed.value) ? 'yes' : 'no'}.{' '}
              <button type="button" className="linklike" onClick={() => setRenamed(null)}>
                undo
              </button>
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function hasBinder(t: Term, x: string): boolean {
  switch (t.k) {
    case 'var':
      return false;
    case 'app':
      return hasBinder(t.fn, x) || hasBinder(t.arg, x);
    case 'abs':
      return t.param === x || hasBinder(t.body, x);
  }
}

/** Are two terms α-equivalent? */
export function AlphaCompare() {
  const [a, setA] = useState('λx.λy.x y');
  const [b, setB] = useState('λy.λx.y x');
  const pa = useParsedLambda(a);
  const pb = useParsedLambda(b);
  const eq = pa.ok && pb.ok ? alphaEq(pa.value, pb.value) : null;
  return (
    <Panel n={2} title="α-equivalent?" prov={<Prov kind="computed" />}>
      <div className="lam-row" style={{ alignItems: 'stretch', flexDirection: 'column' }}>
        <input className={`lam-field ${pa.ok ? '' : 'invalid'}`} value={a} onChange={(e) => setA(e.target.value)} aria-label="First term" spellCheck={false} />
        <ParseError src={a} r={pa} />
        <input className={`lam-field ${pb.ok ? '' : 'invalid'}`} value={b} onChange={(e) => setB(e.target.value)} aria-label="Second term" spellCheck={false} />
        <ParseError src={b} r={pb} />
      </div>
      {eq !== null && pa.ok && pb.ok && (
        <p className={`lam-status ${eq ? 'ok' : 'warn'}`} aria-live="polite">
          {eq ? 'α-equivalent: they differ at most in the names of bound variables.' : 'Not α-equivalent.'}{' '}
          {!eq && sameShapeHint(pa.value, pb.value)}
        </p>
      )}
    </Panel>
  );
}

function sameShapeHint(a: Term, b: Term): string {
  const fa = [...freeVars(a)].sort().join(', ');
  const fb = [...freeVars(b)].sort().join(', ');
  if (fa !== fb) return `Their free variables differ ({${fa}} and {${fb}}), and renaming bound variables never changes free ones.`;
  return 'Renaming bound variables cannot turn one into the other: some variable is bound by a different λ, or the shapes differ.';
}

// ------------------------------------------------------------------ substitution

const SUBST_PRESETS: { m: string; x: string; n: string; label: string }[] = [
  { m: 'λw.x x w', x: 'x', n: 'y y z', label: 'the book’s example (λw.xxw)[yyz/x]' },
  { m: 'λy.x y', x: 'x', n: 'y', label: 'a capture hazard (λy.xy)[y/x]' },
  { m: 'λz.x (λx.x) z', x: 'x', n: 'w', label: 'a λx stops the substitution' },
  { m: 'λy.λy2.x y y2', x: 'x', n: 'y y2', label: 'two renamings' },
];

/** M[N/x] with the book's renaming, next to naive replacement. */
export function SubstPanel() {
  const [k, setK] = useState(0);
  const [m, setM] = useState(SUBST_PRESETS[0]!.m);
  const [x, setX] = useState(SUBST_PRESETS[0]!.x);
  const [n, setN] = useState(SUBST_PRESETS[0]!.n);
  const pm = useParsedLambda(m);
  const pn = useParsedLambda(n);
  const xOk = VAR_NAME.test(x);
  const res = useMemo(() => (pm.ok && pn.ok && xOk ? { good: substitute(pm.value, x, pn.value), naive: naiveSubstitute(pm.value, x, pn.value), ff: freeFor(pn.value, x, pm.value) } : null), [pm, pn, x, xOk]);
  const marks = useMemo(() => {
    if (!res) return undefined;
    const copies = new Set<NodeId>();
    const renamed = new Set<NodeId>(res.good.renamed.map((r) => r.binder));
    for (const [id, o] of res.good.origin) {
      if (o.via === 'term') copies.add(id);
      if (o.via === 'renamed') renamed.add(id);
    }
    return { copies, renamed };
  }, [res]);
  const naiveCopies = useMemo(() => {
    const s = new Set<NodeId>();
    if (res) for (const [id, o] of res.naive.origin) if (o.via === 'term') s.add(id);
    return s;
  }, [res]);
  return (
    <Panel n="[/]" title="Substitution M[N/x]" prov={<Prov kind="computed" />}>
      <select
        className="lam-select"
        value={k}
        onChange={(e) => {
          const i = Number(e.target.value);
          setK(i);
          setM(SUBST_PRESETS[i]!.m);
          setX(SUBST_PRESETS[i]!.x);
          setN(SUBST_PRESETS[i]!.n);
        }}
        aria-label="Example"
      >
        {SUBST_PRESETS.map((p, i) => (
          <option key={i} value={i}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="lam-row" style={{ alignItems: 'flex-end' }}>
        <label style={{ flex: '2 1 180px', flexDirection: 'column', alignItems: 'stretch' }}>
          <span className="fi-label lam-mathlabel">M</span>
          <input className={`lam-field ${pm.ok ? '' : 'invalid'}`} value={m} onChange={(e) => setM(e.target.value)} spellCheck={false} />
        </label>
        <label style={{ flex: '0 1 80px', flexDirection: 'column', alignItems: 'stretch' }}>
          <span className="fi-label lam-mathlabel">x</span>
          <input className={`lam-field ${xOk ? '' : 'invalid'}`} value={x} onChange={(e) => setX(e.target.value.trim())} spellCheck={false} />
        </label>
        <label style={{ flex: '2 1 180px', flexDirection: 'column', alignItems: 'stretch' }}>
          <span className="fi-label lam-mathlabel">N</span>
          <input className={`lam-field ${pn.ok ? '' : 'invalid'}`} value={n} onChange={(e) => setN(e.target.value)} spellCheck={false} />
        </label>
      </div>
      <ParseError src={m} r={pm} />
      <ParseError src={n} r={pn} />
      {!xOk && <p className="fi-error">x must be a variable (a lowercase letter, then letters, digits, _ or ′).</p>}
      {res && pm.ok && pn.ok && (
        <>
          <p className="wb-note">
            <Tex tex={`M[N/${x}]`} />, renaming bound variables of M that would capture free variables of N (the book’s definition):
          </p>
          <TermView term={res.good.result} marks={marks} ariaLabel="The result of the substitution" />
          <div className="lam-legend" aria-hidden="true">
            <span>
              <i className="k-copy" /> copy of N
            </span>
            <span>
              <i className="k-renamed" /> renamed
            </span>
          </div>
          {res.good.steps.length > 0 ? (
            <ol className="lam-trace">
              {res.good.steps.map((s, i) => (
                <li key={i} className={`k-${s.kind}`}>
                  {s.note}
                </li>
              ))}
            </ol>
          ) : (
            <p className="wb-note">
              <i>{x}</i> has no free occurrence in M: nothing changes.
            </p>
          )}
          <p className={`lam-status ${res.ff.ok ? 'ok' : 'warn'}`} aria-live="polite">
            {res.ff.ok
              ? `N is free for ${x} in M: no renaming was needed, and naive replacement gives the same term.`
              : `N is not free for ${x} in M: ${res.ff.hazards.length} occurrence${res.ff.hazards.length === 1 ? '' : 's'} of ${x} lie under a λ binding a free variable of N.`}
          </p>
          {!res.ff.ok && (
            <>
              <p className="wb-note">Naive replacement, for comparison — the free {[...new Set(res.naive.captures.map((c) => c.variable))].join(', ')} of N get captured:</p>
              <TermView term={res.naive.result} marks={{ copies: naiveCopies }} ariaLabel="Naive replacement" />
              <p className="wb-note">
                α-equivalent to the correct result? <b>{alphaEq(res.naive.result, res.good.result) ? 'yes' : 'no'}</b> — naive replacement gives a different term.
              </p>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
