// The erasure view: each definition of the snippet next to what runs, with its types
// and proofs removed.

import { For, Show, createSignal } from 'solid-js';
import { Playground } from '../Playground.tsx';
import type { CheckResult } from '../../app/kernel.ts';
import { eraseToString } from '@kernel/eval/erase.ts';
import type { Expr } from '@kernel/core/expr.ts';

export function ErasureView(props: { code: string; setup?: string; title?: string; lens?: boolean }) {
  const [rows, setRows] = createSignal<{ name: string; text: string }[]>([]);
  const onResult = (r: CheckResult) => {
    const out: { name: string; text: string }[] = [];
    for (const c of r.results) {
      if (c.output?.k !== 'decl') continue;
      const d = r.env.get(c.output.main);
      if (!d) continue;
      if (d.kind === 'theorem') out.push({ name: d.name, text: '(a proof: erased entirely)' });
      else if (d.kind === 'def') {
        try {
          out.push({ name: d.name, text: eraseToString(r.env, (d as { value: Expr }).value) });
        } catch {
          out.push({ name: d.name, text: '(could not erase)' });
        }
      }
    }
    setRows(out);
  };
  return (
    <div class="erasure-view">
      <Playground code={props.code} setup={props.setup} title={props.title ?? 'What runs'} lens={props.lens} onResult={onResult} />
      <div class="term-panel">
        <div class="label">after erasure (what runs)</div>
        <Show when={rows().length} fallback={<div class="muted small">No definitions.</div>}>
          <For each={rows()}>
            {(r) => (
              <div class="erase-row mono">
                <b>{r.name}</b> := <span>{r.text}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
