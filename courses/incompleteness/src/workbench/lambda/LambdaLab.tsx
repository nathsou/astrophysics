// The Lambda Lab: enter a term (or pick one of the book's), contract any redex by clicking its λ,
// or let a strategy step or run with a fuel limit; every step shows the substitution it performed
// (with the renamings that avoid capture), binders can be α-renamed, and the reduction graph of a
// small term can be drawn. All mathematics is the engine's (src/engine/lambda).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  allNames,
  alphaRename,
  contract,
  freshName,
  naiveSubstitute,
  nodeById,
  print,
  redexes,
  step,
  strategyRedex,
  STRATEGY_NAMES,
  type Abs,
  type Contraction,
  type LambdaPrintOptions,
  type NodeId,
  type Redex,
  type RunStatus,
  type Strategy,
  type Term,
} from '../../engine/lambda/lambda';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { useStore } from '../../ui/store';
import { TermInline, TermView, type TermMarks } from './TermView';
import { GraphView } from './GraphView';
import { runChunked, statusText } from './run';
import { BOOK_EXAMPLES, labRequest, NAMED_PRESETS, TermInput, TermTex, clampInt, statusClass, useParsedLambda } from './shared';
import './lambda.css';

type How = null | { kind: 'beta'; c: Contraction; by: Strategy | 'manual' } | { kind: 'alpha'; binder: NodeId; from: string; to: string; renamed: NodeId[] };

interface Entry {
  term: Term;
  how: How;
}

const STRATEGY_HELP: Record<Strategy, string> = {
  normal: 'Contract the leftmost-outermost redex. If a term has a normal form at all, this strategy reaches it (a standard theorem, not proved in the book).',
  applicative: 'Contract the leftmost-innermost redex: work inside arguments before using them. It can run forever on a term that has a normal form.',
  cbn: 'Call by name: contract only the head redex — never under a λ, never inside an argument. It stops at a weak head normal form.',
  cbv: 'Call by value: never under a λ; contract (λx.M)N only when N is a value (a variable or a λ), function part first, then the argument.',
};

const STEP_LABEL = { rename: 'Rename', replace: 'Replace', 'binder-stop': 'Stop', capture: 'Capture' } as const;

const SHORT: Record<Strategy, string> = { normal: 'normal', applicative: 'applicative', cbn: 'by name', cbv: 'by value' };

export function LambdaLab({ initial = 'K I Ω', id = 'lambda-lab', graph = true, initialStrategy = 'normal' as Strategy }: { initial?: string; id?: string; graph?: boolean; initialStrategy?: Strategy }) {
  const [src, setSrc] = useState(initial);
  const [single, setSingle] = useState(false);
  const parsed = useParsedLambda(src, single);
  const [history, setHistory] = useState<Entry[]>(() => (parsed.ok ? [{ term: parsed.value, how: null }] : []));
  const [cursor, setCursor] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [fuelText, setFuelText] = useState('200');
  const [status, setStatus] = useState<{ text: string; kind: RunStatus | 'running' | 'info' } | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const [labels, setLabels] = useState(true);
  const [numerals, setNumerals] = useState(true);
  const [full, setFull] = useState(false);
  const [hoverRedex, setHoverRedex] = useState<NodeId | null>(null);
  const [renaming, setRenaming] = useState<{ binder: NodeId; name: string; error?: string } | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  // A new source term starts a new history.
  const lastParsed = useRef(parsed);
  useEffect(() => {
    if (lastParsed.current === parsed) return;
    lastParsed.current = parsed;
    if (!parsed.ok) return;
    cancel.current?.();
    setRunning(null);
    setHistory([{ term: parsed.value, how: null }]);
    setCursor(0);
    setStatus(null);
    setRenaming(null);
  }, [parsed]);

  // Requests from other panels on the page ("step through it in the Lambda Lab").
  const req = useStore(labRequest);
  useEffect(() => {
    if (req) {
      setSingle(false);
      setSrc(req.src);
    }
  }, [req]);

  useEffect(() => () => cancel.current?.(), []);

  const opts: LambdaPrintOptions = useMemo(() => ({ labels, numerals, parens: full ? 'full' : 'minimal' }), [labels, numerals, full]);
  const entry = history[cursor];
  const term = entry?.term;
  const rs = useMemo(() => (term ? redexes(term) : []), [term]);
  const picks = useMemo(() => {
    const m = new Map<NodeId, Strategy[]>();
    if (!term) return m;
    for (const s of ['normal', 'applicative', 'cbn', 'cbv'] as Strategy[]) {
      const r = strategyRedex(term, s);
      if (r) m.set(r, [...(m.get(r) ?? []), s]);
    }
    return m;
  }, [term]);
  const next = term ? strategyRedex(term, strategy) : null;
  const fuel = clampInt(fuelText, 1, 5000, 200);

  const push = (entries: Entry[]) => {
    setHistory((h) => [...h.slice(0, cursor + 1), ...entries]);
    setCursor(cursor + entries.length);
    setRenaming(null);
  };

  const manual = (r: Redex) => {
    if (!term || running !== null) return;
    const c = contract(term, r.id);
    push([{ term: c.result, how: { kind: 'beta', c, by: 'manual' } }]);
    setStatus({ text: `Contracted the redex (λ${r.param}.…) …${r.leftmostOutermost ? ' — the leftmost-outermost one, as normal order would.' : '.'}`, kind: 'info' });
  };

  const doStep = () => {
    if (!term || running !== null) return;
    const c = step(term, strategy);
    if (!c) {
      const st: RunStatus = rs.length === 0 ? 'normal-form' : 'stopped';
      setStatus({ text: statusText(st, 0, STRATEGY_NAMES[strategy]), kind: st });
      return;
    }
    push([{ term: c.result, how: { kind: 'beta', c, by: strategy } }]);
    setStatus({ text: `One ${STRATEGY_NAMES[strategy]} step.`, kind: 'info' });
  };

  const doRun = () => {
    if (!term || running !== null) return;
    setRunning(0);
    setStatus({ text: 'Running…', kind: 'running' });
    const base = cursor;
    cancel.current = runChunked(
      term,
      strategy,
      { fuel, maxSize: 4000, trace: true },
      (n) => setRunning(n),
      (r) => {
        cancel.current = null;
        setRunning(null);
        const entries: Entry[] = r.steps.map((c) => ({ term: c.result, how: { kind: 'beta', c, by: strategy } }));
        setHistory((h) => [...h.slice(0, base + 1), ...entries]);
        setCursor(base + entries.length);
        setRenaming(null);
        setStatus({ text: `${STRATEGY_NAMES[strategy][0]!.toUpperCase()}${STRATEGY_NAMES[strategy].slice(1)}: ${statusText(r.status, r.count, STRATEGY_NAMES[strategy])}`, kind: r.status });
      },
    );
  };

  const stop = () => {
    cancel.current?.();
    cancel.current = null;
    setRunning(null);
    setStatus({ text: 'Stopped by you. Nothing follows about whether the term has a normal form.', kind: 'out-of-fuel' });
  };

  const startRename = (binder: NodeId) => {
    if (!term || running !== null) return;
    const abs = nodeById(term, binder) as Abs | null;
    if (!abs || abs.k !== 'abs') return;
    setRenaming({ binder, name: freshName(abs.param, allNames(term)) });
  };
  const doRename = () => {
    if (!term || !renaming) return;
    const r = alphaRename(term, renaming.binder, renaming.name.trim().replace(/′/g, "'"));
    if (!r.ok) {
      setRenaming({ ...renaming, error: r.error });
      return;
    }
    if (r.from === r.to) {
      setRenaming(null);
      return;
    }
    push([{ term: r.result, how: { kind: 'alpha', binder: r.binder, from: r.from, to: r.to, renamed: r.occurrences } }]);
    setStatus({ text: `α-conversion: the bound ${r.from} is now ${r.to} (${r.occurrences.length} occurrence${r.occurrences.length === 1 ? '' : 's'} renamed). The term is α-equivalent to the previous one.`, kind: 'info' });
  };

  const marks: TermMarks | undefined = useMemo(() => {
    const how = entry?.how;
    if (!how) return undefined;
    if (how.kind === 'alpha') return { renamed: new Set([how.binder, ...how.renamed]) };
    const copies = new Set<NodeId>();
    const renamed = new Set<NodeId>(how.c.subst.renamed.map((r) => r.binder));
    for (const [k, o] of how.c.subst.origin) {
      if (o.via === 'term') copies.add(k);
      else if (o.via === 'renamed') renamed.add(k);
    }
    return { contractum: how.c.contractum.id, copies, renamed };
  }, [entry]);

  const renamingAbs = renaming && term ? (nodeById(term, renaming.binder) as Abs | null) : null;

  return (
    <div className="workbench" id={id}>
      <Panel n={1} title="A λ-term" prov={<Prov kind="computed" />}>
        <TermInput
          value={src}
          onChange={setSrc}
          label="Term"
          parsed={parsed}
          presets={[
            { group: 'Examples from the text', items: BOOK_EXAMPLES },
            { group: 'Named terms of the book', items: NAMED_PRESETS },
          ]}
          singleLetter={single}
          onSingleLetter={setSingle}
        />
        <div className="lam-controls" role="group" aria-label="Display">
          <label>
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> show names (K, Succ, Y, …)
          </label>
          <label>
            <input type="checkbox" checked={numerals} onChange={(e) => setNumerals(e.target.checked)} /> show Church numerals as n̄
          </label>
          <label>
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> official syntax (all parentheses)
          </label>
        </div>
      </Panel>

      {term && (
        <Panel n={2} title={cursor === 0 ? 'Reduce it' : `After step ${cursor}`} prov={<Prov kind="computed" />}>
          <TermView term={term} opts={opts} redexes={rs} onContract={manual} onBinder={startRename} next={next} highlight={hoverRedex} marks={marks} ariaLabel="The current term" />
          <div className="lam-legend" aria-hidden="true">
            <span>
              <b style={{ color: 'var(--formula)' }}>λ</b> underlined: a redex — click to contract it
            </span>
            <span>
              <i className="k-next" /> the redex {SHORT[strategy]} order takes next
            </span>
            <span>binder: hover to see what it binds, click to rename</span>
            <span>
              <i className="k-free">x</i> free variable
            </span>
            {marks?.copies && (
              <span>
                <i className="k-copy" /> copy of the argument
              </span>
            )}
            {marks?.renamed && marks.renamed.size > 0 && (
              <span>
                <i className="k-renamed" /> renamed
              </span>
            )}
          </div>

          {renaming && renamingAbs && (
            <form
              className="lam-rename"
              onSubmit={(e) => {
                e.preventDefault();
                doRename();
              }}
            >
              <span>
                Rename the bound variable <i>{renamingAbs.param}</i> of this λ to
              </span>
              <input aria-label="New name" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value, error: undefined })} autoFocus spellCheck={false} />
              <button className="chip-btn primary" type="submit">
                Rename
              </button>
              <button className="chip-btn" type="button" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              {renaming.error && (
                <span className="fi-error" role="alert" style={{ flexBasis: '100%' }}>
                  Not an α-conversion: {renaming.error}.
                </span>
              )}
            </form>
          )}

          <p className="wb-note">
            {rs.length === 0 ? (
              <>
                <b>β-normal:</b> no redexes left.
              </>
            ) : (
              <>
                {rs.length} redex{rs.length === 1 ? '' : 'es'}. Click a highlighted λ in the term, or one below.
              </>
            )}
          </p>
          {rs.length > 0 && (
            <ul className="lam-redexes">
              {rs.slice(0, 24).map((r) => {
                const sub = nodeById(term, r.id)!;
                return (
                  <li key={r.id} onMouseEnter={() => setHoverRedex(r.id)} onMouseLeave={() => setHoverRedex(null)}>
                    <button type="button" className="lam-redex-btn" onClick={() => manual(r)} onFocus={() => setHoverRedex(r.id)} onBlur={() => setHoverRedex(null)} disabled={running !== null}>
                      <TermInline term={sub} opts={opts} max={90} />
                    </button>
                    {(picks.get(r.id) ?? []).map((s) => (
                      <span key={s} className={`lam-tag ${s === strategy ? 'strong' : ''}`}>
                        {SHORT[s]}
                      </span>
                    ))}
                    {r.underLambda && <span className="lam-tag">under λ</span>}
                  </li>
                );
              })}
              {rs.length > 24 && <li className="wb-note">…and {rs.length - 24} more.</li>}
            </ul>
          )}

          <div className="seg" role="radiogroup" aria-label="Strategy">
            {(['normal', 'applicative', 'cbn', 'cbv'] as Strategy[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={strategy === s} className="chip-btn" aria-pressed={strategy === s} onClick={() => setStrategy(s)}>
                {s === 'normal' ? 'Normal order' : s === 'applicative' ? 'Applicative order' : s === 'cbn' ? 'Call by name' : 'Call by value'}
              </button>
            ))}
          </div>
          <p className="wb-note">{STRATEGY_HELP[strategy]}</p>
          <div className="lam-controls">
            <button type="button" className="chip-btn primary" onClick={doStep} disabled={running !== null}>
              Step
            </button>
            <button type="button" className="chip-btn" onClick={doRun} disabled={running !== null}>
              Run
            </button>
            <label>
              at most
              <input type="number" min={1} max={5000} value={fuelText} onChange={(e) => setFuelText(e.target.value)} aria-label="Fuel: the most steps a run may take" />
              steps
            </label>
            {running !== null && (
              <button type="button" className="chip-btn" onClick={stop}>
                Stop ({running} steps so far)
              </button>
            )}
            <button type="button" className="chip-btn" onClick={() => setCursor(Math.max(0, cursor - 1))} disabled={cursor === 0 || running !== null}>
              ◀ Back
            </button>
            <button type="button" className="chip-btn" onClick={() => setCursor(Math.min(history.length - 1, cursor + 1))} disabled={cursor >= history.length - 1 || running !== null}>
              Forward ▶
            </button>
            <button type="button" className="chip-btn" onClick={() => setCursor(0)} disabled={cursor === 0 || running !== null}>
              Restart
            </button>
          </div>
          <div className={`lam-status ${status ? statusClass(status.kind) : ''}`} aria-live="polite">
            {status ? status.text : 'Pick a redex, or a strategy and Step / Run.'}
          </div>
        </Panel>
      )}

      {entry?.how && <LastStep how={entry.how} opts={opts} />}

      {history.length > 1 && (
        <Panel n={4} title={`History (${history.length - 1} step${history.length === 2 ? '' : 's'})`}>
          <History history={history} cursor={cursor} onPick={setCursor} opts={opts} />
        </Panel>
      )}

      {graph && term && (
        <Panel n={5} title="Reduction graph (Church–Rosser)" prov={<Prov kind="computed" />}>
          <p className="wb-note">All terms the current term reduces to, one step at a time, identified up to α-equivalence. Keep the term small: the graph is drawn for at most 30 terms.</p>
          {!showGraph ? (
            <button type="button" className="chip-btn" onClick={() => setShowGraph(true)}>
              Draw the reduction graph of the current term
            </button>
          ) : (
            <>
              <button type="button" className="chip-btn" onClick={() => setShowGraph(false)}>
                Hide the graph
              </button>
              <GraphView
                term={term}
                opts={opts}
                onPick={(t) => {
                  setSingle(false);
                  setSrc(print(t));
                }}
              />
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function History({ history, cursor, onPick, opts }: { history: Entry[]; cursor: number; onPick: (i: number) => void; opts: LambdaPrintOptions }) {
  const LIMIT = 150;
  const idx = history.map((_, i) => i);
  const shown = history.length <= LIMIT ? idx : [...idx.slice(0, 50), -1, ...idx.slice(history.length - 99)];
  return (
    <ol className="lam-history">
      {shown.map((i) => {
        if (i === -1)
          return (
            <li key="gap" className="wb-note" style={{ padding: '4px 8px' }}>
              … {history.length - 149} steps not listed …
            </li>
          );
        const e = history[i]!;
        const why = !e.how
          ? 'start'
          : e.how.kind === 'alpha'
            ? `α: ${e.how.from} → ${e.how.to}`
            : `β${e.how.by === 'manual' ? ' (your choice)' : ` (${SHORT[e.how.by]})`}${e.how.c.subst.renamed.length ? `, renaming ${e.how.c.subst.renamed.map((r) => `${r.from}→${r.to}`).join(', ')}` : ''}`;
        return (
          <li key={i} className={i === cursor ? 'current' : ''}>
            <button type="button" onClick={() => onPick(i)} aria-current={i === cursor ? 'step' : undefined}>
              <span className="h-n">{i}</span>
              <span className="h-t">
                <TermInline term={e.term} opts={opts} />
                <span className="h-why">{why}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function LastStep({ how, opts }: { how: NonNullable<How>; opts: LambdaPrintOptions }) {
  if (how.kind === 'alpha') {
    return (
      <Panel n={3} title="What the last step did: α-conversion" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          The bound variable <i>{how.from}</i> was renamed to <i>{how.to}</i>, together with the {how.renamed.length} occurrence{how.renamed.length === 1 ? '' : 's'} it binds. Only bound names changed, so the new term is α-equivalent to the old one — the book treats them as “the same” term.
        </p>
      </Panel>
    );
  }
  const c = how.c;
  return (
    <Panel n={3} title="What the last step did: β-contraction" prov={<Prov kind="computed" />}>
      <ContractionDetail c={c} opts={opts} />
    </Panel>
  );
}

/** A contraction explained: the redex, M, N, x, the substitution trace, and (if renaming was needed) what naive replacement would have done. */
export function ContractionDetail({ c, opts }: { c: Contraction; opts: LambdaPrintOptions }) {
  const redex = nodeById(c.before, c.redex)!;
  const m = nodeById(c.before, c.body)!;
  const n = nodeById(c.before, c.arg)!;
  const naive = useMemo(() => (c.subst.renamed.length ? naiveSubstitute(m, c.param, n) : null), [c, m, n]);
  return (
    <>
      <p className="wb-note">In the term before the step, the contracted redex is highlighted:</p>
      <TermView term={c.before} opts={opts} highlight={c.redex} ariaLabel="The term before the step" />
      <dl className="lam-kv">
        <dt>redex</dt>
        <dd>
          <TermTex term={redex} opts={opts} />
        </dd>
        <dt>
          <i>x</i>
        </dt>
        <dd>
          <i>{c.param}</i>
        </dd>
        <dt>body M</dt>
        <dd>
          <TermTex term={m} opts={opts} />
        </dd>
        <dt>argument N</dt>
        <dd>
          <TermTex term={n} opts={opts} />
        </dd>
        <dt>contractum M[N/x]</dt>
        <dd>
          <TermTex term={c.contractum} opts={opts} />
        </dd>
      </dl>
      <p className="wb-note">
        {c.copies === 0 ? (
          <>
            <i>{c.param}</i> does not occur free in M, so N is <b>discarded</b>.
          </>
        ) : (
          <>
            N was copied into {c.copies} free occurrence{c.copies === 1 ? '' : 's'} of <i>{c.param}</i>
            {c.copies > 1 ? ' — work inside N is now duplicated' : ''}.
          </>
        )}
      </p>
      {c.subst.steps.length > 0 && (
        <>
          <p className="wb-note">
            The substitution M[N/{c.param}], as the engine performed it:
          </p>
          <ol className="lam-trace">
            {c.subst.steps.map((s, i) => (
              <li key={i} className={`k-${s.kind}`}>
                <b>{STEP_LABEL[s.kind]}:</b> {s.note}.
              </li>
            ))}
          </ol>
        </>
      )}
      {naive && (
        <div className="lam-erratum" style={{ borderLeftColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
          <b>Why rename?</b> Replacing blindly would give <TermTex term={naive.result} opts={{ ...opts, labels: false }} />, where the{' '}
          {[...new Set(naive.captures.map((x) => x.variable))].map((v) => (
            <i key={v}>{v} </i>
          ))}
          of N is captured by a λ of M: a different function. The book’s M[N/x] renames “any bound variables of M that would interfere with the free variables of N”, which is what happened here.
        </div>
      )}
    </>
  );
}
