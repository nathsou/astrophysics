// Why does a recursive definition terminate? For each recursive definition in the
// snippet: the argument that gets smaller (structural recursion), or the measure and
// the proof obligation at each recursive call (well-founded recursion).

import { For, Show, createSignal } from 'solid-js';
import type { Termination } from '@kernel/frontend.ts';
import { Playground } from '../Playground.tsx';
import { Term } from '../Term.tsx';
import type { CheckResult } from '../../app/kernel.ts';

export function TerminationView(props: { code: string; setup?: string; title?: string; errors?: boolean }) {
  const [res, setRes] = createSignal<CheckResult>();
  const decls = () =>
    (res()?.results ?? []).flatMap((r) => (r.output?.k === 'decl' && r.output.termination ? [{ name: r.output.main, t: r.output.termination as Termination }] : []));
  return (
    <div class="termination-view">
      <Playground code={props.code} setup={props.setup} title={props.title ?? 'Why it terminates'} onResult={setRes} />
      <div class="term-panel">
        <div class="label">termination</div>
        <Show when={decls().length} fallback={<div class="muted small">No recursive definition was accepted in this snippet.</div>}>
          <For each={decls()}>
            {(d) => (
              <div class="term-decl">
                <div>
                  <b class="mono">{d.name}</b>{' '}
                  <Show
                    when={d.t.kind === 'wf'}
                    fallback={
                      <span>
                        — structural recursion: every recursive call is on a part of the argument <code class="mono">{(d.t as { arg: string }).arg}</code>.
                      </span>
                    }
                  >
                    <span>
                      — well-founded recursion on the measure{' '}
                      <code class="mono">
                        <Term env={res()!.env} expr={(d.t as Extract<Termination, { kind: 'wf' }>).measure} lctx={(d.t as Extract<Termination, { kind: 'wf' }>).lctx} />
                      </code>
                      , which must decrease at every call:
                    </span>
                  </Show>
                </div>
                <Show when={d.t.kind === 'wf'}>
                  <ul class="term-obligations">
                    <For each={(d.t as Extract<Termination, { kind: 'wf' }>).obligations}>
                      {(o) => (
                        <li>
                          <span class="badge ok">✓</span> the call <code class="mono"><Term env={res()!.env} expr={o.call} lctx={o.lctx} /></code> needs{' '}
                          <code class="mono"><Term env={res()!.env} expr={o.goal} lctx={o.lctx} /></code>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
