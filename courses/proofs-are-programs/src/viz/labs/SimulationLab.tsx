// The simulation square: an expression, its value, its compiled code, and the stack
// machine running that code, step by step. The compiler is correct when the square
// "commutes": running the code leaves exactly the value of the expression on the stack.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { parseEx, evalEx, compileEx, trace, showInstr, VARS, type Ex } from '../../engines/stackmachine.ts';

export function SimulationLab(props: { expr?: string; buggy?: boolean }) {
  const [src, setSrc] = createSignal(props.expr ?? '2 * (x + 3) - y');
  const [env, setEnv] = createSignal<number[]>([4, 5, 1]);
  const [buggy, setBuggy] = createSignal(!!props.buggy);
  const [step, setStep] = createSignal(0);
  const parsed = createMemo(() => {
    try {
      return { e: parseEx(src()) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });
  const e = () => (parsed() as { e?: Ex }).e;
  const code = createMemo(() => (e() ? compileEx(e()!, buggy()) : []));
  const frames = createMemo(() => (e() ? trace(env(), code()) : []));
  const frame = () => frames()[Math.min(step(), frames().length - 1)];
  const value = () => (e() ? evalEx(env(), e()!) : 0);
  const done = () => frame() && frame().pc === code().length;
  const agrees = () => done() && frame().stack.length === 1 && frame().stack[0].v === value();
  const current = () => (frame() && frame().pc < code().length ? code()[frame().pc] : undefined);
  const highlight = (s: string, span?: [number, number]) =>
    span ? (
      <>
        {s.slice(0, span[0])}
        <mark>{s.slice(span[0], span[1])}</mark>
        {s.slice(span[1])}
      </>
    ) : (
      s
    );
  return (
    <div class="widget sim">
      <div class="widget-head">
        <span class="widget-title">The simulation square</span>
      </div>
      <div class="widget-body">
        <div class="row" style={{ 'flex-wrap': 'wrap', gap: '0.5rem', 'align-items': 'center' }}>
          <label class="inh-input" style={{ flex: '1 1 14rem' }}>
            <span class="label">expression</span>
            <input
              class="input mono"
              value={src()}
              onInput={(ev) => {
                setSrc(ev.currentTarget.value);
                setStep(0);
              }}
              spellcheck={false}
              aria-label="an expression with numbers, x, y, z, +, - and *"
            />
          </label>
          <For each={VARS}>
            {(v, i) => (
              <label class="sim-var">
                <span class="mono">{v} =</span>
                <input
                  class="input mono"
                  type="number"
                  min="0"
                  value={env()[i()]}
                  onInput={(ev) => {
                    const n = [...env()];
                    n[i()] = Math.max(0, Number(ev.currentTarget.value) || 0);
                    setEnv(n);
                  }}
                />
              </label>
            )}
          </For>
          <label class="sim-var">
            <input type="checkbox" checked={buggy()} onChange={(ev) => setBuggy(ev.currentTarget.checked)} /> buggy compiler (swaps the operands of −)
          </label>
        </div>
        <Show when={e()} fallback={<div class="msg error">{(parsed() as { error: string }).error}</div>}>
          <div class="sim-square">
            <div class="sim-cell">
              <div class="label">expression</div>
              <div class="mono sim-expr">{highlight(src(), current()?.from.span)}</div>
            </div>
            <div class="sim-arrow">
              eval <span aria-hidden="true">→</span>
            </div>
            <div class="sim-cell">
              <div class="label">value</div>
              <div class="mono sim-big">{value()}</div>
            </div>
            <div class="sim-arrow down">
              compile <span aria-hidden="true">↓</span>
            </div>
            <div />
            <div class="sim-arrow down">
              <span class={agrees() ? 'ok' : done() ? 'bad' : ''}>{done() ? (agrees() ? '= ✓' : '≠ ✗') : '?'}</span>
            </div>
            <div class="sim-cell">
              <div class="label">code</div>
              <ol class="sim-code mono">
                <For each={code()}>
                  {(c, i) => (
                    <li class={i() === frame()?.pc ? 'current' : i() < (frame()?.pc ?? 0) ? 'done' : ''} onClick={() => setStep(i())}>
                      {showInstr(c.ins)}
                    </li>
                  )}
                </For>
              </ol>
            </div>
            <div class="sim-arrow">
              exec <span aria-hidden="true">→</span>
            </div>
            <div class="sim-cell">
              <div class="label">stack (top first)</div>
              <ul class="sim-stack mono">
                <For each={frame()?.stack ?? []} fallback={<li class="muted">empty</li>}>
                  {(x) => (
                    <li>
                      <b>{x.v}</b>
                      <Show when={x.from}>
                        <span class="muted"> ← {src().slice(x.from!.span[0], x.from!.span[1])}</span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </div>
          <div class="row" style={{ gap: '0.4rem', 'margin-top': '0.5rem' }}>
            <button class="btn small" onClick={() => setStep(0)}>
              ⏮ reset
            </button>
            <button class="btn small" disabled={step() === 0} onClick={() => setStep(step() - 1)}>
              ◀ back
            </button>
            <button class="btn small" disabled={done()} onClick={() => setStep(step() + 1)}>
              step ▶
            </button>
            <button class="btn small" onClick={() => setStep(frames().length - 1)}>
              run to the end ⏭
            </button>
            <span class="muted small">
              {frame()?.pc ?? 0} / {code().length} instructions
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}
