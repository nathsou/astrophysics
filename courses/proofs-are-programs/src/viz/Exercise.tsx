import { check } from '../app/kernel.ts';
import { checkExercise } from '@kernel/exercise.ts';
// Exercises checked by the kernel: the solution must check without errors and without sorry,
// and the declarations named in `must` must exist.

import { Show, createMemo, createSignal, type JSX } from 'solid-js';
import { Playground } from './Playground.tsx';
import { isExerciseDone, markExercise } from '../app/progress.ts';
import { CodeBlock } from './CodeBlock.tsx';
import type { CheckResult } from '../app/kernel.ts';

export interface ExerciseProps {
  id: string;
  title?: string;
  code: string;
  /** hidden definitions the exercise builds on */
  setup?: string;
  /** declarations that must exist (without sorry) */
  must?: string;
  hint?: string;
  solution?: string;
  lens?: boolean | string;
  children?: JSX.Element;
}

export function Exercise(props: ExerciseProps) {
  const [solved, setSolved] = createSignal(isExerciseDone(props.id));
  const [current, setCurrent] = createSignal(false);
  const [feedback, setFeedback] = createSignal('');
  const [showHint, setShowHint] = createSignal(false);
  const [showSol, setShowSol] = createSignal(false);
  const reference = createMemo(() => check((props.setup ?? '') + '\n' + (props.solution ?? props.code)));
  const onResult = (r: CheckResult) => {
    const issue = checkExercise(r, reference(), props.must);
    const ok = issue === null;
    setCurrent(ok);
    setFeedback(issue ?? 'The required declarations and types check.');
    if (ok && !solved()) {
      setSolved(true);
      markExercise(props.id);
    }
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
          <span class="badge ok">{current() ? '✓ Kernel checked' : 'Previously completed'}</span>
        </Show>
      </div>
      <div class="ex-prompt">{props.children}</div>
      <Playground draftKey={`proofs-are-programs:exercise:${props.id}`} onEdit={() => { setCurrent(false); setFeedback("Edited — checking…"); }} code={props.code} setup={props.setup} title="Your solution" onResult={onResult} lens={props.lens} />
      <Show when={feedback()}><p role="status">{feedback()}</p></Show>
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
        <CodeBlock code={props.solution!} lang="lean" />
      </Show>
    </div>
  );
}
