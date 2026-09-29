// Proof by reflection, step by step: a propositional formula is reified into a `Form`
// (the job a tactic would do), the verified checker `taut` evaluates it on every row of
// the truth table, and the proof `taut_sound f rfl (atoms […])` is checked by the kernel,
// which runs `taut f` itself.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { evalF, type F } from '../../engines/props.ts';
import { reflectionProof, reify } from '../../engines/reflect.ts';
import { Playground } from '../Playground.tsx';

export function ReflectionLab(props: { formula?: string; setup: string }) {
  const [src, setSrc] = createSignal(props.formula ?? '((p → q) → p) → p');
  const res = createMemo(() => {
    try {
      return reflectionProof(src());
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  const ok = () => res() as { f: F; names: string[]; code: string };
  const rows = createMemo(() => {
    if ('error' in res()) return [];
    const { f, names } = ok();
    return Array.from({ length: 2 ** names.length }, (_, i) => {
      const v: Record<string, boolean> = {};
      names.forEach((n, k) => (v[n] = ((i >> (names.length - 1 - k)) & 1) === 0));
      return { v, value: evalF(f, v) };
    });
  });
  const taut = () => rows().every((r) => r.value);
  return (
    <div class="widget reflect">
      <div class="widget-head">
        <span class="widget-title">Proof by reflection</span>
      </div>
      <div class="widget-body">
        <label class="inh-input">
          <span class="label">a statement about propositions</span>
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a propositional formula" />
        </label>
        <div class="muted small">
          Letters for propositions, and <span class="mono">∧ ∨ → ¬ ↔ True False</span> (or <span class="mono">/\ \/ -&gt; ~ &lt;-&gt;</span>).
        </div>
        <Show when={!('error' in res())} fallback={<div class="msg error">{(res() as { error: string }).error}</div>}>
          <div class="reflect-steps">
            <div class="reflect-step">
              <div class="label">1 · reify: the statement as data</div>
              <div class="mono small">
                <For each={ok().names}>
                  {(n, i) => (
                    <span class="reflect-atom">
                      .var {i()} ↦ {n}
                    </span>
                  )}
                </For>
              </div>
              <pre class="mono small reflect-term">{reify(ok().f, ok().names)}</pre>
            </div>
            <div class="reflect-step">
              <div class="label">2 · compute: taut tries every row</div>
              <div class="reflect-table-wrap">
                <table class="reflect-table mono small">
                  <thead>
                    <tr>
                      <For each={ok().names}>{(n) => <th>{n}</th>}</For>
                      <th>eval</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={rows()}>
                      {(r) => (
                        <tr class={r.value ? '' : 'bad'}>
                          <For each={ok().names}>{(n) => <td>{r.v[n] ? 'T' : 'F'}</td>}</For>
                          <td>{r.value ? 'true' : 'false'}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <div class={`inh-verdict ${taut() ? 'some' : 'none'}`}>
                taut f = {taut() ? 'true' : 'false'}
                {taut() ? ': the kernel will accept rfl.' : ': rfl will fail, and no proof is produced.'}
              </div>
            </div>
          </div>
          <div class="label" style={{ 'margin-top': '0.6rem' }}>
            3 · check: the whole proof, as the kernel sees it
          </div>
          <Show when={ok().code} keyed>
            {(code) => <Playground code={code} setup={props.setup} title="The proof" noBridge />}
          </Show>
        </Show>
      </div>
    </div>
  );
}
