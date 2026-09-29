// Rendering of frontend results: outputs, messages and goals.

import { For, Show, createSignal } from 'solid-js';
import type { CommandResult, Goal, Message } from '@kernel/frontend.ts';
import type { Environment } from '@kernel/core/env.ts';
import { LocalContext } from '@kernel/core/env.ts';
import type { Msg } from '@kernel/core/typechecker.ts';
import { TypeChecker, type Deriv } from '@kernel/core/typechecker.ts';
import { Term } from './Term.tsx';
import { groupHyps } from '@kernel/format.ts';
import { DerivationTree } from './DerivationTree.tsx';
import { TypedStepper } from './TypedStepper.tsx';
import { mkConst } from '@kernel/core/expr.ts';
import { lparam } from '@kernel/core/level.ts';
import type { Expr } from '@kernel/core/expr.ts';

export function MsgView(props: { env: Environment; msg: Msg }) {
  return (
    <span class="msg-text">
      <For each={props.msg}>{(p) => (typeof p === 'string' ? <span>{p}</span> : <Term env={props.env} expr={p.e} lctx={p.lctx} />)}</For>
    </span>
  );
}

export function GoalView(props: { env: Environment; goal: Goal }) {
  const g = props.goal;
  const before = (i: number) => g.lctx.decls.slice(0, i).reduce((l, d) => l.push(d), LocalContext.empty);
  return (
    <div class="goal">
      <Show when={g.name}>
        <div class="goal-name">case {g.name}</div>
      </Show>
      <For each={groupHyps(g.lctx.decls)}>
        {(grp) => (
          <div class="goal-hyp">
            <span class="t-var">{grp.map((d) => d.name).join(' ')}</span> <span class="t-punct">:</span>{' '}
            <Term env={props.env} expr={grp[0].type} lctx={before(g.lctx.decls.indexOf(grp[0]))} />
          </div>
        )}
      </For>
      <div class="goal-target">
        <span class="turnstile">⊢</span> <Term env={props.env} expr={g.type} lctx={g.lctx} />
      </div>
    </div>
  );
}

export function MessageView(props: { env: Environment; m: Message; src?: string }) {
  return (
    <div class={`msg ${props.m.severity}`}>
      <span class="msg-icon">{props.m.severity === 'error' ? '✗' : props.m.severity === 'warning' ? '!' : 'i'}</span>
      <div class="msg-body">
        <MsgView env={props.env} msg={props.m.msg} />
        <For each={props.m.goals ?? []}>{(g) => <GoalView env={props.env} goal={g} />}</For>
      </div>
    </div>
  );
}

function derivationFor(env: Environment, expr: Expr, lctx: LocalContext, type?: Expr): Deriv | undefined {
  try {
    const tc = new TypeChecker(env, lctx, { derive: true, fuel: 100_000 });
    if (type) return tc.check(expr, type).deriv;
    return tc.inferDeriv(expr).deriv;
  } catch (e) {
    const d = (e as { deriv?: Deriv }).deriv;
    return d;
  }
}

export type PanelKind = 'none' | 'deriv' | 'steps';

export function ResultView(props: {
  env: Environment;
  r: CommandResult;
  src: string;
  onSelect?: (from: number, to: number) => void;
  allowDerivation?: boolean;
  allowSteps?: boolean;
  /** when given, panels are shown by the parent instead of inline */
  onPanel?: (kind: PanelKind, node: () => import('solid-js').JSX.Element) => void;
  activePanel?: PanelKind;
}) {
  const [localPanel, setLocalPanel] = createSignal<PanelKind>('none');
  const panel = () => (props.onPanel ? (props.activePanel ?? 'none') : localPanel());
  const setPanel = (k: PanelKind) => {
    if (!props.onPanel) return setLocalPanel(k);
    if (k === 'none') return props.onPanel('none', () => null);
    props.onPanel(k, () => (k === 'deriv' ? derivNode() : stepsNode()));
  };
  const o = () => props.r.output;
  const srcLine = () => props.src.slice(0, props.r.span.from).split('\n').length;
  const derivTarget = (): { expr: Expr; type?: Expr; lctx: LocalContext } | undefined => {
    const out = o();
    if (!out) return undefined;
    if (out.k === 'check') return { expr: out.expr, lctx: out.lctx };
    if (out.k === 'reduce') return { expr: out.input, lctx: out.lctx };
    if (out.k === 'decl') {
      const d = props.env.get(out.main);
      if (d && (d.kind === 'def' || d.kind === 'theorem')) return { expr: d.value, type: d.type, lctx: LocalContext.empty };
    }
    return undefined;
  };
  const derivNode = () => {
    const t = derivTarget();
    if (!t) return null;
    const d = derivationFor(props.env, t.expr, t.lctx, t.type);
    return d ? (
      <div onClick={(e) => e.stopPropagation()}>
        <DerivationTree env={props.env} deriv={d} hideTypeFormation={!props.env.features.cube} />
      </div>
    ) : (
      <div class="muted">no derivation available</div>
    );
  };
  const stepsNode = () => {
    const t = stepTarget();
    if (!t) return null;
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <TypedStepper env={props.env} expr={t.expr} lctx={t.lctx} />
      </div>
    );
  };
  const stepTarget = (): { expr: Expr; lctx: LocalContext } | undefined => {
    const out = o();
    if (out?.k === 'reduce') return { expr: out.input, lctx: out.lctx };
    if (out?.k === 'check' && !out.constName) return { expr: out.expr, lctx: out.lctx };
    return undefined;
  };
  return (
    <div class="result" onClick={() => props.onSelect?.(props.r.span.from, props.r.span.to)}>
      <div class="result-line">{srcLine()}</div>
      <div class="result-body">
        <Show when={o()}>
          {(() => {
            const out = o()!;
            switch (out.k) {
              case 'check':
                return (
                  <div class="out">
                    <Term env={props.env} expr={out.expr} lctx={out.lctx} />
                    <span class="t-punct"> : </span>
                    <Term env={props.env} expr={out.type} lctx={out.lctx} />
                  </div>
                );
              case 'reduce':
                return (
                  <div class="out">
                    <Term env={props.env} expr={out.result} lctx={out.lctx} />
                  </div>
                );
              case 'decl': {
                const d = props.env.get(out.main);
                return (
                  <div class="out decl">
                    <span class="ok-mark">✓</span>
                    <span class="decl-name">{out.main}</span>
                    <Show when={d}>
                      <span class="t-punct"> : </span>
                      <Term env={props.env} expr={d!.type} />
                    </Show>
                    <Show when={out.names.length > 1}>
                      <div class="decl-extra">
                        also added:{' '}
                        <For each={out.names.filter((n) => n !== out.main)}>
                          {(n, i) => (
                            <>
                              {i() > 0 ? ', ' : ''}
                              <code
                                class="decl-link"
                                title={n}
                                onMouseEnter={() => undefined}
                              >
                                {n}
                              </code>
                            </>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                );
              }
              case 'print':
                return <PrintView env={props.env} decl={out.decl} axioms={out.axioms} />;
              case 'eval':
                return (
                  <div class="out eval">
                    <span class="eval-value">{out.value}</span>
                    <span class="eval-meta" title="steps of the compiled program">
                      {' '}
                      : <Term env={props.env} expr={out.type} lctx={out.lctx} />
                    </span>
                  </div>
                );
              case 'test':
                return (
                  <div class={`out test ${out.counterexample ? 'failed' : 'passed'}`}>
                    <Show
                      when={out.counterexample}
                      fallback={
                        <span>
                          <span class="ok-mark">✓</span> passed {out.passed} random tests <span class="muted">(evidence, not a proof)</span>
                        </span>
                      }
                    >
                      <span>
                        <span class="err-mark">✗</span> counterexample after {out.passed} passing test{out.passed === 1 ? '' : 's'}:{' '}
                        <For each={out.counterexample}>
                          {(c, i) => (
                            <>
                              {i() > 0 ? ', ' : ''}
                              <code>
                                {c.name} := {c.value}
                              </code>
                            </>
                          )}
                        </For>
                      </span>
                    </Show>
                  </div>
                );
            }
          })()}
        </Show>
        <For each={props.r.messages}>{(m) => <MessageView env={props.env} m={m} src={props.src} />}</For>
        <Show when={(props.allowDerivation && derivTarget()) || (props.allowSteps && stepTarget())}>
          <div class="result-actions" onClick={(e) => e.stopPropagation()}>
            <Show when={props.allowDerivation && derivTarget()}>
              <button class={`btn small ${panel() === 'deriv' ? 'active' : ''}`} onClick={() => setPanel(panel() === 'deriv' ? 'none' : 'deriv')}>
                derivation tree
              </button>
            </Show>
            <Show when={props.allowSteps && stepTarget()}>
              <button class={`btn small ${panel() === 'steps' ? 'active' : ''}`} onClick={() => setPanel(panel() === 'steps' ? 'none' : 'steps')}>
                reduce step by step
              </button>
            </Show>
          </div>
        </Show>
        <Show when={!props.onPanel && panel() === 'deriv'}>{derivNode()}</Show>
        <Show when={!props.onPanel && panel() === 'steps'}>{stepsNode()}</Show>
      </div>
    </div>
  );
}

export function PrintView(props: { env: Environment; decl: import('@kernel/core/env.ts').Decl; axioms?: string[] }) {
  const d = props.decl;
  const kindName: Record<string, string> = { def: 'def', theorem: 'theorem', axiom: 'axiom', inductive: 'inductive', ctor: 'constructor', rec: 'recursor', quot: 'quotient primitive', opaque: 'opaque' };
  return (
    <div class="out print">
      <Show
        when={!props.axioms}
        fallback={
          <div>
            '{d.name}' depends on axioms:{' '}
            {props.axioms!.length === 0 ? <em>none</em> : props.axioms!.map((a, i) => (i ? ', ' : '') + a).join('')}
          </div>
        }
      >
        <div>
          <span class="t-kw">{kindName[d.kind]} </span>
          <span class="decl-name">{d.name}</span>
          <Show when={d.levelParams.length > 0}>
            <span class="t-level">.{'{'}{d.levelParams.join(', ')}{'}'}</span>
          </Show>
          <span class="t-punct"> : </span>
          <Term env={props.env} expr={d.type} />
        </div>
        <Show when={d.kind === 'def' || d.kind === 'theorem'}>
          <div class="print-value">
            <span class="t-punct">:= </span>
            <Term env={props.env} expr={(d as { value: Expr }).value} />
          </div>
        </Show>
        <Show when={d.kind === 'inductive'}>
          <div class="print-value">
            <For each={(d as { ctors: string[] }).ctors}>
              {(c) => (
                <div>
                  <span class="t-punct">| </span>
                  <span class="t-ctor">{c}</span>
                  <span class="t-punct"> : </span>
                  <Term env={props.env} expr={props.env.get(c)!.type} />
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={d.kind === 'rec'}>
          <div class="print-value muted sans" style={{ 'font-size': '0.78rem' }}>
            ι-rules:{' '}
            <For each={(d as { rules: { ctor: string }[] }).rules}>{(r, i) => <>{i() ? ', ' : ''}{r.ctor}</>}</For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export const constOf = (name: string, env: Environment) => {
  const d = env.get(name)!;
  return mkConst(name, d.levelParams.map(lparam));
};
