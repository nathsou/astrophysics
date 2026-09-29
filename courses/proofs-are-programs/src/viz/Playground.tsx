// A live editor connected to the course kernel, with Lean-style goal display
// and the tactic ↔ term lens.

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { Editor } from './Editor.tsx';
import { GoalView, ResultView, type PanelKind } from './Infoview.tsx';
import { check, baseEnv, type CheckResult } from '../app/kernel.ts';
import { formatMsg } from '@kernel/format.ts';
import { Printer } from '@kernel/core/pretty.ts';
import { TypeChecker } from '@kernel/core/typechecker.ts';
import { renderPNode } from './Term.tsx';
import type { InfoItem } from '@kernel/elab/elaborator.ts';
import type { Environment } from '@kernel/core/env.ts';
import { stepAt, type StepAtCursor } from './tactic-state.ts';
import { LensView } from './Lens.tsx';
import { cicPlaygroundHref } from '../content/bridges.ts';

export interface PlaygroundProps {
  code: string;
  title?: string;
  height?: string;
  /** show the proof-term lens (open by default when true) */
  lens?: boolean | string;
  /** called after each check */
  onResult?: (r: CheckResult) => void;
  /** extra element in the footer */
  extra?: JSX.Element;
  class?: string;
  lineNumbers?: boolean;
  /** hide the "open in the CIC course" link */
  noBridge?: boolean;
  /** source prepended (hidden) before the code, e.g. definitions from earlier in the chapter */
  setup?: string;
}

export function hoverInfo(env: Environment, infos: InfoItem[], pos: number, offset = 0): { from: number; to: number; dom: HTMLElement } | undefined {
  let best: InfoItem | undefined;
  const p = pos + offset;
  for (const i of infos) {
    if (i.span.from <= p && p <= i.span.to) {
      if (!best || i.span.to - i.span.from < best.span.to - best.span.from) best = i;
    }
  }
  if (!best) return undefined;
  const dom = document.createElement('div');
  const term = document.createElement('div');
  term.className = 'term';
  const printer = new Printer(env, { maxDepth: 30, hideMVarArgs: true });
  try {
    const tc = new TypeChecker(env, best.lctx, { fuel: 5000 });
    const ty = tc.inferOnly(best.expr);
    term.append(renderPNode(printer.print(best.expr, best.lctx), new Map(), new Map()), document.createTextNode(' : '), renderPNode(printer.print(ty, best.lctx), new Map(), new Map()));
  } catch {
    term.append(renderPNode(printer.print(best.expr, best.lctx), new Map(), new Map()));
  }
  dom.appendChild(term);
  const h = best.expr.k === 'const' ? env.get(best.expr.name) : undefined;
  if (h?.doc) {
    const doc = document.createElement('div');
    doc.style.marginTop = '0.35rem';
    doc.style.color = 'var(--ink-2)';
    doc.textContent = h.doc;
    dom.appendChild(doc);
  }
  return { from: best.span.from - offset, to: best.span.to - offset, dom };
}

const bool = (v: boolean | string | undefined, d: boolean) => (v === undefined ? d : v === true || v === 'true' || v === '');

export function Playground(props: PlaygroundProps) {
  const initial = () => props.code.replace(/^\n/, '').replace(/\n$/, '');
  const [code, setCode] = createSignal(initial());
  const [debounced, setDebounced] = createSignal(code());
  const [cursor, setCursor] = createSignal<number | undefined>();
  const [showLens, setShowLens] = createSignal(bool(props.lens, false));
  let timer: number | undefined;
  let view: EditorView | undefined;
  const onChange = (v: string) => {
    setCode(v);
    clearTimeout(timer);
    timer = window.setTimeout(() => setDebounced(v), 250);
  };
  onCleanup(() => clearTimeout(timer));
  const setup = () => (props.setup ? props.setup.replace(/\n?$/, '\n') : '');
  const offset = () => setup().length;
  const result = createMemo(() => {
    const r = check(setup() + debounced(), baseEnv());
    props.onResult?.(r);
    return r;
  });
  const inCode = (m: { span: { from: number; to: number } }) => m.span.to >= offset();
  const diagnostics = createMemo<Diagnostic[]>(() =>
    result()
      .messages.filter(inCode)
      .map((m) => ({
        from: Math.max(0, m.span.from - offset()),
        to: Math.max(m.span.to, m.span.from + 1) - offset(),
        severity: m.severity,
        message: formatMsg(result().env, m.msg),
      })),
  );
  const errors = () => result().messages.filter((m) => m.severity === 'error' && inCode(m)).length;
  const shown = () => result().results.filter((r) => r.span.from >= offset() && (r.output || r.messages.length > 0));
  // the tactic step under the cursor (or the last step, before the user has clicked)
  const at = createMemo<StepAtCursor | undefined>(() => {
    const steps = result().tactics.filter((s) => s.span.from >= offset());
    if (steps.length === 0) return undefined;
    const c = cursor();
    if (c === undefined) {
      // default: the end of the first tactic block
      const firstBlock = steps[0].blockSpan;
      return stepAt(steps, firstBlock.to);
    }
    return stepAt(steps, c + offset());
  });
  const select = (from: number, to: number) => {
    if (!view) return;
    view.dispatch({ selection: { anchor: Math.max(0, from - offset()), head: Math.max(0, to - offset()) }, scrollIntoView: true });
    view.focus();
  };
  const [panel, setPanel] = createSignal<{ kind: PanelKind; idx: number; node: () => JSX.Element } | undefined>();
  const tacticGoals = () => {
    const a = at();
    if (!a) return undefined;
    return a.index < 0 ? a.step.before : a.step.after;
  };

  return (
    <div class={`widget playground wide ${props.class ?? ''}`}>
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Playground'}</span>
        <span class="grow" />
        <Show when={errors() > 0} fallback={<span class="badge ok">✓ checked</span>}>
          <span class="badge err">
            {errors()} error{errors() > 1 ? 's' : ''}
          </span>
        </Show>
        <span class="muted" style={{ 'font-size': '0.7rem' }}>
          {result().time.toFixed(0)} ms
        </span>
        <Show when={result().tactics.length > 0}>
          <button class={`btn small ${showLens() ? 'active' : ''}`} title="show the proof term the tactics are writing" onClick={() => setShowLens(!showLens())}>
            proof term
          </button>
        </Show>
        <Show when={!props.noBridge}>
          <a class="btn small ghost" href={cicPlaygroundHref(setup() + code())} title="open this code in the playground of the CIC course (same language, same kernel)" target="_blank" rel="noopener">
            ⇄ CIC
          </a>
        </Show>
        <button class="btn small ghost" title="reset to the original code" onClick={() => onChange(initial())}>
          ↺
        </button>
      </div>
      <div class="pg-body">
        <div class="pg-editor">
          <Editor
            value={code()}
            onChange={onChange}
            onCursor={setCursor}
            diagnostics={diagnostics()}
            hover={(pos) => hoverInfo(result().env, result().infos, pos, offset())}
            minHeight={props.height ?? '6rem'}
            lineNumbers={props.lineNumbers}
            ref={(v) => (view = v)}
          />
        </div>
        <div class="pg-info">
          <Show when={tacticGoals()}>
            <div class="tactic-state">
              <div class="ts-head">
                <span class="label">Tactic state</span>
                <Show when={at()}>
                  <span class="muted ts-where">{at()!.index < 0 ? 'before the first tactic' : `after step ${at()!.index + 1} of ${at()!.count}`}</span>
                </Show>
              </div>
              <Show when={tacticGoals()!.length > 0} fallback={<div class="ts-done">No goals — the proof is complete. 🎉</div>}>
                <div class="muted ts-count">
                  {tacticGoals()!.length} goal{tacticGoals()!.length > 1 ? 's' : ''}
                </div>
                <For each={tacticGoals()}>{(g) => <GoalView env={result().env} goal={{ name: g.tag, lctx: g.lctx, type: g.type, span: at()!.step.span }} />}</For>
              </Show>
            </div>
          </Show>
          <Show when={shown().length > 0 || !tacticGoals()} fallback={null}>
            <Show when={shown().length > 0} fallback={<div class="pg-empty">Write a command such as <code>#check</code>, <code>#eval</code> or <code>theorem</code>.</div>}>
              <For each={shown()}>
                {(r, i) => (
                  <ResultView
                    env={result().env}
                    r={{ ...r, span: { from: r.span.from - offset(), to: r.span.to - offset() }, messages: r.messages.map((m) => ({ ...m, span: { from: m.span.from - offset(), to: m.span.to - offset() } })) }}
                    src={debounced()}
                    onSelect={(f, t) => select(f + offset(), t + offset())}
                    allowDerivation={true}
                    allowSteps={true}
                    activePanel={panel()?.idx === i() ? panel()!.kind : 'none'}
                    onPanel={(kind, node) => setPanel(kind === 'none' ? undefined : { kind, idx: i(), node })}
                  />
                )}
              </For>
            </Show>
          </Show>
        </div>
      </div>
      <Show when={showLens() && at()}>
        <LensView env={result().env} at={at()!} src={setup() + debounced()} onSelect={select} />
      </Show>
      <Show when={panel()}>
        <div class="pg-panel">
          <button class="btn small ghost pg-panel-close" onClick={() => setPanel(undefined)} title="close">
            ✕
          </button>
          {panel()!.node()}
        </div>
      </Show>
      <Show when={props.extra}>
        <div class="widget-foot">{props.extra}</div>
      </Show>
    </div>
  );
}
