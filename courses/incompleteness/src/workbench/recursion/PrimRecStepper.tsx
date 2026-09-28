// A primitive recursion, one equation at a time (sections "Primitive Recursion", "Primitive
// Recursion Functions", "Primitive Recursive Functions are Computable"): h(x⃗, 0) = f(x⃗),
// h(x⃗, y + 1) = g(x⃗, y, h(x⃗, y)), computed row by row by the engine, with the unfolded
// expression g(x⃗, y − 1, g(x⃗, y − 2, … f(x⃗))) of the book, and the clauses that make h
// primitive recursive.

import { useMemo, useState } from 'react';
import { R, type RF } from '../../engine/recursive/rf';
import { arity } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { classify, notation, unfoldRec, unwrap } from '../../engine/computability/primrec';
import { toSpec, type RFSpec } from '../../content/objects';
import { buildWithPaths, FunctionBuilder } from '../FunctionBuilder';
import { Panel } from '../coding';
import { Stepper } from '../../ui/Stepper';
import { Tex } from '../../ui/Tex';
import { Prov, NotAProof } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { CertificateView } from './Certificate';
import { fmtBig, FuelControl, NumField, parseNats, useRemembered } from './common';

interface Preset {
  id: string;
  label: string;
  /** the book's informal equations */
  tex: string;
  build: () => RF;
  xs: string;
  y: string;
  after?: string;
}

const pow2 = (): RF => {
  // The book's first example, made official (section "Primitive Recursion Functions"):
  // h′(x₀, 0) = f(x₀) = succ(zero(x₀)),  h′(x₀, y + 1) = g(x₀, y, h′(x₀, y)) with
  // g(x₀, y, z) = g′(P³₂(x₀, y, z)), g′(z) = mult(g″(z), P¹₀(z)), g″(z) = succ(f(z)).
  const f = () => R.def('f', 'f', R.comp(R.succ(), [R.zero()]));
  const g2 = R.def("g''", "g''", R.comp(R.succ(), [f()]));
  const g1 = R.def("g'", "g'", R.comp(Lib.mult(), [g2, R.proj(1, 0)]));
  const g = R.def('g', 'g', R.comp(g1, [R.proj(3, 2)]));
  return R.def("h'", "h'", R.rec(f(), g));
};

export const REC_PRESETS: Preset[] = [
  { id: 'pow2', label: "h(0) = 1, h(y+1) = 2·h(y)", tex: "h'(x_0, 0) = 1, \\quad h'(x_0, y+1) = 2 \\cdot h'(x_0, y)", build: pow2, xs: '0', y: '5', after: "h(y) = h'(P^1_0(y), P^1_0(y)) = 2^y" },
  { id: 'add', label: 'add', tex: '\\mathrm{add}(x, 0) = x, \\quad \\mathrm{add}(x, y+1) = \\mathrm{add}(x, y) + 1', build: Lib.add, xs: '2', y: '3' },
  { id: 'mult', label: 'mult', tex: '\\mathrm{mult}(x, 0) = 0, \\quad \\mathrm{mult}(x, y+1) = \\mathrm{add}(\\mathrm{mult}(x, y), x)', build: Lib.mult, xs: '2', y: '3' },
  { id: 'exp', label: 'exp', tex: '\\mathrm{exp}(x, 0) = 1, \\quad \\mathrm{exp}(x, y+1) = \\mathrm{mult}(x, \\mathrm{exp}(x, y))', build: Lib.exp, xs: '2', y: '5' },
  {
    id: 'fac',
    label: 'factorial’s h',
    tex: 'h(x, 0) = \\mathrm{const}_1(x), \\quad h(x, y+1) = \\mathrm{mult}(P^3_2, \\mathrm{succ}(P^3_1)) = h(x, y) \\cdot (y + 1)',
    build: () => {
      const f = unwrap(Lib.fac());
      return f.k === 'comp' ? f.f : f;
    },
    xs: '0',
    y: '5',
    after: 'fac(y) = h(P^1_0(y), P^1_0(y)) = h(y, y)',
  },
  { id: 'pred', label: "pred′", tex: "\\mathrm{pred}'(x, 0) = \\mathrm{zero}(x), \\quad \\mathrm{pred}'(x, y+1) = P^3_1(x, y, \\mathrm{pred}'(x, y)) = y", build: () => R.def("pred'", "\\mathrm{pred}'", R.rec(R.zero(), R.proj(3, 1))), xs: '0', y: '4', after: "\\mathrm{pred}(y) = \\mathrm{pred}'(\\mathrm{zero}(y), P^1_0(y))" },
  { id: 'tsub', label: 'x ∸ y', tex: 'x \\dot- 0 = x, \\quad x \\dot- (y+1) = \\mathrm{pred}(x \\dot- y)', build: Lib.tsub, xs: '7', y: '4' },
];

interface State {
  preset: string;
  custom: { f: RFSpec; g: RFSpec };
  xs: string;
  y: string;
}

const INITIAL: State = {
  preset: 'add',
  custom: { f: { k: 'proj', n: 1, i: 0 }, g: { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'proj', n: 3, i: 2 }] } },
  xs: '2',
  y: '3',
};

/** A TeX name for the base or step function in the equations. */
function partTex(f: RF, letter: string): string {
  return f.k === 'def' ? f.tex : letter;
}

export function PrimRecStepper({ focus = 'pre' }: { focus?: 'pre' | 'prf' | 'cmp' }) {
  const [st, setSt] = useRemembered<State>('stepper', INITIAL);
  const [fuel, setFuel] = useState(100_000);
  const preset = REC_PRESETS.find((p) => p.id === st.preset);
  const h = useMemo(() => {
    if (preset) return preset.build();
    return { k: 'rec', id: 'r', f: buildWithPaths(st.custom.f, 'r.f'), g: buildWithPaths(st.custom.g, 'r.g') } as RF;
  }, [preset, st.custom]);
  const rec = unwrap(h);
  const ar = arity(h);
  const errors = useMemo(() => new Map(ar.ok ? [] : ar.errors.map((e) => [e.id, e.message] as const)), [ar]);
  const k = ar.ok ? ar.arity - 1 : null;
  const xs = useMemo(() => (k !== null ? parseNats(st.xs, k, 50n) : 'fix the definition first'), [k, st.xs]);
  const yv = /^\d+$/.test(st.y.trim()) && BigInt(st.y.trim()) <= 30n ? BigInt(st.y.trim()) : null;
  const cls = classify(h);
  const u = useMemo(() => (typeof xs !== 'string' && yv !== null ? unfoldRec(h, xs, yv, { fuel }) : null), [h, xs, yv, fuel]);
  const [step, setStep] = useState(0);
  const rows = u && u.ok ? u.rows : [];
  const s = Math.min(step, Math.max(0, rows.length - 1));
  const fT = rec.k === 'rec' ? partTex(rec.f, 'f') : 'f';
  const gT = rec.k === 'rec' ? partTex(rec.g, 'g') : 'g';
  const xT = typeof xs !== 'string' ? xs.join(', ') : '\\vec x';
  const choose = (p: Preset) => {
    setSt({ ...st, preset: p.id, xs: p.xs, y: p.y });
    setStep(0);
  };
  const editCopy = () => {
    if (rec.k !== 'rec') return;
    setSt({ ...st, preset: 'custom', custom: { f: toSpec(rec.f), g: toSpec(rec.g) } });
  };
  return (
    <div className="workbench">
      <Panel n={1} title={<>Choose <Tex tex="f" /> and <Tex tex="g" /></>} prov={ar.ok ? <span className="muted small sans">h is {ar.arity}-place</span> : <Prov kind="failed">ill-formed</Prov>}>
        <div className="rc-presets" role="group" aria-label="Examples from the book">
          <span className="fi-label">From the book</span>
          {REC_PRESETS.map((p) => (
            <button key={p.id} className="chip-btn" aria-pressed={st.preset === p.id} onClick={() => choose(p)}>
              {p.label}
            </button>
          ))}
          <button className="chip-btn" aria-pressed={!preset} onClick={() => setSt({ ...st, preset: 'custom' })}>
            build your own
          </button>
        </div>
        {preset && (
          <div className="rc-eqs">
            <Tex tex={preset.tex} />
            {preset.after && (
              <div className="small muted sans">
                afterwards: <Tex tex={preset.after} />
              </div>
            )}
          </div>
        )}
        {!preset && (
          <div className="rc-split">
            <div className="rc-box">
              <span className="rc-kicker">base f(x⃗) — k-place, k ≥ 1</span>
              <FunctionBuilder spec={st.custom.f} path="r.f" errors={errors} onChange={(f) => setSt({ ...st, custom: { ...st.custom, f } })} />
            </div>
            <div className="rc-box">
              <span className="rc-kicker">step g(x⃗, y, z) — (k + 2)-place</span>
              <FunctionBuilder spec={st.custom.g} path="r.g" errors={errors} onChange={(g) => setSt({ ...st, custom: { ...st.custom, g } })} />
            </div>
          </div>
        )}
        {errors.get('r') && <p className="rc-err" role="alert">{errors.get('r')}</p>}
        {!preset && cls.pr === false && <p className="wb-note danger">This uses unbounded search μ, which is not one of the ways of building primitive recursive functions. The stepper still runs it.</p>}
        {!preset && cls.pr && cls.usesBasic && (
          <p className="wb-note">
            add, mult and <Tex tex="\chi_=" /> are offered by the builder as basic functions (they are basic in chapter 4); here they stand for their primitive recursive definitions.
          </p>
        )}
        {rec.k === 'rec' && ar.ok && (
          <div className="rc-eqs">
            <Tex
              display
              tex={`\\begin{aligned} h(x_0, \\ldots, x_{${(k ?? 1) - 1}}, 0) &= ${fT}(x_0, \\ldots, x_{${(k ?? 1) - 1}}) \\\\ h(x_0, \\ldots, x_{${(k ?? 1) - 1}}, y + 1) &= ${gT}(x_0, \\ldots, x_{${(k ?? 1) - 1}}, y, h(x_0, \\ldots, x_{${(k ?? 1) - 1}}, y)) \\end{aligned}`.replace(/x_0, \\ldots, x_\{0\}/g, 'x_0')}
            />
            <div className="small sans muted">
              In the book’s notation (<Ref k="cmp:rec:not:sec" />): <Tex tex={notation(rec, { keepNames: true, tex: true })} />
              {rec.k === 'rec' && preset && (
                <>
                  {' '}
                  <button className="linklike small" onClick={editCopy}>
                    edit a copy in the builder
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="rc-row">
          <NumField id="rs-xs" label={<>parameters <Tex tex="\vec x" /></>} value={st.xs} onChange={(v) => setSt({ ...st, xs: v })} width={90} hint="natural numbers up to 50, separated by commas" />
          <NumField id="rs-y" label={<>up to <Tex tex="y =" /></>} value={st.y} onChange={(v) => { setSt({ ...st, y: v }); setStep(Number.MAX_SAFE_INTEGER); }} width={60} hint="at most 30" />
          {typeof xs === 'string' && <span className="rc-err">{xs}</span>}
          {yv === null && <span className="rc-err">y: a number at most 30</span>}
        </div>
      </Panel>

      {u && !u.ok && (
        <Panel n={2} title="The recursion">
          <p className="wb-note danger">{u.error}.</p>
        </Panel>
      )}
      {u && u.ok && (
        <Panel n={2} title={<>Computing <Tex tex={`h(${xT}, 0), \\ldots, h(${xT}, ${yv})`} /></>} prov={<Prov kind="computed" />}>
          <p className="wb-note">
            {focus === 'cmp'
              ? 'To compute h(x⃗, y), compute h(x⃗, 0), h(x⃗, 1), … in turn: each row needs only the one before it, and one computation of f or g.'
              : 'Each row applies one of the two equations. Only the immediately preceding value is used — that is what makes the recursion primitive.'}
          </p>
          <Stepper
            step={s}
            count={rows.length}
            onStep={setStep}
            label="row"
            describe={(i) => {
              const r = rows[i];
              if (!r) return null;
              return r.y === 0n ? (
                <>
                  <Tex tex={`h(${xT}, 0) = ${fT}(${xT})`} /> {r.value !== undefined ? <>= {fmtBig(r.value)}</> : <em>— no answer within the budget</em>}
                </>
              ) : (
                <>
                  <Tex tex={`h(${xT}, ${r.y}) = ${gT}(${xT}, ${r.y - 1n}, h(${xT}, ${r.y - 1n}))`} /> {r.value !== undefined ? <>= {fmtBig(r.value)}</> : <em>— no answer within the budget</em>}
                </>
              );
            }}
          />
          <div className="rc-scroll">
            <table className="rc-table">
              <thead>
                <tr>
                  <th scope="col">row</th>
                  <th scope="col">equation used</th>
                  <th scope="col" className="num">value</th>
                  <th scope="col" className="num">calls</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prev = rows[i - 1]?.value;
                  return (
                    <tr key={String(r.y)} className={i === s ? 'current' : i > s ? 'future' : ''}>
                      <td className="num">{r.y.toString()}</td>
                      <td>
                        {r.y === 0n ? (
                          <Tex tex={`h(${xT}, 0) = ${fT}(${xT})`} />
                        ) : (
                          <Tex tex={`h(${xT}, ${r.y}) = ${gT}(${xT}, ${r.y - 1n}, ${i <= s && prev !== undefined ? fmtBig(prev, 16) : `h(${xT}, ${r.y - 1n})`})`} />
                        )}
                      </td>
                      <td className="num">{i <= s ? (r.value !== undefined ? fmtBig(r.value, 24) : <span className="rc-unknown">not within budget</span>) : ''}</td>
                      <td className="num">{i <= s ? r.calls.toLocaleString('en-US') : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {u.status === 'out-of-fuel' && (
            <p className="wb-note">
              The budget of {fuel.toLocaleString('en-US')} function calls ran out at row {rows[rows.length - 1].y.toString()}. That is a fact about the budget, not about h: a
              function defined by primitive recursion from total functions has a value everywhere (<Ref k="cmp:rec:cmp:sec" />). Raise the budget or lower y.
            </p>
          )}
          <FuelControl value={fuel} onChange={setFuel} options={[2_000, 100_000, 1_000_000]} />
          <hr className="rc-sep" />
          <span className="rc-kicker">Unfolded, as in <Ref k="cmp:rec:cmp:sec" /></span>
          <div className="rc-math rc-nested">
            <Tex tex={`h(${xT}, ${rows[s]?.y ?? 0}) = ${nested(fT, gT, xT, Number(rows[s]?.y ?? 0))}`} />
          </div>
          <NotAProof>
            The rows compute these particular values. That the equations define a unique total function for every <Tex tex="\vec x" /> and <Tex tex="y" /> is the argument in{' '}
            <Ref k="cmp:rec:pre:sec" />: every number is reached from 0 by adding 1.
          </NotAProof>
        </Panel>
      )}

      {focus === 'prf' && ar.ok && (
        <Panel n={3} title={<>Why <Tex tex="h" /> is primitive recursive</>} prov={<Prov kind="computed" />}>
          <CertificateView f={h} />
        </Panel>
      )}
    </div>
  );
}

/** g(x⃗, y−1, g(x⃗, y−2, … g(x⃗, 0, f(x⃗)) …)), elided in the middle for large y. */
function nested(fT: string, gT: string, xT: string, y: number): string {
  if (y === 0) return `${fT}(${xT})`;
  const full = y <= 4;
  const levels = full ? Array.from({ length: y }, (_, i) => y - 1 - i) : [y - 1, y - 2, -1, 0];
  let open = '';
  let close = '';
  for (const j of levels) {
    if (j === -1) {
      open += '\\cdots ';
      close = ' \\cdots' + close;
      continue;
    }
    open += `${gT}(${xT}, ${j}, `;
    close = ')' + close;
  }
  return `${open}${fT}(${xT})${close}`;
}
