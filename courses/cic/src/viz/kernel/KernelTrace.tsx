// A trace of the kernel's work on a declaration: type inference, weak head
// normalisation and definitional equality checks.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../../app/kernel.ts';
import { TypeChecker, type TraceEvent } from '@kernel/core/typechecker.ts';
import { Term } from '../Term.tsx';
import { Editor } from '../Editor.tsx';
import type { Decl } from '@kernel/core/env.ts';

const kindLabel: Record<TraceEvent['kind'], string> = {
  infer: 'infer',
  whnf: 'whnf',
  defeq: 'defeq',
  unfold: 'δ unfold',
  iota: 'ι',
  beta: 'β',
};

export function KernelTrace(props: { code: string; name?: string; title?: string }) {
  const [src, setSrc] = createSignal(props.code.trim());
  const [filter, setFilter] = createSignal<Set<TraceEvent['kind']>>(new Set(['infer', 'defeq', 'unfold', 'iota', 'beta']));
  const [maxDepth, setMaxDepth] = createSignal(40);
  const res = createMemo(() => {
    const r = check(src(), envFor('cic'));
    const names = r.results.flatMap((x) => (x.output?.k === 'decl' ? [x.output.main] : []));
    const name = props.name && r.env.has(props.name) ? props.name : names[names.length - 1];
    const d = name ? (r.env.get(name) as Decl) : undefined;
    if (!d || (d.kind !== 'def' && d.kind !== 'theorem')) return { env: r.env, events: [] as TraceEvent[], name, error: r.messages.find((m) => m.severity === 'error') ? 'the code has errors' : 'no definition to trace' };
    // re-check the declaration in the environment *before* it was added
    const env = r.env.clone();
    const tc = new TypeChecker(env, undefined, { trace: true, maxTrace: 3000 });
    try {
      tc.check(d.value, d.type);
    } catch {
      /* ignore */
    }
    return { env: r.env, events: tc.traceEvents, name, error: undefined };
  });
  const shown = () => res().events.filter((e) => filter().has(e.kind) && e.depth <= maxDepth());
  const counts = () => {
    const c: Record<string, number> = {};
    for (const e of res().events) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  };
  const toggle = (k: TraceEvent['kind']) => {
    const s = new Set(filter());
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setFilter(s);
  };
  return (
    <div class="widget wide ktrace">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Watching the kernel'}</span>
        <Show when={res().name}>
          <span class="badge">checking {res().name}</span>
        </Show>
        <span class="grow" />
        <For each={(Object.keys(kindLabel) as TraceEvent['kind'][]).filter((k) => k !== 'whnf')}>
          {(k) => (
            <button class={`btn small ${filter().has(k) ? 'active' : ''}`} onClick={() => toggle(k)}>
              {kindLabel[k]} {counts()[k] ?? 0}
            </button>
          )}
        </For>
      </div>
      <div style={{ 'border-bottom': '1px solid var(--rule)' }}>
        <Editor value={src()} onChange={setSrc} minHeight="3rem" maxHeight="10rem" lineNumbers={false} />
      </div>
      <div class="kt-list">
        <Show when={!res().error} fallback={<div class="muted sans" style={{ padding: '0.8rem' }}>{res().error}</div>}>
          <For each={shown().slice(0, 800)}>
            {(e) => (
              <div class="kt-ev" style={{ 'padding-left': `${Math.min(e.depth, 30) * 0.9 + 0.5}rem` }}>
                <span class={`badge kt-${e.kind}`}>{kindLabel[e.kind]}</span>{' '}
                <Term env={res().env} expr={e.e} lctx={e.lctx} opts={{ maxDepth: 12 }} hoverTypes={false} />
                <Show when={e.kind === 'defeq'}>
                  <span class="kt-op"> ≟ </span>
                  <Term env={res().env} expr={e.e2!} lctx={e.lctx} opts={{ maxDepth: 12 }} hoverTypes={false} />
                  <span class={`kt-res ${e.result ? 'ok' : 'no'}`}>{e.result ? ' ✓' : ' ✗'}</span>
                </Show>
                <Show when={e.kind === 'infer' && e.result && typeof e.result !== 'boolean'}>
                  <span class="kt-op"> : </span>
                  <Term env={res().env} expr={e.result as import('@kernel/core/expr.ts').Expr} lctx={e.lctx} opts={{ maxDepth: 12 }} hoverTypes={false} />
                </Show>
              </div>
            )}
          </For>
          <Show when={shown().length > 800}>
            <div class="muted sans" style={{ padding: '0.5rem' }}>… {shown().length - 800} more events</div>
          </Show>
        </Show>
      </div>
      <div class="widget-foot row">
        <span>max depth</span>
        <input type="range" min={1} max={40} value={maxDepth()} onInput={(e) => setMaxDepth(+e.currentTarget.value)} />
        <span class="muted">{shown().length} of {res().events.length} events</span>
      </div>
    </div>
  );
}
