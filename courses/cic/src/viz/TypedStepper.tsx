// Step-by-step reduction of core terms (β, δ, ζ, ι).

import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Expr } from '../kernel/core/expr.ts';
import { LocalContext, type Environment } from '../kernel/core/env.ts';
import { Stepper, stepKindInfo, type TStep } from '../kernel/core/steps.ts';
import { Term } from './Term.tsx';

export interface TypedStepperProps {
  env: Environment;
  expr: Expr;
  lctx?: LocalContext;
  maxSteps?: number;
  title?: string;
  /** unfold definitions (δ); off shows only β/ι */
  delta?: boolean;
}

export function TypedStepper(props: TypedStepperProps) {
  const trace = createMemo(() => {
    const st = new Stepper(props.env, { delta: props.delta ?? true });
    try {
      return st.trace(props.expr, props.maxSteps ?? 300);
    } catch (e) {
      return { steps: [] as TStep[], final: props.expr, normal: false, error: (e as Error).message };
    }
  });
  const [i, setI] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  let timer: number | undefined;
  const n = () => trace().steps.length;
  const current = () => (i() === 0 ? props.expr : trace().steps[i() - 1].after);
  const nextStep = () => trace().steps[i()] as TStep | undefined;
  const lastStep = () => (i() > 0 ? trace().steps[i() - 1] : undefined);
  const highlights = () => {
    const ns = nextStep();
    return ns ? [{ path: ns.path, cls: 'redex' }] : [];
  };
  const play = () => {
    if (playing()) {
      setPlaying(false);
      clearInterval(timer);
      return;
    }
    setPlaying(true);
    timer = window.setInterval(() => {
      if (i() >= n()) {
        setPlaying(false);
        clearInterval(timer);
        return;
      }
      setI(i() + 1);
    }, 700);
  };
  onCleanup(() => clearInterval(timer));
  const counts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const s of trace().steps.slice(0, i())) c[s.kind] = (c[s.kind] ?? 0) + 1;
    return c;
  });

  return (
    <div class="widget stepper">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Reduction'}</span>
        <span class="badge">
          step {i()} / {n()}
          {trace().normal ? '' : '+'}
        </span>
        <For each={Object.entries(counts())}>{([k, v]) => <span class={`badge ${k}`}>{stepKindInfo[k as TStep['kind']].symbol} × {v}</span>}</For>
        <span class="grow" />
        <div class="seg">
          <button onClick={() => setI(0)} disabled={i() === 0} title="restart">
            ⏮
          </button>
          <button onClick={() => setI(Math.max(0, i() - 1))} disabled={i() === 0} title="previous step">
            ◀
          </button>
          <button onClick={play} title="play">
            {playing() ? '❚❚' : '▶'}
          </button>
          <button onClick={() => setI(Math.min(n(), i() + 1))} disabled={i() >= n()} title="next step">
            ▶|
          </button>
          <button onClick={() => setI(n())} disabled={i() >= n()} title="to the end">
            ⏭
          </button>
        </div>
      </div>
      <div class="widget-body">
        <div class="stepper-term">
          <Term env={props.env} expr={current()} lctx={props.lctx ?? LocalContext.empty} highlights={highlights()} block />
        </div>
        <div class="stepper-status sans">
          <Show
            when={nextStep()}
            fallback={
              <span>
                {trace().normal ? (
                  <>
                    <span class="badge ok">normal form</span> no redex left.
                  </>
                ) : (
                  <span class="badge warn">stopped after {n()} steps</span>
                )}
              </span>
            }
          >
            <span class={`badge ${nextStep()!.kind}`}>{stepKindInfo[nextStep()!.kind].name}</span>{' '}
            <span class="muted">
              next: {stepKindInfo[nextStep()!.kind].blurb}
              {nextStep()!.name ? ` (${nextStep()!.name})` : ''}
            </span>
          </Show>
          <Show when={lastStep()}>
            <div class="muted" style={{ 'margin-top': '0.2rem', 'font-size': '0.75rem' }}>
              last step: {stepKindInfo[lastStep()!.kind].name}
              {lastStep()!.name ? ` of ${lastStep()!.name}` : ''}
            </div>
          </Show>
        </div>
        <input type="range" min={0} max={n()} value={i()} onInput={(e) => setI(+e.currentTarget.value)} class="stepper-slider" />
      </div>
    </div>
  );
}
