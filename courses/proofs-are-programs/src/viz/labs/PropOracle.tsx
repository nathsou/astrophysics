// The provability oracle: for a propositional formula, either a proof term,
// or a reason why there is none (a falsifying valuation, or a Kripke countermodel
// when the formula is only classically true).

import { For, Show, createMemo, createSignal } from 'solid-js';
import { judge, parseF, showF, theoremDecl, atoms, forces, subformulas, type F, type Kripke } from '../../engines/props.ts';
import { CodeBlock } from '../CodeBlock.tsx';

const DEFAULT_PRESETS = 'p ∧ q → q ∧ p;(p → q) → ¬q → ¬p;¬(p ∨ q) ↔ ¬p ∧ ¬q;p ∨ ¬p;¬¬p → p;¬¬(p ∨ ¬p);p → q';

export function PropOracle(props: { formula?: string; presets?: string; title?: string }) {
  const presets = () => (props.presets ?? DEFAULT_PRESETS).split(';');
  const [src, setSrc] = createSignal(props.formula ?? presets()[0]);
  const res = createMemo(() => {
    try {
      const f = parseF(src());
      return { f, v: judge(f) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });
  return (
    <div class="widget oracle">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Is it provable?'}</span>
      </div>
      <div class="widget-body">
        <div class="row" style={{ 'flex-wrap': 'wrap', gap: '0.35rem' }}>
          <For each={presets()}>
            {(p) => (
              <button class={`btn small ${src() === p ? 'active' : ''}`} onClick={() => setSrc(p)}>
                <span class="mono">{p}</span>
              </button>
            )}
          </For>
        </div>
        <label class="inh-input">
          <span class="label">statement</span>
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a propositional formula using p, q, r, ∧, ∨, →, ¬, ↔" />
        </label>
        <div class="muted small">
          Use letters for propositions and <span class="mono">∧ ∨ → ¬ ↔ True False</span> (or <span class="mono">/\ \/ -&gt; ~ &lt;-&gt;</span>).
        </div>
        <Show when={!('error' in res())} fallback={<div class="msg error">{(res() as { error: string }).error}</div>}>
          {(() => {
            const r = () => res() as { f: F; v: ReturnType<typeof judge> };
            return (
              <>
                <Show when={r().v.kind === 'provable'}>
                  <div class="inh-verdict some">Provable. Here is a proof, found by a search procedure: a program of this type.</div>
                  <CodeBlock code={theoremDecl(r().f, (r().v as { term: string }).term)} lang="lean" />
                </Show>
                <Show when={r().v.kind === 'false'}>
                  <div class="inh-verdict none">Not provable: it is false when {valuationText((r().v as { valuation: Record<string, boolean> }).valuation)}. A proof would be evidence for a false statement.</div>
                </Show>
                <Show when={r().v.kind === 'classical'}>
                  <div class="inh-verdict many">
                    True in every row of the truth table, but <b>not provable</b> in the course language (without axioms). Below is a <i>Kripke model</i> where it fails: a picture of evidence that grows over time.
                  </div>
                  <Show when={(r().v as { model?: Kripke }).model}>{(m) => <KripkeView model={m()} formula={r().f} />}</Show>
                </Show>
                <Show when={r().v.kind === 'unknown'}>
                  <div class="inh-verdict many">The search gave up: the statement is too big for this widget.</div>
                </Show>
              </>
            );
          })()}
        </Show>
      </div>
    </div>
  );
}

function valuationText(v: Record<string, boolean>): string {
  return Object.entries(v)
    .map(([a, b]) => `${a} is ${b ? 'true' : 'false'}`)
    .join(' and ');
}

/** a Kripke model drawn as a tree growing upwards, with the forcing table of the formula's subformulas */
export function KripkeView(props: { model: Kripke; formula: F }) {
  const m = () => props.model;
  // depth and horizontal slot of each world
  const layout = createMemo(() => {
    const n = m().n;
    const parent = new Array(n).fill(-1);
    for (let v = 1; v < n; v++) {
      // the closest strict predecessor
      let best = -1;
      for (let u = 0; u < n; u++) if (u !== v && m().le[u][v] && (best < 0 || m().le[best][u])) best = u;
      parent[v] = best;
    }
    const depth = parent.map((_, v) => {
      let d = 0;
      for (let u = v; parent[u] >= 0; u = parent[u]) d++;
      return d;
    });
    const maxD = Math.max(...depth);
    const byDepth: number[][] = Array.from({ length: maxD + 1 }, () => []);
    depth.forEach((d, v) => byDepth[d].push(v));
    const W = 280;
    const H = 70 * maxD + 60;
    const pos = depth.map((d, v) => {
      const row = byDepth[d];
      const i = row.indexOf(v);
      return { x: ((i + 1) * W) / (row.length + 1), y: H - 30 - d * 70 };
    });
    return { parent, pos, W, H };
  });
  const as = () => atoms(props.formula);
  const subs = () => subformulas(props.formula).filter((g) => g.k !== 'atom');
  return (
    <div class="kripke">
      <svg viewBox={`0 0 ${layout().W} ${layout().H}`} width={layout().W} height={layout().H} role="img" aria-label="Kripke model">
        <For each={layout().parent}>
          {(p, v) => (
            <Show when={p >= 0}>
              <line x1={layout().pos[p].x} y1={layout().pos[p].y} x2={layout().pos[v()].x} y2={layout().pos[v()].y} class="kr-edge" />
            </Show>
          )}
        </For>
        <For each={layout().pos}>
          {(q, v) => {
            const trueAtoms = () => as().filter((a) => m().val[a]?.[v()]);
            return (
              <g>
                <circle cx={q.x} cy={q.y} r={16} class={`kr-world ${v() === 0 ? 'root' : ''}`} />
                <text x={q.x} y={q.y + 4} text-anchor="middle" class="kr-label">
                  w{v()}
                </text>
                <text x={q.x + 22} y={q.y + 4} class="kr-atoms">
                  {trueAtoms().length ? trueAtoms().join(', ') : '—'}
                </text>
              </g>
            );
          }}
        </For>
      </svg>
      <div class="kr-explain small">
        <p>
          Worlds are stages of knowledge; moving up means learning more. An atom listed next to a world has evidence there, and keeps it at every later stage. At <b>w0</b>, the bottom stage:
        </p>
        <table class="kr-table">
          <thead>
            <tr>
              <th>statement</th>
              <For each={layout().pos}>{(_, v) => <th>w{v()}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={subs()}>
              {(g) => (
                <tr>
                  <td class="mono">{showF(g)}</td>
                  <For each={layout().pos}>{(_, v) => <td class={forces(m(), v(), g) ? 'yes' : 'no'}>{forces(m(), v(), g) ? '✓' : '·'}</td>}</For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <p class="muted">
          ✓: the statement holds at that stage. An implication (and a negation) holds at a stage only if it holds at every later stage too; a disjunction only if one side already holds.{' '}
          {forces(m(), 0, props.formula) ? 'Here the whole statement holds at w0.' : 'So at w0, the whole statement fails.'}
        </p>
      </div>
    </div>
  );
}
