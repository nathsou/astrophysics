// Simulating primitive recursion with the β-function (section "Simulating Primitive Recursion"):
//   ĥ(x⃗, y) = μd (β(d, 0) = f(x⃗) ∧ ∀i < y β(d, i + 1) = g(x⃗, i, β(d, i))),   h(x⃗, y) = β(ĥ(x⃗, y), y).

import { useMemo, useState } from 'react';
import { beta, leastBetaCode, primRecViaBeta } from '../../engine/computability/beta';
import * as Lib from '../../engine/computability/library';
import { evaluate, R, rfTex, type RF } from '../../engine/recursive/rf';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { Big, Mark, parseNat, useDeferred } from './common';

interface HEntry {
  id: string;
  /** TeX: the function computed */
  label: string;
  build: () => RF;
  /** h(x, i) for checking sizes before running */
  spec: (x: bigint, y: bigint) => bigint;
  equations: string;
  x: number;
  y: number;
}

const P = R.proj;

export const H_LIBRARY: HEntry[] = [
  {
    id: 'add', label: 'x + y', build: Lib.add, spec: (x, y) => x + y, x: 3, y: 3,
    equations: '\\mathrm{add}(x, 0) = x, \\quad \\mathrm{add}(x, y+1) = \\mathrm{succ}(\\mathrm{add}(x, y))',
  },
  {
    id: 'mult', label: 'x \\cdot y', build: Lib.mult, spec: (x, y) => x * y, x: 2, y: 3,
    equations: '\\mathrm{mult}(x, 0) = 0, \\quad \\mathrm{mult}(x, y+1) = \\mathrm{add}(\\mathrm{mult}(x, y), x)',
  },
  {
    id: 'exp', label: 'x^y', build: Lib.exp, spec: (x, y) => x ** y, x: 2, y: 5,
    equations: '\\mathrm{exp}(x, 0) = 1, \\quad \\mathrm{exp}(x, y+1) = \\mathrm{mult}(x, \\mathrm{exp}(x, y))',
  },
  {
    id: 'tsub', label: 'x \\dot- y', build: Lib.tsub, spec: (x, y) => (x > y ? x - y : 0n), x: 5, y: 3,
    equations: 'x \\dot- 0 = x, \\quad x \\dot- (y+1) = \\mathrm{pred}(x \\dot- y)',
  },
  {
    id: 'fac', label: 'y!', x: 0, y: 5,
    build: () => R.def('h_{fac}', 'h_{\\mathrm{fac}}', R.rec(Lib.constN(1), R.comp(Lib.mult(), [P(3, 2), R.comp(R.succ(), [P(3, 1)])]))),
    spec: (_x, y) => { let r = 1n; for (let i = 2n; i <= y; i++) r *= i; return r; },
    equations: 'h(x, 0) = 1, \\quad h(x, y+1) = \\mathrm{mult}(h(x, y), \\mathrm{succ}(y)) \\quad (\\text{the book’s } h \\text{ for } \\mathrm{fac}(y) = h(y, y))',
  },
  {
    id: 'tri', label: 'x + (0 + 1 + \\cdots + (y-1))', x: 0, y: 4,
    build: () => R.def('tri', '\\mathrm{tri}', R.rec(P(1, 0), R.comp(Lib.add(), [P(3, 2), P(3, 1)]))),
    spec: (x, y) => x + (y * (y - 1n)) / 2n,
    equations: 'h(x, 0) = x, \\quad h(x, y+1) = \\mathrm{add}(h(x, y), y)',
  },
];

const MAX_Y = 8;
const MAX_X = 30;
/** Largest value allowed in the sequence (j = max + 1 determines d₁ = lcm(1, …, j)). */
const MAX_VALUE = 3000n;

export function PrimRecLab() {
  const [id, setId] = useState('mult');
  const entry = H_LIBRARY.find((e) => e.id === id)!;
  const [xText, setX] = useState(String(entry.x));
  const [yText, setY] = useState(String(entry.y));
  const choose = (e: HEntry) => {
    setId(e.id);
    setX(String(e.x));
    setY(String(e.y));
  };
  const h = useMemo(() => entry.build(), [entry]);
  const x = /^\d+$/.test(xText) && Number(xText) <= MAX_X ? BigInt(xText) : null;
  const y = /^\d+$/.test(yText) && Number(yText) <= MAX_Y ? BigInt(yText) : null;
  const guard = useMemo(() => {
    if (x === null || y === null) return null;
    let max = 0n;
    for (let i = 0n; i <= y; i++) {
      const v = entry.spec(x, i);
      if (v > max) max = v;
    }
    return max;
  }, [entry, x, y]);
  const r = useMemo(() => (x !== null && y !== null && guard !== null && guard <= MAX_VALUE ? primRecViaBeta(h, [x, y], { maxY: MAX_Y }) : null), [h, x, y, guard]);
  const parts = h.k === 'def' && h.body.k === 'rec' ? h.body : null;

  return (
    <div className="workbench">
      <Panel n={1} title="A function defined by primitive recursion" prov={<Prov kind="computed" />}>
        <div className="seg" role="radiogroup" aria-label="The function h">
          {H_LIBRARY.map((e) => (
            <button key={e.id} className="chip-btn" role="radio" aria-checked={e.id === id} aria-pressed={e.id === id} onClick={() => choose(e)}>
              <Tex tex={e.label} />
            </button>
          ))}
        </div>
        <div className="r2-eqs">
          <Tex tex={entry.equations} />
          {parts && <Tex tex={`h = \\mathrm{Rec}(f, g), \\quad f = ${rfTex(parts.f)}, \\quad g = ${rfTex(parts.g)}`} />}
        </div>
        <div className="r2-row">
          <label>
            <Tex tex="x =" />
            <input className={`r2-input num ${x === null ? 'invalid' : ''}`} value={xText} onChange={(e) => setX(e.target.value)} aria-label="parameter x" inputMode="numeric" />
          </label>
          <label>
            <Tex tex="y =" />
            <input className={`r2-input num ${y === null ? 'invalid' : ''}`} value={yText} onChange={(e) => setY(e.target.value)} aria-label="recursion argument y" inputMode="numeric" />
          </label>
          <span className="r2-muted r2-small">
            x ≤ {MAX_X}, y ≤ {MAX_Y}
          </span>
        </div>
        {(x === null || y === null) && <p className="r2-err">Enter x ≤ {MAX_X} and y ≤ {MAX_Y}.</p>}
        {guard !== null && guard > MAX_VALUE && (
          <p className="r2-err">
            The values reach {guard.toString()}; this workbench codes sequences with values up to {MAX_VALUE.toString()} (d₁ = lcm(1, …, j) grows like e<sup>j</sup>). Choose smaller inputs.
          </p>
        )}
        {r && !r.ok && <p className="r2-err">{r.reason}</p>}
      </Panel>
      {r && r.ok && <Simulation r={r} xs={[x!]} />}
    </div>
  );
}

type Sim = Extract<ReturnType<typeof primRecViaBeta>, { ok: true }>;

function Simulation({ r, xs }: { r: Sim; xs: bigint[] }) {
  const y = Number(r.y);
  const xv = xs.map(String).join(', ');
  const [text, setText] = useState('');
  const own = parseNat(text);
  const [least, busy, run, reset] = useDeferred<ReturnType<typeof leastBetaCode>>();
  const key = `${xv};${r.values.join(',')}`;
  const [leastFor, setLeastFor] = useState('');
  const g = (i: bigint, prev: bigint) => {
    const e = evaluate(r.g, [...xs, i, prev], { fuel: 200_000, maxTraceDepth: -1 });
    return e.status === 'ok' ? e.value! : null;
  };
  const ownChecks = own === null ? null : [{ i: -1, lhs: beta(own, 0), rhs: r.base.f }, ...Array.from({ length: y }, (_, i) => ({ i, lhs: beta(own, i + 1), rhs: g(BigInt(i), beta(own, i)) }))];
  return (
    <>
      <Panel n={2} title="The values, and a β-code for them" prov={<Prov kind="computed" />}>
        <div className="r2-table-wrap">
          <table className="r2-table">
            <caption className="sr-only">The values h(x, i) for i up to y</caption>
            <thead>
              <tr>
                <th scope="col">i</th>
                {r.values.map((_, i) => (
                  <th key={i} scope="col">
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <Tex tex={`h(${xv}, i)`} />
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="num">
                    {v.toString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          By <Ref k="inc:req:bet:lem:beta" /> some <Tex tex="d" /> codes this sequence. The construction in its proof gives (with <Tex tex={`j = ${r.encoding.j}`} />):
        </p>
        <p>
          <Tex tex="d =" /> <Big v={r.d} />
        </p>
      </Panel>
      <Panel n={3} title="What the minimization tests" prov={<Prov kind="computed" />}>
        <div className="r2-eqs">
          <Tex tex={`\\hat h(\\vec x, y) = \\mu d\\,\\bigl(\\beta(d, 0) = f(\\vec x) \\land \\forall i < y\\ \\beta(d, i+1) = g(\\vec x, i, \\beta(d, i))\\bigr)`} />
          <Tex tex={`h(\\vec x, y) = \\beta(\\hat h(\\vec x, y), y)`} />
        </div>
        <p className="wb-note">The conditions, for the constructed d:</p>
        <ul className="r2-small sans" style={{ margin: '4px 0 8px', paddingLeft: 20 }}>
          <li>
            <Tex tex={`\\beta(d, 0) = ${r.base.beta0} \\quad f(${xv}) = ${r.base.f}`} /> <Mark ok={r.base.ok} />
          </li>
          {r.conditions.map((c) => (
            <li key={c.i}>
              <Tex tex={`\\beta(d, ${c.i + 1}) = ${c.next} \\quad g(${xv}, ${c.i}, \\beta(d, ${c.i})) = ${c.step}`} /> <Mark ok={c.ok} />
            </li>
          ))}
        </ul>
        <p className="wb-note">
          Hence <Tex tex={`h(${xv}, ${y}) = \\beta(d, ${y}) = ${r.value}`} /> <Mark ok={r.value === r.values[r.values.length - 1]} />. Any <Tex tex="d" /> passing these tests works: the conditions force <Tex tex="\beta(d, 0), \ldots, \beta(d, y)" /> to be <Tex tex={`h(\\vec x, 0), \\ldots, h(\\vec x, y)`} />, one after the other. The minimization picks the least such <Tex tex="d" />, and the β-function lemma guarantees there is one — that is why the minimized function is <em>regular</em>.
        </p>
        <div className="r2-row">
          <button
            className="chip-btn primary"
            disabled={busy}
            onClick={() => {
              reset();
              setLeastFor(key);
              run(() => leastBetaCode(r.values, 300_000n));
            }}
          >
            {busy ? 'Searching…' : 'Compute ĥ: search d = 0, 1, 2, … (below 300,000)'}
          </button>
        </div>
        <div aria-live="polite">
          {least && leastFor === key && (
            <p className="wb-note">
              {least.found ? (
                <>
                  <Tex tex={`\\hat h(${xv}, ${y}) = ${least.d}`} />: the least <Tex tex="d" /> passing the tests
                  {least.d === r.d ? ' (the constructed one).' : '. The construction found a bigger one — it is a proof that some code exists, not the minimization itself.'}
                </>
              ) : (
                <>No <Tex tex="d" /> below 300,000 passes the tests, so <Tex tex="\hat h" /> is at least 300,000 here (and at most the constructed d). The search stopped for lack of fuel, not because there is no such d.</>
              )}
            </p>
          )}
        </div>
      </Panel>
      <Panel n={4} title="Test your own d" prov={<Prov kind="computed" />}>
        <div className="r2-row">
          <label>
            <Tex tex="d =" />
            <input className={`r2-input wide ${text && own === null ? 'invalid' : ''}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="a number" aria-label="your d" />
          </label>
        </div>
        {ownChecks && (
          <ul className="r2-small sans" aria-live="polite" style={{ margin: '4px 0', paddingLeft: 20 }}>
            {ownChecks.map((c) => (
              <li key={c.i}>
                {c.i < 0 ? <Tex tex={`\\beta(d, 0) = ${short(c.lhs)} \\text{ vs } f = ${c.rhs}`} /> : <Tex tex={`\\beta(d, ${c.i + 1}) = ${short(c.lhs)} \\text{ vs } g(\\ldots, ${c.i}, \\beta(d, ${c.i})) = ${c.rhs === null ? '?' : short(c.rhs)}`} />}{' '}
                <Mark ok={c.lhs === c.rhs} />
              </li>
            ))}
          </ul>
        )}
        <NotAProof>
          This checks the simulation for one function and one input. <Ref k="inc:req:pri:lem:prim-rec" /> is proved for every <Tex tex="f" />, <Tex tex="g" /> and input by the argument in the text.
        </NotAProof>
      </Panel>
    </>
  );
}

function short(v: bigint): string {
  const s = v.toString();
  return s.length > 14 ? `${s.slice(0, 6)}\\ldots${s.slice(-3)}` : s;
}
