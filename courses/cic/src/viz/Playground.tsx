// A live editor connected to the course kernel.

import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { Editor } from './Editor.tsx';
import { ResultView, type PanelKind } from './Infoview.tsx';
import type { JSX } from 'solid-js';
import { envFor, check, type PreludeId } from '../app/kernel.ts';
import { calculi, type CalculusId } from '@kernel/core/calculus.ts';
import { formatMsg } from '@kernel/format.ts';
import { Printer } from '@kernel/core/pretty.ts';
import { TypeChecker } from '@kernel/core/typechecker.ts';
import { renderPNode } from './Term.tsx';
import type { InfoItem } from '@kernel/elab/elaborator.ts';
import type { Environment } from '@kernel/core/env.ts';

export interface PlaygroundProps {
  code: string;
  calculus?: CalculusId | string;
  prelude?: PreludeId | string;
  title?: string;
  height?: string;
  /** allow switching calculi */
  selectable?: boolean | string;
  derivations?: boolean | string;
  steps?: boolean | string;
  /** called after each check */
  onResult?: (r: ReturnType<typeof check>) => void;
  /** extra element in the header */
  extra?: import('solid-js').JSX.Element;
  class?: string;
  lineNumbers?: boolean;
  /** soft-wrap long lines in the editor */
  wrap?: boolean;
}

export function hoverInfo(env: Environment, infos: InfoItem[], pos: number): { from: number; to: number; dom: HTMLElement } | undefined {
  let best: InfoItem | undefined;
  for (const i of infos) {
    if (i.span.from <= pos && pos <= i.span.to) {
      if (!best || i.span.to - i.span.from < best.span.to - best.span.from) best = i;
    }
  }
  if (!best) return undefined;
  const dom = document.createElement('div');
  const term = document.createElement('div');
  term.className = 'term';
  const printer = new Printer(env, { maxDepth: 30 });
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
  return { from: best.span.from, to: best.span.to, dom };
}

export function Playground(props: PlaygroundProps) {
  const [calc, setCalc] = createSignal<CalculusId>((props.calculus as CalculusId) ?? 'cic');
  const [code, setCode] = createSignal(props.code.replace(/^\n/, '').replace(/\n$/, ''));
  const [debounced, setDebounced] = createSignal(code());
  let timer: number | undefined;
  let view: EditorView | undefined;
  const onChange = (v: string) => {
    setCode(v);
    clearTimeout(timer);
    timer = window.setTimeout(() => setDebounced(v), 250);
  };
  onCleanup(() => clearTimeout(timer));
  const base = createMemo(() => envFor(calc(), (props.prelude as PreludeId) ?? undefined));
  const result = createMemo(() => {
    const r = check(debounced(), base());
    props.onResult?.(r);
    return r;
  });
  const diagnostics = createMemo<Diagnostic[]>(() =>
    result().messages.map((m) => ({
      from: m.span.from,
      to: Math.max(m.span.to, m.span.from + 1),
      severity: m.severity,
      message: formatMsg(result().env, m.msg),
    })),
  );
  const errors = () => result().messages.filter((m) => m.severity === 'error').length;
  const shown = () => result().results.filter((r) => r.output || r.messages.length > 0);
  const select = (from: number, to: number) => {
    if (!view) return;
    view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
    view.focus();
  };
  const [panel, setPanel] = createSignal<{ kind: PanelKind; idx: number; node: () => JSX.Element } | undefined>();
  const bool = (v: boolean | string | undefined, d: boolean) => (v === undefined ? d : v === true || v === 'true');

  return (
    <div class={`widget playground wide ${props.class ?? ''}`}>
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Playground'}</span>
        <Show
          when={bool(props.selectable, false)}
          fallback={<span class="badge">{calculi[calc()].name}</span>}
        >
          <select class="input" value={calc()} onChange={(e) => setCalc(e.currentTarget.value as CalculusId)}>
            <For each={Object.entries(calculi)}>{([id, f]) => <option value={id}>{f.name}</option>}</For>
          </select>
        </Show>
        <span class="grow" />
        <Show when={errors() > 0} fallback={<span class="badge ok">✓ checked</span>}>
          <span class="badge err">
            {errors()} error{errors() > 1 ? 's' : ''}
          </span>
        </Show>
        <span class="muted" style={{ 'font-size': '0.7rem' }}>
          {result().time.toFixed(0)} ms
        </span>
        <button class="btn small ghost" title="reset to the original code" onClick={() => onChange(props.code.replace(/^\n/, '').replace(/\n$/, ''))}>
          ↺
        </button>
      </div>
      <div class="pg-body">
        <div class="pg-editor">
          <Editor
            value={code()}
            onChange={onChange}
            diagnostics={diagnostics()}
            hover={(pos) => hoverInfo(result().env, result().infos, pos)}
            minHeight={props.height ?? '6rem'}
            lineNumbers={props.lineNumbers}
            wrap={props.wrap}
            ref={(v) => (view = v)}
          />
        </div>
        <div class="pg-info">
          <Show when={shown().length > 0} fallback={<div class="pg-empty">Write a command such as <code>#check</code>, <code>#reduce</code> or <code>def</code>.</div>}>
            <For each={shown()}>
              {(r, i) => (
                <ResultView
                  env={result().env}
                  r={r}
                  src={debounced()}
                  onSelect={select}
                  allowDerivation={bool(props.derivations, true)}
                  allowSteps={bool(props.steps, true)}
                  activePanel={panel()?.idx === i() ? panel()!.kind : 'none'}
                  onPanel={(kind, node) => setPanel(kind === 'none' ? undefined : { kind, idx: i(), node })}
                />
              )}
            </For>
          </Show>
        </div>
      </div>
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
