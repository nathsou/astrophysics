// Exercises checked automatically — by the kernel (Lean-style) or by the λ-evaluator.

import { Show, createMemo, createSignal, type JSX } from 'solid-js';
import { Playground } from './Playground.tsx';
import { Editor } from './Editor.tsx';
import * as L from '@kernel/untyped/lambda.ts';
import { isExerciseDone, markExercise } from '../app/progress.ts';
import { CodeBlock } from './CodeBlock.tsx';
import type { CalculusId } from '@kernel/core/calculus.ts';

export interface ExerciseProps {
  id: string;
  title?: string;
  kind?: 'lean' | 'lambda';
  code: string;
  calculus?: CalculusId | string;
  prelude?: string;
  /** declarations that must exist (without sorry) */
  must?: string;
  /** λ exercises: the expected normal form (with the standard library) */
  expect?: string;
  hint?: string;
  solution?: string;
  children?: JSX.Element;
}

export function Exercise(props: ExerciseProps) {
  const [solved, setSolved] = createSignal(isExerciseDone(props.id));
  const [showHint, setShowHint] = createSignal(false);
  const [showSol, setShowSol] = createSignal(false);
  const kind = () => props.kind ?? 'lean';
  const succeed = (ok: boolean) => {
    if (ok && !solved()) {
      setSolved(true);
      markExercise(props.id);
    }
  };

  // λ exercises
  const [lsrc, setLsrc] = createSignal(props.code.trim());
  const lambdaResult = createMemo(() => {
    if (kind() !== 'lambda') return undefined;
    try {
      const prog = L.parseProgram(L.STDLIB + '\n' + lsrc());
      if (!prog.main) return { msg: 'write the term to evaluate on the last line', ok: false };
      const r = L.normalize(prog.main, 'normal', prog.defs, 3000, 6000);
      if (!r.normal) return { msg: 'no normal form found within the step limit', ok: false };
      const exp = props.expect ? L.parseProgram(L.STDLIB + '\n' + props.expect) : undefined;
      const target = exp?.main ? L.normalize(exp.main, 'normal', exp.defs, 3000).final : undefined;
      const ok = !!target && L.alphaEq(r.final, target);
      succeed(ok);
      return { msg: `normal form: ${L.print(r.final, { recognise: true })}${L.describeValue(r.final, prog.defs) ? ` (${L.describeValue(r.final, prog.defs)})` : ''} after ${r.steps.length} steps`, ok };
    } catch (e) {
      return { msg: (e as Error).message, ok: false };
    }
  });

  const onLeanResult = (r: import('../app/kernel.ts').CheckResult) => {
    const errors = r.messages.some((m) => m.severity === 'error');
    const sorry = r.messages.some((m) => m.severity === 'warning' && m.msg.some((p) => typeof p === 'string' && p.includes('sorry')));
    const must = (props.must ?? '').split(/[\s,]+/).filter(Boolean);
    const allThere = must.every((n) => r.env.has(n));
    succeed(!errors && !sorry && allThere);
  };

  return (
    <div class={`callout exercise ${solved() ? 'done' : ''}`}>
      <div class="callout-title" style={{ color: solved() ? 'var(--ok)' : 'var(--c-ctor)' }}>
        Exercise
        <Show when={props.title}>
          <em>{props.title}</em>
        </Show>
        <span class="grow" />
        <Show when={solved()}>
          <span class="badge ok">✓ solved</span>
        </Show>
      </div>
      <div class="ex-prompt">{props.children}</div>
      <Show
        when={kind() === 'lambda'}
        fallback={<Playground code={props.code} calculus={props.calculus} prelude={props.prelude} title="Your solution" onResult={onLeanResult} derivations={true} wrap={true} />}
      >
        <div class="widget" style={{ margin: '0.8rem 0' }}>
          <Editor value={lsrc()} onChange={setLsrc} lang="lambda" minHeight="3rem" lineNumbers={false} />
          <div class={`widget-foot ${lambdaResult()?.ok ? '' : ''}`}>
            <Show when={lambdaResult()?.ok} fallback={<span>{lambdaResult()?.msg}</span>}>
              <span class="badge ok">✓ correct</span> {lambdaResult()?.msg}
            </Show>
          </div>
        </div>
      </Show>
      <div class="row" style={{ 'margin-top': '0.5rem' }}>
        <Show when={props.hint}>
          <button class="btn small" onClick={() => setShowHint(!showHint())}>
            {showHint() ? 'hide hint' : 'hint'}
          </button>
        </Show>
        <Show when={props.solution}>
          <button class="btn small" onClick={() => setShowSol(!showSol())}>
            {showSol() ? 'hide solution' : 'show a solution'}
          </button>
        </Show>
      </div>
      <Show when={showHint()}>
        <p class="ex-hint">{props.hint}</p>
      </Show>
      <Show when={showSol()}>
        <CodeBlock code={props.solution!} lang={kind() === 'lambda' ? 'lambda' : 'lean'} />
      </Show>
    </div>
  );
}
