// Computable and computably enumerable sets, step by step: dovetailing W_e, K and K₀; the
// equivalent definitions of c.e. sets; computable sets as c.e. sets.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { Ref } from '../../formal/FormalText';
import { Stepper } from '../../ui/Stepper';
import { useStore } from '../../ui/store';
import { R } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { indexOf, phi } from '../../engine/computability/indices';
import { bookRangeFunction, enumerateK, enumerateK0, enumerateW, inverseSearch, rangeEnumeration, witnessPair, type Enumeration, type Membership } from '../../engine/computability/ce';
import { computationRecord, describeCodeSize, recordCodeSize } from '../../engine/computability/records';
import { chiEven, UNARY_EXAMPLES } from '../../engine/computability/examples';
import { Big, IndexPicker, IndexSummary, exampleIndex, indexStore, parseNat, phiStatus } from './shared';

const STAGES = [30, 60, 120, 240];

function cellClass(m: Membership, stage: number): string {
  if (m.kind === 'in') return m.stage <= stage ? `in ${m.stage === stage ? 'new' : ''}` : '';
  if (m.kind === 'out') return m.trivial ? 'nf' : 'out';
  return '';
}

function cellTitle(label: string, m: Membership, stage: number): string {
  if (m.kind === 'in') return m.stage <= stage ? `${label}: listed at stage ${m.stage} (halted after ${m.calls} calls with value ${m.value})` : `${label}: not listed yet at stage ${stage}`;
  if (m.kind === 'out') return `${label}: never listed — ${m.reason}`;
  return `${label}: not listed by the last stage computed; it may appear later, or never`;
}

function Strip({ en, stage, label }: { en: Enumeration; stage: number; label: (i: number) => string }) {
  return (
    <div className="ct-strip" role="list" aria-label="candidates">
      {en.members.map((m, i) => (
        <span key={i} role="listitem" className={`ct-cell ${cellClass(m, stage)}`} title={cellTitle(label(i), m, stage)}>
          {i}
        </span>
      ))}
    </div>
  );
}

function StageSummary({ en, stage, what }: { en: Enumeration; stage: number; what: string }) {
  const listed = en.byStage.slice(0, stage + 1).flat();
  const now = en.byStage[stage] ?? [];
  const certainOut = en.members.filter((m) => m.kind === 'out' && !m.trivial).length;
  const trivial = en.members.filter((m) => m.kind === 'out' && m.trivial).length;
  return (
    <p className="wb-note" aria-live="polite">
      Stage {stage}: {now.length ? <>newly listed {now.join(', ')}; </> : 'nothing new; '}
      {listed.length} listed so far. {trivial > 0 && <>{trivial} candidate{trivial === 1 ? ' is' : 's are'} not one-place definitions at all (faint). </>}
      {certainOut > 0 && <>{certainOut} more can be ruled out by simple checks (dashed, red). Neither is part of the enumeration, which never says “no”. </>}
      Every other candidate may still appear at a later stage, or never{what ? ` — ${what}` : ''}.
    </p>
  );
}

/** Dovetailing W_e (source 'W', with the chapter's e) or K (source 'K'). */
export function DovetailLab({ source, n = 1 }: { source: 'W' | 'K'; n?: number }) {
  const text = useStore(indexStore);
  const e = parseNat(text);
  const [max, setMax] = useState(60);
  const [stage, setStage] = useState(60);
  const en = useMemo(() => (source === 'K' ? enumerateK(max) : e === null ? null : enumerateW(e, max)), [source, e, max]);
  const st = Math.min(stage, max);
  return (
    <Panel n={n} title={source === 'K' ? <>Enumerating K = {'{'}e : φ<sub>e</sub>(e)↓{'}'}</> : <>Enumerating W<sub>e</sub> = dom φ<sub>e</sub></>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        {source === 'K' ? (
          <>
            At stage s, run <Tex tex="\varphi_e(e)" /> for s calls, for each <Tex tex="e < s" />, and list the e whose computation halted. Deciding whether “s calls suffice” is a
            finite check.
          </>
        ) : (
          <>
            At stage s, run <Tex tex="\varphi_e(x)" /> for s calls, for each <Tex tex="x < s" />, and list the x whose computation halted. This “dovetailing” never waits
            forever on one x.
          </>
        )}
      </p>
      {source === 'W' && (
        <>
          <IndexPicker value={text} onChange={indexStore.set} />
          {e !== null && <IndexSummary e={e} />}
        </>
      )}
      {en && (
        <>
          <div className="ct-controls">
            <label>
              stages up to{' '}
              <select
                className="fi-examples"
                value={max}
                onChange={(ev) => {
                  setMax(Number(ev.target.value));
                  setStage(Number(ev.target.value));
                }}
                aria-label="number of stages"
              >
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <Stepper step={st} count={max + 1} onStep={setStage} label="Step" describe={(i) => `stage ${i}`} />
          <Strip en={en} stage={st} label={(i) => (source === 'K' ? `e = ${i}` : `x = ${i}`)} />
          <StageSummary en={en} stage={st} what={source === 'K' ? 'which is exactly what the undecidability of K predicts: no stage can be trusted to have listed everything' : ''} />
        </>
      )}
    </Panel>
  );
}

/** K₀ on a finite grid: ⟨e, x⟩ is listed at the stage where φₑ(x) halts; the diagonal is K. */
export function K0Grid({ n = 2 }: { n?: number }) {
  const [size, setSize] = useState(12);
  const [maxStage] = useState(200);
  const [stage, setStage] = useState(200);
  const grid = useMemo(() => enumerateK0(size, size, maxStage), [size, maxStage]);
  const listed = grid.flat().filter((m) => m.kind === 'in' && m.stage <= stage).length;
  return (
    <Panel n={n} title={<>The halting set K₀ = {'{'}⟨e, x⟩ : φ<sub>e</sub>(x)↓{'}'}</>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Rows e, columns x. A cell turns green at the stage where <Tex tex="\varphi_e(x)" /> halts (stage s runs every <Tex tex="e, x < s" /> for s calls). The outlined diagonal is
        K. Hover a cell for its story.
      </p>
      <div className="ct-controls">
        <label>
          size{' '}
          <select className="fi-examples" value={size} onChange={(ev) => setSize(Number(ev.target.value))} aria-label="grid size">
            {[8, 12, 16, 24].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <Stepper step={stage} count={maxStage + 1} onStep={setStage} label="Step" describe={(i) => `stage ${i}`} />
      <div className="ct-table-wrap" style={{ border: 'none' }}>
        <div className="ct-grid" style={{ gridTemplateColumns: `2.2em repeat(${size}, minmax(22px, 1fr))`, minWidth: `${size * 24 + 40}px` }} role="grid" aria-label="K0 grid">
          <span className="ct-head" />
          {Array.from({ length: size }, (_, x) => (
            <span key={x} className="ct-head">
              {x}
            </span>
          ))}
          {grid.map((row, e) => (
            <div key={e} role="row" style={{ display: 'contents' }}>
              <span className="ct-head" role="rowheader">
                {e}
              </span>
              {row.map((m, x) => (
                <span key={x} role="gridcell" className={`ct-cell ${cellClass(m, stage)} ${x === e ? 'diag' : ''}`} title={cellTitle(`⟨${e}, ${x}⟩`, m, stage)}>
                  {m.kind === 'in' && m.stage <= stage ? '✓' : m.kind === 'out' ? (m.trivial ? '×' : '↑') : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="wb-note" aria-live="polite">
        Stage {stage}: {listed} pairs listed.
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ computable sets

interface SetChoice {
  id: string;
  label: string;
  tex: string;
  build: () => ReturnType<typeof chiEven>;
  a: bigint;
}

const SETS: SetChoice[] = [
  { id: 'even', label: 'the even numbers', tex: '\\mathrm{Even}', build: chiEven, a: 0n },
  { id: 'zero', label: '{0}', tex: '\\{0\\}', build: Lib.isZero, a: 0n },
  { id: 'le3', label: '{0, 1, 2, 3}', tex: '\\{0,1,2,3\\}', build: () => R.comp(Lib.chiLeq(), [R.proj(1, 0), Lib.constN(3)]), a: 0n },
];

const XS = Array.from({ length: 16 }, (_, x) => BigInt(x));
const chiCache = new Map<string, bigint>();
const chiIndex = (s: SetChoice) => {
  let e = chiCache.get(s.id);
  if (e === undefined) chiCache.set(s.id, (e = indexOf(s.build())));
  return e;
};

export function SetsLab({ n = 1, enumerate = false }: { n?: number; enumerate?: boolean }) {
  const [id, setId] = useState('even');
  const set = SETS.find((s) => s.id === id)!;
  const e = chiIndex(set);
  const chi = useMemo(() => XS.map((x) => phi(e, x, 50_000)), [e]);
  const k = useMemo(() => XS.map((x) => phiStatus(x, x, 1000)), []);
  const xs = XS;
  return (
    <Panel n={n} title={enumerate ? 'A computable set, listed by a computable function' : 'A decidable set, and K'} prov={<Prov kind="computed" />}>
      <div className="seg" role="radiogroup" aria-label="set">
        {SETS.map((s) => (
          <button key={s.id} role="radio" aria-checked={s.id === id} className={`chip-btn ${s.id === id ? 'current try' : ''}`} onClick={() => setId(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="wb-note">
        <Tex tex={`\\chi_{${set.tex}}`} /> has index <Big n={e} max={24} /> (a definition by primitive recursion, so it is total).
      </p>
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="row" scope="col">
                x
              </th>
              {xs.map((x) => (
                <th key={x.toString()} scope="col">
                  {x.toString()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="row" scope="row">
                <Tex tex={`\\chi_{${set.tex}}(x)`} />
              </th>
              {chi.map((o, x) => (
                <td key={x}>{o.kind === 'value' ? o.value.toString() : '…'}</td>
              ))}
            </tr>
            {enumerate ? (
              <tr>
                <th className="row" scope="row">
                  <Tex tex="f(x)" />
                </th>
                {chi.map((o, x) => (
                  <td key={x}>
                    <span className={`ct-o ${o.kind === 'value' && o.value === 1n ? 'value' : 'fuel'}`}>{o.kind === 'value' && o.value === 1n ? x : set.a.toString()}</span>
                  </td>
                ))}
              </tr>
            ) : (
              <tr>
                <th className="row" scope="row">
                  <Tex tex="\chi_K(x)" />
                </th>
                {k.map((o, x) => (
                  <td key={x} title={o.kind === 'value' ? `φ_${x}(${x}) halted: ${x} ∈ K` : o.kind === 'outOfFuel' ? `no answer within 1000 calls` : `φ_${x}(${x}) is undefined: ${x} ∉ K`}>
                    {o.kind === 'value' ? '1' : o.kind === 'outOfFuel' ? <span className="ct-o fuel">?</span> : <span className="ct-o undef">0</span>}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {enumerate ? (
        <p className="wb-note">
          With <Tex tex={`a = ${set.a} \\in ${set.tex}`} />: <Tex tex={`f(x) = x`} /> if <Tex tex={`\\chi_{${set.tex}}(x) = 1`} />, and <Tex tex="a" /> otherwise (grey). f is total
          and computable, and its range is exactly the set — with repetitions, and not in increasing order in general. That is all “enumerate” means.
        </p>
      ) : (
        <p className="wb-note">
          Every entry of the first row is a value: the characteristic function of a computable set is <em>total</em>. The second row tries the same for{' '}
          <Tex tex="K = \{e : \varphi_e(e)\downarrow\}" />: 1 where the computation halted, 0 where it is certainly undefined, ? where 1000 calls were not enough. More fuel
          turns some ? into 1; no amount of fuel turns all of them into answers — the theorem that K is not computable says no program does.
        </p>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ equivalent definitions

export function EquivalenceLab() {
  const text = useStore(indexStore);
  const e = parseNat(text);
  const [aText, setA] = useState('');
  const range = useMemo(() => {
    if (e === null) return null;
    // a default element: the first value found
    const steps = rangeEnumeration(e, 0n, 300);
    const first = steps.find((s) => s.hit);
    const a = parseNat(aText, 4) ?? first?.out ?? null;
    return a === null ? { steps: [], a: null } : { steps: rangeEnumeration(e, a, 300), a };
  }, [e, aText]);
  const w = useMemo(() => (e === null ? null : enumerateW(e, 60)), [e]);
  const witnesses = useMemo(() => {
    if (e === null || !w) return [];
    return w.members
      .map((m, x) => ({ m, x: BigInt(x) }))
      .filter(({ m }) => m.kind === 'in')
      .slice(0, 6)
      .map(({ x }) => {
        const r = computationRecord(e, x, 5000);
        return { x, size: r.kind === 'halted' ? describeCodeSize(recordCodeSize(r.root)).text : '?', pair: witnessPair(e, x) };
      });
  }, [e, w]);
  const book = witnesses.find((t) => t.pair);
  const bookF = e !== null && book?.pair && range?.a != null ? bookRangeFunction(e, range.a, book.pair.z) : null;
  const [tf, setTf] = useState('double');
  const total = UNARY_EXAMPLES.find((u) => u.id === tf)!;
  const te = exampleIndex(total);
  const inv = useMemo(() => Array.from({ length: 10 }, (_, y) => ({ y, r: inverseSearch(te, BigInt(y), 40, 20_000) })), [te]);

  return (
    <div className="workbench">
      <Panel n={1} title={<>One set, four descriptions</>} prov={<Prov kind="computed" />}>
        <IndexPicker value={text} onChange={indexStore.set} />
        {e !== null && <IndexSummary e={e} />}
        {w && (
          <>
            <p className="sans small">
              <b>
                <Ref k="cmp:thy:eqc:case:ce-domain" /> the domain:
              </b> by stage 60, <Tex tex="W_e" /> ⊇ {'{'}
              {(() => {
                const all = w.byStage.flat().sort((p, q) => (p < q ? -1 : 1));
                return all.length ? all.slice(0, 20).join(', ') + (all.length > 20 ? `, … (${all.length} in all)` : '') : '∅';
              })()}
              {'}'}
            </p>
            <Strip en={w} stage={60} label={(i) => `x = ${i}`} />
          </>
        )}
      </Panel>

      {range && (
        <Panel n={2} title={
            <>
              <Ref k="cmp:thy:eqc:case:ran-pc" /> ⇒ <Ref k="cmp:thy:eqc:case:ran-prim" />: the range as the range of a total function
            </>
          } prov={<Prov kind="computed" />}>
          {range.a === null ? (
            <p className="wb-note">No value of φₑ found yet, so no element a to fall back on. (If the range is empty, the set is c.e. by definition.)</p>
          ) : (
            <>
              <p className="wb-note">
                The book’s <Tex tex="f(z) = U((z)_1)" /> if <Tex tex="T(e, (z)_0, (z)_1)" />, else <Tex tex="a" />. Records are huge, so almost every z gives a. The same idea with
                a step count in place of the record: <Tex tex="f(J(x, n)) = \varphi_e(x)" /> if that computation halts within n calls, else <Tex tex="a" /> — also total and
                computable, with the same range.
              </p>
              <div className="ct-controls">
                <label>
                  a ={' '}
                  <input className="ct-inline-input" value={aText} placeholder={range.a.toString()} onChange={(ev) => setA(ev.target.value)} aria-label="default element a" inputMode="numeric" />
                </label>
                <span className="sans small muted">(an element of the range)</span>
              </div>
              <div className="ct-strip" aria-label="f(0), f(1), …">
                {range.steps.slice(0, 120).map((s) => (
                  <span key={s.z.toString()} className={`ct-cell ${s.hit ? 'in' : ''}`} title={`z = ${s.z} = J(${s.x}, ${s.n}): ${s.hit ? `φ_e(${s.x}) = ${s.out} within ${s.n} calls` : `no value within ${s.n} calls, so a`}`}>
                    {s.out.toString()}
                  </span>
                ))}
              </div>
              <p className="wb-note">
                f(0), f(1), …, f(119); green where the computation fit into the budget. Values in the range appear again and again.
              </p>
              {bookF && book?.pair && (
                <p className="wb-note">
                  The book’s version at one z that works, with the pair <Tex tex="((z)_0, (z)_1)" /> coded here by <Tex tex="J" /> (this edition’s choice):{' '}
                  <Tex tex={`z = J(${book.x}, s)`} /> with s the record of <Tex tex={`\\varphi_e(${book.x})`} />, that is z = <Big n={book.pair.z} max={24} />. Then{' '}
                  <Tex tex={`T(e, ${bookF.x}, s)`} /> {bookF.holds ? 'holds' : 'fails'}, so <Tex tex={`f(z) = U(s) = ${bookF.out}`} />.
                </p>
              )}
            </>
          )}
        </Panel>
      )}

      <Panel n={3} title={<>Σ₁ form: x ∈ W<sub>e</sub> ⟺ ∃s T(e, x, s)</>} prov={<Prov kind="computed" />}>
        <p className="wb-note">For each x listed so far, the witness s is the record of the computation (this edition’s coding):</p>
        <ul className="ct-checks">
          {witnesses.map((t) => (
            <li key={t.x.toString()}>
              x = {t.x.toString()}: s = {t.pair ? <Big n={t.pair.s} max={24} /> : <>a number with {t.size}</>}
            </li>
          ))}
          {!witnesses.length && <li className="muted">no element listed yet</li>}
        </ul>
        <p className="wb-note">
          The relation <Tex tex="T(e, x, s)" /> is decidable; the set is what you get by putting an unbounded <Tex tex="\exists s" /> in front. Nothing bounds how large the
          witness must be.
        </p>
      </Panel>

      <Panel n={4} title={
          <>
            <Ref k="cmp:thy:eqc:case:ce" /> ⇒ <Ref k="cmp:thy:eqc:case:ce-domain" />: the range of f as the domain of g(y) = μx (f(x) = y)
          </>
        } prov={<Prov kind="computed" />}>
        <div className="seg" role="radiogroup" aria-label="total function f">
          {['double', 'square', 'plus2', 'sqrt'].map((id) => {
            const u = UNARY_EXAMPLES.find((q) => q.id === id)!;
            return (
              <button key={id} role="radio" aria-checked={tf === id} className={`chip-btn ${tf === id ? 'current try' : ''}`} onClick={() => setTf(id)}>
                <Tex tex={`f(x) = ${u.tex}`} />
              </button>
            );
          })}
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <th className="row" scope="col">
                  y
                </th>
                {inv.map(({ y }) => (
                  <th key={y} scope="col">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="row" scope="row">
                  g(y)
                </th>
                {inv.map(({ y, r }) => (
                  <td key={y} title={r.kind === 'found' ? `f(${r.x}) = ${y}` : `no x < ${r.searched} with f(x) = ${y}: the search goes on`}>
                    {r.kind === 'found' ? r.x.toString() : <span className="ct-o fuel">…</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          g searches x = 0, 1, 2, … for <Tex tex="f(x) = y" />. Where y is in the range it stops; where it is not, g searches forever — “…” marks a search that has not stopped
          among the first 40 values of x.
        </p>
        <p className="wb-note">For an increasing f one could stop early, but g does not know that: the equivalence uses nothing about f except that it is computable.</p>
      </Panel>
    </div>
  );
}
