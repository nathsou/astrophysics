// Composition (section "Composition"): h(x⃗) = f(g_0(x⃗), …, g_{k−1}(x⃗)), evaluated part by part,
// with the book's examples of projections used to ignore, repeat and reorder arguments.

import { useMemo, useState } from 'react';
import { R, type RF } from '../../engine/recursive/rf';
import { arity } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { compositionParts, notation, unwrap } from '../../engine/computability/primrec';
import type { RFSpec } from '../../content/objects';
import { buildWithPaths, FunctionBuilder } from '../FunctionBuilder';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { fmtBig, nameTex, NumField, parseNats, useRemembered } from './common';

interface Preset {
  id: string;
  label: string;
  tex: string;
  build: () => RF;
  args: string;
  note: string;
}

const sum3 = () => R.def('f', 'f', R.comp(Lib.add(), [R.proj(3, 0), R.comp(Lib.add(), [R.proj(3, 1), R.proj(3, 2)])]));
const g3 = () => R.def('g', 'g', R.comp(Lib.add(), [R.comp(Lib.mult(), [R.proj(3, 0), R.proj(3, 1)]), R.proj(3, 2)]));

const PRESETS: Preset[] = [
  {
    id: 'ignore',
    label: 'g(x, y, z) = succ(z)',
    tex: 'g(x, y, z) = \\mathrm{succ}(P^3_2(x, y, z))',
    build: () => R.def('g', 'g', R.comp(R.succ(), [R.proj(3, 2)])),
    args: '4, 7, 1',
    note: 'The step function of add: succ is 1-place (k = 1), and one 3-place function P³₂ plays the role of g₀. The projection lets g ignore x and y.',
  },
  {
    id: 'repeat',
    label: 'h(x) = add(x, x)',
    tex: 'h(x_0) = \\mathrm{add}(P^1_0(x_0), P^1_0(x_0))',
    build: () => R.def('h', 'h', R.comp(Lib.add(), [R.proj(1, 0), R.proj(1, 0)])),
    args: '5',
    note: 'Identifying arguments: k = 2, n = 1, and both inner functions are the identity P¹₀.',
  },
  {
    id: 'swap',
    label: 'h(x₀, x₁) = f(x₁, x₀)',
    tex: 'h(x_0, x_1) = f(P^2_1(x_0, x_1), P^2_0(x_0, x_1)) \\quad\\text{with } f = \\dot-',
    build: () => R.def('h', 'h', R.comp(Lib.tsub(), [R.proj(2, 1), R.proj(2, 0)])),
    args: '7, 2',
    note: 'Reordering arguments. With f(y₀, y₁) = y₀ ∸ y₁, the composition computes x₁ ∸ x₀.',
  },
  {
    id: 'mixed',
    label: 'h(x, y) = f(x, g(x, x, y), y)',
    tex: 'h(x, y) = f(P^2_0(x,y),\\, l(x, y),\\, P^2_1(x,y)), \\quad l(x, y) = g(P^2_0(x,y), P^2_0(x,y), P^2_1(x,y))',
    build: () => R.def('h', 'h', R.comp(sum3(), [R.proj(2, 0), R.def('l', 'l', R.comp(g3(), [R.proj(2, 0), R.proj(2, 0), R.proj(2, 1)])), R.proj(2, 1)])),
    args: '3, 1',
    note: 'The book’s example with f and g 3-place; here f(a, b, c) = a + b + c and g(a, b, c) = a·b + c. The inner function l is itself a composition: open it below.',
  },
];

interface State {
  preset: string;
  custom: RFSpec;
  args: string;
}

export function CompositionLab() {
  const [st, setSt] = useRemembered<State>('composition', {
    preset: 'ignore',
    custom: { k: 'comp', f: { k: 'basic', name: 'add' }, gs: [{ k: 'proj', n: 2, i: 1 }, { k: 'succ' }] },
    args: '4, 7, 1',
  });
  const preset = PRESETS.find((p) => p.id === st.preset);
  const h = useMemo(() => (preset ? preset.build() : buildWithPaths(st.custom)), [preset, st.custom]);
  const ar = arity(h);
  const errors = useMemo(() => new Map(ar.ok ? [] : ar.errors.map((e) => [e.id, e.message] as const)), [ar]);
  const n = ar.ok ? ar.arity : null;
  const args = useMemo(() => (n !== null ? parseNats(st.args, n, 40n) : 'fix the definition first'), [n, st.args]);
  const top = unwrap(h);
  return (
    <div className="workbench">
      <Panel n={1} title="A composition" prov={ar.ok ? <span className="muted small sans">{ar.arity}-place</span> : <Prov kind="failed">ill-formed</Prov>}>
        <div className="rc-presets" role="group" aria-label="Examples from the book">
          <span className="fi-label">From the book</span>
          {PRESETS.map((p) => (
            <button key={p.id} className="chip-btn" aria-pressed={st.preset === p.id} onClick={() => setSt({ ...st, preset: p.id, args: p.args })}>
              {p.label}
            </button>
          ))}
          <button className="chip-btn" aria-pressed={!preset} onClick={() => setSt({ ...st, preset: 'custom', args: '3, 4' })}>
            build your own
          </button>
        </div>
        {preset ? (
          <>
            <div className="rc-eqs">
              <Tex tex={preset.tex} />
            </div>
            <p className="wb-note">{preset.note}</p>
          </>
        ) : (
          <>
            <p className="wb-note">
              Build a composition: an outer <Tex tex="k" />-place function and <Tex tex="k" /> inner functions, all <Tex tex="n" />-place. Try giving the inner functions different
              numbers of arguments to see what the definition forbids.
            </p>
            <div className="rc-builder">
              <FunctionBuilder spec={st.custom} onChange={(custom) => setSt({ ...st, custom })} errors={errors} />
            </div>
          </>
        )}
        {ar.ok && top.k === 'comp' && (
          <p className="small sans muted">
            In the book’s notation (<Ref k="cmp:rec:not:sec" />): <Tex tex={notation(top, { keepNames: true, tex: true })} />
          </p>
        )}
        <div className="rc-row">
          <NumField id="cl-args" label="arguments" value={st.args} onChange={(v) => setSt({ ...st, args: v })} width={110} hint="natural numbers up to 40, separated by commas" />
          {typeof args === 'string' && <span className="rc-err">{args}</span>}
        </div>
      </Panel>
      {ar.ok && top.k !== 'comp' && (
        <Panel n={2} title="Not a composition">
          <p className="wb-note">The outermost step of this definition is not a composition. Choose “composition” at the top of the builder.</p>
        </Panel>
      )}
      {ar.ok && top.k === 'comp' && typeof args !== 'string' && (
        <Panel n={2} title="First the inner functions, then the outer one" prov={<Prov kind="computed" />}>
          <p className="wb-note">
            To compute <Tex tex={`${h.k === 'def' ? h.tex : 'h'}(${args.join(', ')})`} />, first compute <Tex tex="y_i = g_i(\vec x)" /> for each <Tex tex="i" />, then feed the <Tex tex="y_i" /> into{' '}
            <Tex tex="f" />.
          </p>
          <Flow h={top} args={args} depth={0} name={h.k === 'def' ? h.tex : 'h'} />
        </Panel>
      )}
    </div>
  );
}

function Flow({ h, args, depth, name }: { h: RF; args: bigint[]; depth: number; name: string }) {
  const r = useMemo(() => compositionParts(h, args, { fuel: 200_000 }), [h, args]);
  const [open, setOpen] = useState<number | null>(null);
  if (!r.ok) return <p className="rc-err">{r.error}</p>;
  const p = r.parts;
  const xT = args.join(', ');
  return (
    <div className="rc-flow" aria-live={depth === 0 ? 'polite' : undefined}>
      <div className="rc-flow-row">
        <span className="rc-kicker">input</span>
        <Tex tex={`\\vec x = (${xT})`} />
      </div>
      {p.gs.map((g, i) => {
        const v = p.inner[i];
        const inner = unwrap(g);
        return (
          <div key={g.id}>
            <div className="rc-flow-row">
              <span className="rc-kicker">{`inner g${'₀₁₂₃₄₅₆₇₈₉'[i] ?? i}`}</span>
              <Tex tex={`${nameTex(g)}(${xT}) = ${v ? (v.value !== undefined ? fmtBig(v.value, 20) : '?') : '\\cdot'}`} />
              {v && <span className="rc-hint">{v.calls} call{v.calls === 1 ? '' : 's'}</span>}
              {inner.k === 'comp' && depth < 3 && (
                <button className="linklike small" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  {open === i ? 'close' : 'see inside'}
                </button>
              )}
            </div>
            {open === i && inner.k === 'comp' && (
              <div className="rc-children">
                <Flow h={inner} args={args} depth={depth + 1} name={nameTex(g)} />
              </div>
            )}
          </div>
        );
      })}
      {p.outer && (
        <div className="rc-flow-row out">
          <span className="rc-kicker">outer f</span>
          <Tex tex={`${nameTex(p.f)}(${p.inner.map((i) => (i.value !== undefined ? fmtBig(i.value, 12) : '?')).join(', ')}) = ${p.outer.value !== undefined ? fmtBig(p.outer.value, 20) : '?'}`} />
          <span className="rc-arrow" aria-hidden="true">
            ⇒
          </span>
          <Tex tex={`${name}(${xT}) = ${p.outer.value !== undefined ? fmtBig(p.outer.value, 20) : '?'}`} />
        </div>
      )}
      {p.status === 'out-of-fuel' && <p className="wb-note">No answer within the budget of 200,000 function calls (not a sign that there is none).</p>}
    </div>
  );
}
