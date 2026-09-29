// How many programs does a type have? Enumerates the normal forms of a simple type.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { enumerate, parseTy, showTm, showTy, asDecl, size } from '../../engines/inhabit.ts';

export function InhabitantLab(props: { type?: string; presets?: string; title?: string }) {
  const presets = () => (props.presets ?? 'α → α;α → β;α → α → α;(α → α) → α → α;α × β → β × α;(α → β) → (β → γ) → α → γ;((α → β) → α) → α').split(';');
  const [src, setSrc] = createSignal(props.type ?? 'α → α');
  const res = createMemo(() => {
    try {
      const ty = parseTy(src());
      const e = enumerate(ty, 10, 16);
      return { ty, e };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });
  const verdict = () => {
    const r = res();
    if ('error' in r) return '';
    const n = r.e.terms.length;
    if (n === 0) return 'No program has this type: its promise cannot be kept.';
    if (!r.e.truncated) return n === 1 ? 'Exactly one program has this type: the type determines it completely.' : `Exactly ${n} programs have this type.`;
    return `At least ${n} programs — the list goes on (showing the smallest).`;
  };
  return (
    <div class="widget inhabitants">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'The programs of a type'}</span>
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
          <span class="label">type</span>
          <input class="input mono" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} aria-label="a type built from α, β, γ, → and ×" />
        </label>
        <Show when={!('error' in res())} fallback={<div class="msg error">{(res() as { error: string }).error}</div>}>
          {(() => {
            const r = res() as Exclude<ReturnType<typeof res>, { error: string }>;
            return (
              <>
                <div class={`inh-verdict ${r.e.terms.length === 0 ? 'none' : r.e.truncated ? 'many' : 'some'}`}>{verdict()}</div>
                <ol class="inh-list">
                  <For each={r.e.terms}>
                    {(t) => (
                      <li>
                        <code class="mono">{showTm(t)}</code>
                        <span class="muted inh-size">size {size(t)}</span>
                        <a class="btn small ghost" href={`#/playground?code=${btoa(unescape(encodeURIComponent(asDecl(r.ty, t))))}`} title="check it in the playground">
                          check
                        </a>
                      </li>
                    )}
                  </For>
                </ol>
                <div class="widget-foot muted">
                  Programs of type <span class="mono">{showTy(r.ty)}</span> for all types α, β, γ, in normal form (every program computes to one of these). Use α β γ, → and ×.
                </div>
              </>
            );
          })()}
        </Show>
      </div>
    </div>
  );
}
