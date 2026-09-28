// Primitive recursive relations (section "Primitive Recursive Relations"): Boolean combinations
// through characteristic functions, and bounded quantifiers and bounded minimization, which are
// primitive recursions on the bound (also section "Bounded Minimization").

import { useMemo } from 'react';
import { evaluate, type RF } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { unfoldRec } from '../../engine/computability/primrec';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { NumField, useRemembered } from './common';
import { belowRel, divRel, halfRel, halfUpRel, sqrtRel } from './entries';

// ------------------------------------------------------------------ Boolean combinations

const BASE: { id: string; tex: string; build: () => RF; holds: (x: bigint, y: bigint) => boolean }[] = [
  { id: 'eq', tex: 'x = y', build: Lib.chiEq, holds: (x, y) => x === y },
  { id: 'leq', tex: 'x \\le y', build: Lib.chiLeq, holds: (x, y) => x <= y },
  { id: 'lt', tex: 'x < y', build: Lib.chiLt, holds: (x, y) => x < y },
  { id: 'div', tex: 'x \\mid y', build: Lib.divides, holds: (x, y) => (x === 0n ? y === 0n : y % x === 0n) },
];

const OPS: { id: string; label: string; tex: (p: string, q: string) => string; chi: string; build: (p: RF, q: RF) => RF; holds: (a: boolean, b: boolean) => boolean }[] = [
  { id: 'not', label: '¬P', tex: (p) => `\\lnot(${p})`, chi: '1 \\dot- \\chi_P(\\vec x)', build: (p) => Lib.charNot(p), holds: (a) => !a },
  { id: 'and', label: 'P ∧ Q', tex: (p, q) => `${p} \\land ${q}`, chi: '\\chi_P(\\vec x) \\cdot \\chi_Q(\\vec x)', build: (p, q) => Lib.charAnd(p, q), holds: (a, b) => a && b },
  { id: 'or', label: 'P ∨ Q', tex: (p, q) => `${p} \\lor ${q}`, chi: '\\max(\\chi_P(\\vec x), \\chi_Q(\\vec x))', build: (p, q) => Lib.charOr(p, q), holds: (a, b) => a || b },
  { id: 'imp', label: 'P → Q', tex: (p, q) => `${p} \\rightarrow ${q}`, chi: '\\max(1 \\dot- \\chi_P(\\vec x), \\chi_Q(\\vec x))', build: (p, q) => Lib.charImplies(p, q), holds: (a, b) => !a || b },
];

export function BooleanLab() {
  const [st, setSt] = useRemembered('boolean', { p: 'lt', q: 'div', op: 'imp' });
  const P = BASE.find((b) => b.id === st.p) ?? BASE[0];
  const Q = BASE.find((b) => b.id === st.q) ?? BASE[1];
  const op = OPS.find((o) => o.id === st.op) ?? OPS[0];
  const rf = useMemo(() => op.build(P.build(), Q.build()), [op, P, Q]);
  const N = 5;
  const grid = useMemo(
    () =>
      Array.from({ length: N + 1 }, (_, x) =>
        Array.from({ length: N + 1 }, (_, y) => {
          const r = evaluate(rf, [BigInt(x), BigInt(y)], { fuel: 200_000, maxTraceDepth: -1 });
          const want = op.holds(P.holds(BigInt(x), BigInt(y)), Q.holds(BigInt(x), BigInt(y))) ? 1n : 0n;
          return { v: r.status === 'ok' ? r.value : undefined, want };
        }),
      ),
    [rf, op, P, Q],
  );
  const agree = grid.flat().every((c) => c.v === c.want);
  const unary = op.id === 'not';
  return (
    <div className="workbench">
      <Panel n={1} title="Combine relations" prov={<Prov kind="computed" />}>
        <div className="rc-row" role="group" aria-label="Relation P">
          <span className="fi-label">P(x, y)</span>
          {BASE.map((b) => (
            <button key={b.id} className="chip-btn" aria-pressed={P.id === b.id} onClick={() => setSt({ ...st, p: b.id })}>
              <Tex tex={b.tex} />
            </button>
          ))}
        </div>
        <div className="rc-row" role="group" aria-label="Connective">
          <span className="fi-label">connective</span>
          {OPS.map((o) => (
            <button key={o.id} className="chip-btn" aria-pressed={op.id === o.id} onClick={() => setSt({ ...st, op: o.id })}>
              {o.label}
            </button>
          ))}
        </div>
        {!unary && (
          <div className="rc-row" role="group" aria-label="Relation Q">
            <span className="fi-label">Q(x, y)</span>
            {BASE.map((b) => (
              <button key={b.id} className="chip-btn" aria-pressed={Q.id === b.id} onClick={() => setSt({ ...st, q: b.id })}>
                <Tex tex={b.tex} />
              </button>
            ))}
          </div>
        )}
        <div className="rc-eqs">
          <Tex tex={`\\chi_{${op.tex(P.tex, Q.tex)}}(x, y) = ${op.chi.replace(/\\vec x/g, 'x, y')}`} />
        </div>
        <p className="wb-note">
          The characteristic functions of <Tex tex={P.tex} />
          {!unary && (
            <>
              {' '}
              and <Tex tex={Q.tex} />
            </>
          )}{' '}
          are the book’s official definitions; the combination is built from them with <Tex tex="\dot-" />, multiplication or <Tex tex="\max" /> as in the proof in{' '}
          <Ref k="cmp:rec:prr:sec" />.
        </p>
        <div className="rc-scroll">
          <table className="rc-table rc-grid" aria-label="Values of the characteristic function">
            <thead>
              <tr>
                <th scope="col">
                  <Tex tex="x \backslash y" />
                </th>
                {grid[0].map((_, y) => (
                  <th key={y} scope="col">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, x) => (
                <tr key={x}>
                  <th scope="row">{x}</th>
                  {row.map((c, y) => (
                    <td key={y} className={c.v !== c.want ? 'wrong' : c.v === 1n ? 'one' : 'zero'}>
                      {c.v === undefined ? '?' : c.v.toString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small sans">
          {agree ? <span className="rc-ok">Every entry is 1 exactly where the combined relation holds.</span> : <span className="rc-bad">Some entries disagree with the intended relation.</span>}
        </p>
        <NotAProof>A table of 36 pairs; the closure under Boolean operations holds for all arguments by the argument in the text.</NotAProof>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ bounded quantifiers and bounded minimization

const RELS: { id: string; tex: string; build: () => RF; holds: (x: bigint, z: bigint) => boolean }[] = [
  { id: 'half', tex: 'z + z = x', build: halfRel, holds: (x, z) => z + z === x },
  { id: 'halfup', tex: 'x \\le z + z', build: halfUpRel, holds: (x, z) => x <= z + z },
  { id: 'sqrt', tex: 'x < z \\cdot z', build: sqrtRel, holds: (x, z) => x < z * z },
  { id: 'below', tex: 'z \\le x', build: belowRel, holds: (x, z) => z <= x },
  { id: 'div', tex: 'z \\mid x \\land 1 < z', build: divRel, holds: (x, z) => z > 1n && x % z === 0n },
];

type Kind = 'forall' | 'exists' | 'min';

export function BoundedLab({ kinds }: { kinds: Kind[] }) {
  const [st, setSt] = useRemembered(`bounded.${kinds.join('')}`, { rel: kinds.includes('min') ? 'halfup' : 'below', kind: kinds[0] as Kind, x: kinds.includes('min') ? '7' : '3', y: '6' });
  const kind: Kind = kinds.includes(st.kind) ? st.kind : kinds[0];
  const rel = RELS.find((r) => r.id === st.rel) ?? RELS[0];
  const r = useMemo(() => rel.build(), [rel]);
  const h = useMemo(() => (kind === 'forall' ? Lib.bforall(r) : kind === 'exists' ? Lib.bexists(r) : Lib.bmin(r)), [kind, r]);
  const xv = /^\d+$/.test(st.x.trim()) && BigInt(st.x) <= 12n ? BigInt(st.x) : null;
  const yv = /^\d+$/.test(st.y.trim()) && BigInt(st.y) <= 12n ? BigInt(st.y) : null;
  const u = useMemo(() => (xv !== null && yv !== null ? unfoldRec(h, [xv], yv, { fuel: 3_000_000 }) : null), [h, xv, yv]);
  const rVals = useMemo(() => {
    if (xv === null || yv === null) return [];
    return Array.from({ length: Number(yv) }, (_, z) => {
      const e = evaluate(r, [xv, BigInt(z)], { fuel: 200_000, maxTraceDepth: -1 });
      return e.status === 'ok' ? e.value : undefined;
    });
  }, [r, xv, yv]);
  const qTex = kind === 'forall' ? '(\\forall z < y)' : kind === 'exists' ? '(\\exists z < y)' : '(\\min z < y)';
  const hTex = kind === 'min' ? 'm_R' : '\\chi_P';
  const unbounded = xv === null ? null : (() => {
    for (let z = 0n; z < 200n; z++) if (rel.holds(xv, z)) return z;
    return null;
  })();
  return (
    <div className="workbench">
      <Panel n={1} title={kind === 'min' ? 'Bounded minimization' : 'A bounded quantifier'} prov={<Prov kind="computed" />}>
        {kinds.length > 1 && (
          <div className="rc-row" role="group" aria-label="Quantifier">
            {kinds.map((k) => (
              <button key={k} className="chip-btn" aria-pressed={kind === k} onClick={() => setSt({ ...st, kind: k })}>
                <Tex tex={k === 'forall' ? '\\forall z < y' : k === 'exists' ? '\\exists z < y' : '\\min z < y'} />
              </button>
            ))}
          </div>
        )}
        <div className="rc-row" role="group" aria-label="Relation R(x, z)">
          <span className="fi-label">R(x, z)</span>
          {RELS.map((q) => (
            <button key={q.id} className="chip-btn" aria-pressed={rel.id === q.id} onClick={() => setSt({ ...st, rel: q.id })}>
              <Tex tex={q.tex} />
            </button>
          ))}
        </div>
        <div className="rc-eqs">
          <Tex
            display
            tex={
              kind === 'forall'
                ? '\\begin{aligned} \\chi_P(x, 0) &= 1 \\\\ \\chi_P(x, y + 1) &= \\min(\\chi_P(x, y), \\chi_R(x, y)) \\end{aligned}'
                : kind === 'exists'
                  ? '\\begin{aligned} \\chi_P(x, 0) &= 0 \\\\ \\chi_P(x, y + 1) &= \\max(\\chi_P(x, y), \\chi_R(x, y)) \\end{aligned}'
                  : 'm_R(x, 0) = 0, \\qquad m_R(x, y+1) = \\begin{cases} m_R(x, y) & \\text{(1) if } m_R(x, y) \\ne y \\\\ y & \\text{(2) if } m_R(x, y) = y \\text{ and } R(x, y) \\\\ y + 1 & \\text{(3) otherwise} \\end{cases}'
            }
          />
        </div>
        <div className="rc-row">
          <NumField id={`bl-x-${kinds.join('')}`} label="x =" value={st.x} onChange={(v) => setSt({ ...st, x: v })} width={56} hint="at most 12" />
          <NumField id={`bl-y-${kinds.join('')}`} label="bound y =" value={st.y} onChange={(v) => setSt({ ...st, y: v })} width={56} hint="at most 12" />
          {(xv === null || yv === null) && <span className="rc-err">numbers up to 12</span>}
        </div>
      </Panel>
      {u && u.ok && xv !== null && yv !== null && (
        <Panel n={2} title={<>The recursion on the bound, for <Tex tex={`${qTex}\\,R(${xv}, z)`} /></>} prov={<Prov kind="computed" />}>
          <p className="wb-note">
            {kind === 'min'
              ? 'Row y + 1 decides by cases from the previous row and one test of R — a primitive recursion, as in the proof. There is a z < y with R(x, z) exactly when mR(x, y) ≠ y.'
              : 'Row y + 1 combines the previous row with one more test of R, at z = y. Each row is computed with the official definition.'}{' '}
           
          </p>
          <div className="rc-scroll">
            <table className="rc-table">
              <thead>
                <tr>
                  <th scope="col" className="num">
                    y
                  </th>
                  <th scope="col">
                    test <Tex tex="\chi_R(x, y-1)" />
                  </th>
                  <th scope="col" className="num">
                    <Tex tex={`${hTex}(${xv}, y)`} />
                  </th>
                  {kind === 'min' && <th scope="col">case</th>}
                </tr>
              </thead>
              <tbody>
                {u.rows.map((row, j) => {
                  const test = j === 0 ? undefined : rVals[j - 1];
                  const prev = u.rows[j - 1]?.value;
                  const cse = j === 0 ? 'm(x, 0) = 0' : prev !== BigInt(j - 1) ? '(1) keep' : test === 1n ? '(2) y' : '(3) y + 1';
                  return (
                    <tr key={j} className={j === u.rows.length - 1 ? 'current' : ''}>
                      <td className="num">{j}</td>
                      <td>{j === 0 ? <span className="muted small">no test</span> : <Tex tex={`\\chi_R(${xv}, ${j - 1}) = ${test ?? '?'}`} />}</td>
                      <td className="num">{row.value !== undefined ? row.value.toString() : '?'}</td>
                      {kind === 'min' && <td className="small sans">{cse}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="wb-result" aria-live="polite">
            <Tex tex={`${hTex}(${xv}, ${yv}) = ${u.rows[u.rows.length - 1]?.value ?? '?'}`} />
            {kind !== 'min' && (
              <span className="small sans muted">
                {' '}
                — so <Tex tex={`${qTex.replace('y', String(yv))}\\,R(${xv}, z)`} /> {u.rows[u.rows.length - 1]?.value === 1n ? 'holds' : 'does not hold'}.
              </span>
            )}
            {kind === 'min' && (
              <span className="small sans muted">
                {' '}
                {u.rows[u.rows.length - 1]?.value === yv ? <>— no z below {String(yv)} satisfies R, so the bound is returned.</> : <>— the least z below the bound with R(x, z).</>}{' '}
                Unbounded search would give {unbounded === null ? 'no answer among the first 200 numbers' : <Tex tex={`\\mu z\\,R(${xv}, z) = ${unbounded}`} />}.
              </span>
            )}
          </p>
          {kind === 'min' && (
            <p className="wb-note">
              The bound is what keeps this primitive recursive: the recursion runs exactly <Tex tex="y" /> times, whether or not a witness is found early.
            </p>
          )}
        </Panel>
      )}
      {u && !u.ok && <p className="rc-err">{u.error}</p>}
    </div>
  );
}
