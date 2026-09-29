// The tactic ↔ term lens: the proof term a tactic block has written so far.
//
// Each tactic assigns some goals (holes) with terms that may contain new holes.
// The lens shows the whole term after a step, with what that step wrote
// highlighted and the holes still to fill marked.

import { Show, createMemo, createSignal, createEffect } from 'solid-js';
import type { Environment } from '@kernel/core/env.ts';
import { Term } from './Term.tsx';
import { filledPaths, holePaths, type StepAtCursor } from './tactic-state.ts';

export function LensView(props: { env: Environment; at: StepAtCursor; src: string; onSelect?: (from: number, to: number) => void }) {
  // the step shown: follows the cursor, but the slider can move it
  const [idx, setIdx] = createSignal(props.at.index);
  createEffect(() => setIdx(props.at.index));
  const leaves = () => props.at.leaves;
  const step = createMemo(() => (idx() < 0 ? undefined : leaves()[Math.min(idx(), leaves().length - 1)]));
  const prevTerm = () => {
    const i = idx();
    if (i <= 0) return undefined;
    return leaves()[i - 1].term;
  };
  const term = () => step()?.term;
  const names = createMemo(() => {
    const m = new Map<number, string>();
    const s = step();
    for (const g of s?.after ?? []) m.set(g.id, g.tag ? `?${g.tag}` : '?_');
    return m;
  });
  const highlights = createMemo(() => {
    const t = term();
    if (!t) return [];
    const filled = filledPaths(prevTerm(), t).map((path) => ({ path, cls: 'filled' }));
    const holes = holePaths(t).map((h) => ({ path: h.path, cls: 'hole' }));
    return [...filled, ...holes];
  });
  const tacticText = () => {
    const s = step();
    return s ? props.src.slice(s.span.from, s.span.to).split('\n')[0] : '';
  };
  return (
    <div class="lens">
      <div class="lens-head">
        <span class="label">The proof term so far</span>
        <span class="grow" />
        <Show when={leaves().length > 1}>
          <input
            class="lens-slider"
            type="range"
            min={0}
            max={leaves().length - 1}
            value={Math.max(0, idx())}
            onInput={(e) => {
              const i = Number(e.currentTarget.value);
              setIdx(i);
              const s = leaves()[i];
              props.onSelect?.(s.span.from, s.span.from);
            }}
            aria-label="step through the tactics"
          />
          <span class="muted lens-step">
            step {Math.max(0, idx()) + 1}/{leaves().length}
          </span>
        </Show>
      </div>
      <Show when={step()} fallback={<div class="muted">Move the cursor into a tactic block.</div>}>
        <div class="lens-tactic">
          after <code>{tacticText()}</code>
          <Show when={step()!.after.length > 0} fallback={<span class="badge ok">complete</span>}>
            <span class="badge">{step()!.after.length} hole{step()!.after.length > 1 ? 's' : ''} left</span>
          </Show>
        </div>
        <div class="lens-term">
          <Term env={props.env} expr={term()!} lctx={step()!.lctx} opts={{ hideMVarArgs: true, mvarName: (id) => names().get(id) ?? '?_', maxDepth: 60 }} highlights={highlights()} block />
        </div>
        <div class="lens-legend">
          <span class="lg-filled">written by this step</span>
          <span class="lg-hole">holes still to fill (the goals)</span>
        </div>
      </Show>
    </div>
  );
}
