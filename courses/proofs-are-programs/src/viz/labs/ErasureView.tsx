// The erasure view: each definition of the snippet next to what runs, with its types
// and proofs removed.

import { For, Show, createSignal } from 'solid-js';
import { Playground } from '../Playground.tsx';
import type { CheckResult } from '../../app/kernel.ts';
import { computesType, eraseEquation, eraseToString } from '@kernel/eval/erase.ts';
import type { Expr } from '@kernel/core/expr.ts';

export function ErasureView(props: { code: string; setup?: string; title?: string; lens?: boolean }) {
  const [rows, setRows] = createSignal<{ name: string; text: string; eqns?: string[] }[]>([]);
  const onResult = (r: CheckResult) => {
    const out: { name: string; text: string; eqns?: string[] }[] = [];
    for (const c of r.results) {
      if (c.output?.k !== 'decl') continue;
      const d = r.env.get(c.output.main);
      if (!d) continue;
      if (d.kind === 'theorem') out.push({ name: d.name, text: '(a proof: erased entirely)' });
      else if (d.kind === 'def') {
        try {
          if (computesType(r.env, d.type)) {
            out.push({ name: d.name, text: '(computes a type: erased entirely)' });
            continue;
          }
          // a definition by pattern matching reads best as its erased equations
          const eqNames = r.env.equations.get(d.name) ?? [];
          const eqns = eqNames.map((n) => {
            const e = r.env.get(n);
            return e ? eraseEquation(r.env, e.type) : undefined;
          });
          if (eqns.length > 0 && eqns.every((x) => x && x !== '?')) out.push({ name: d.name, text: '', eqns: eqns as string[] });
          else out.push({ name: d.name, text: eraseToString(r.env, (d as { value: Expr }).value) });
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
              <Show
                when={r.eqns}
                fallback={
                  <div class="erase-row mono">
                    <b>{r.name}</b> := <span>{r.text}</span>
                  </div>
                }
              >
                <div class="erase-row mono">
                  <b>{r.name}</b>
                  <For each={r.eqns}>{(q) => <div class="erase-eqn">{q}</div>}</For>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
