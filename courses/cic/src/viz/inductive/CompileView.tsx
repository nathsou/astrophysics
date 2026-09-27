// Definitions by pattern matching, next to the eliminator terms they compile to.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../../app/kernel.ts';
import { Editor } from '../Editor.tsx';
import { Term } from '../Term.tsx';
import { MessageView } from '../Infoview.tsx';
import type { Decl } from '../../kernel/core/env.ts';
import { forEachExpr } from '../../kernel/core/expr.ts';

export function CompileView(props: { code: string; title?: string }) {
  const [src, setSrc] = createSignal(props.code.trim());
  const res = createMemo(() => check(src(), envFor('cic')));
  const defs = () =>
    res()
      .results.map((r) => (r.output?.k === 'decl' ? res().env.get(r.output.main) : undefined))
      .filter((d): d is Extract<Decl, { kind: 'def' | 'theorem' }> => !!d && (d.kind === 'def' || d.kind === 'theorem'));
  const eliminators = (d: Extract<Decl, { kind: 'def' | 'theorem' }>) => {
    const s = new Set<string>();
    forEachExpr(d.value, (x) => {
      if (x.k === 'const' && (x.name.endsWith('.rec') || x.name.endsWith('.casesOn'))) s.add(x.name);
    });
    return [...s];
  };
  return (
    <div class="widget wide compileview">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'What the equation compiler produces'}</span>
      </div>
      <div class="cv-grid">
        <div class="cv-src">
          <Editor value={src()} onChange={setSrc} minHeight="8rem" maxHeight="26rem" />
        </div>
        <div class="cv-out">
          <For each={res().messages.filter((m) => m.severity === 'error')}>{(m) => <MessageView env={res().env} m={m} />}</For>
          <For each={defs()}>
            {(d) => (
              <div class="cv-def">
                <div class="cv-head sans">
                  <b class="mono">{d.name}</b>
                  <Show when={d.kind === 'def' && d.compiled}>
                    <Show when={(d as Extract<Decl, { kind: 'def' }>).compiled!.recursive} fallback={<span class="badge">case tree</span>}>
                      <span class="badge iota">structural recursion on {(d as Extract<Decl, { kind: 'def' }>).compiled!.argName ?? `argument ${((d as Extract<Decl, { kind: 'def' }>).compiled!.decreasing ?? 0) + 1}`}</span>
                    </Show>
                  </Show>
                  <For each={eliminators(d)}>{(e) => <span class="badge">{e}</span>}</For>
                </div>
                <Term env={res().env} expr={d.value} block />
              </div>
            )}
          </For>
        </div>
      </div>
      <div class="widget-foot">The right-hand side is the term the kernel actually checks. Recursive calls have become induction hypotheses of a recursor; pattern matches have become applications of <code>casesOn</code>.</div>
    </div>
  );
}
