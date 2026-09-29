// Explore Kripke models: pick a frame, choose which atoms have evidence at which
// stage (kept upward closed), and watch which statements hold where.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { atoms, forces, parseF, type Kripke } from '../../engines/props.ts';
import { KripkeView } from './PropOracle.tsx';

const FRAMES: { name: string; parent: number[] }[] = [
  { name: 'one stage', parent: [-1] },
  { name: 'two stages', parent: [-1, 0] },
  { name: 'three in a row', parent: [-1, 0, 1] },
  { name: 'a fork', parent: [-1, 0, 0] },
];

function leOf(parent: number[]): boolean[][] {
  const n = parent.length;
  const le = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let v = 0; v < n; v++) for (let u = v; u >= 0; u = parent[u]) le[u][v] = true;
  return le;
}

export function KripkeLab(props: { formula?: string; presets?: string; frame?: number }) {
  const presets = () => (props.presets ?? 'p ∨ ¬p;¬¬p → p;¬p ∨ ¬¬p;(p → q) ∨ (q → p);¬¬(p ∨ ¬p)').split(';');
  const [src, setSrc] = createSignal(props.formula ?? presets()[0]);
  const [frame, setFrame] = createSignal(props.frame ?? 1);
  // val[atom][world]
  const [val, setVal] = createSignal<Record<string, boolean[]>>({ p: [false, true, true], q: [false, false, false] });
  const parsed = createMemo(() => {
    try {
      return { f: parseF(src()) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  const as = createMemo(() => {
    const p = parsed();
    return p.f ? atoms(p.f) : [];
  });
  const le = createMemo(() => leOf(FRAMES[frame()].parent));
  const n = () => FRAMES[frame()].parent.length;
  const model = createMemo((): Kripke => {
    const v: Record<string, boolean[]> = {};
    for (const a of as()) v[a] = Array.from({ length: n() }, (_, w) => !!val()[a]?.[w]);
    return { n: n(), le: le(), val: v };
  });
  const toggle = (a: string, w: number) => {
    const cur = { ...val() };
    const arr = Array.from({ length: 3 }, (_, i) => !!cur[a]?.[i]);
    const on = !arr[w];
    // keep evidence upward closed: switching on also switches on every later stage,
    // switching off also switches off every earlier one
    for (let u = 0; u < n(); u++) {
      if (on && le()[w][u]) arr[u] = true;
      if (!on && le()[u][w]) arr[u] = false;
    }
    cur[a] = arr;
    setVal(cur);
  };
  return (
    <div class="widget oracle">
      <div class="widget-head">
        <span class="widget-title">Kripke models</span>
      </div>
      <div class="widget-body">
        <div class="row" style={{ 'flex-wrap': 'wrap', gap: '0.35rem' }}>
          <span class="label">frame</span>
          <For each={FRAMES}>
            {(f, i) => (
              <button class={`btn small ${frame() === i() ? 'active' : ''}`} onClick={() => setFrame(i())}>
                {f.name}
              </button>
            )}
          </For>
        </div>
        <div class="row" style={{ 'flex-wrap': 'wrap', gap: '0.35rem', 'margin-top': '0.4rem' }}>
          <span class="label">statement</span>
          <For each={presets()}>
            {(p) => (
              <button class={`btn small ${src() === p ? 'active' : ''}`} onClick={() => setSrc(p)}>
                <span class="mono">{p}</span>
              </button>
            )}
          </For>
        </div>
        <label class="inh-input">
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a propositional formula" />
        </label>
        <Show when={'f' in parsed()} fallback={<div class="msg error">{(parsed() as { error: string }).error}</div>}>
          <div class="kr-toggles">
            <span class="label">evidence</span>
            <For each={as()}>
              {(a) => (
                <div class="kr-toggle-row">
                  <span class="mono">{a}</span>
                  <For each={Array.from({ length: n() }, (_, w) => w)}>
                    {(w) => (
                      <button class={`btn small ${model().val[a]?.[w] ? 'active' : ''}`} onClick={() => toggle(a, w)} title={`evidence for ${a} at stage w${w}`}>
                        w{w}
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
          <div class={`inh-verdict ${forces(model(), 0, (parsed() as { f: import('../../engines/props.ts').F }).f) ? 'some' : 'none'}`}>
            At the first stage w0, the statement {forces(model(), 0, (parsed() as { f: import('../../engines/props.ts').F }).f) ? 'holds' : 'does not hold'}.
          </div>
          <KripkeView model={model()} formula={(parsed() as { f: import('../../engines/props.ts').F }).f} />
        </Show>
      </div>
    </div>
  );
}
