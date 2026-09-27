// Proof trees of typing judgements, as produced by the kernel.

import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Deriv, SideCond } from '../kernel/core/typechecker.ts';
import { TypeChecker } from '../kernel/core/typechecker.ts';
import type { Environment, LocalContext } from '../kernel/core/env.ts';
import { ruleName, rules } from '../kernel/core/rules.ts';
import { Term } from './Term.tsx';
import type { PrettyOptions } from '../kernel/core/pretty.ts';
import { Printer } from '../kernel/core/pretty.ts';
import { showTooltip, hideTooltip } from './tooltip.ts';
import katex from 'katex';

export interface DerivationTreeProps {
  env: Environment;
  deriv: Deriv;
  /** hide premises that only check that a type is well formed */
  hideTypeFormation?: boolean;
  /** start fully collapsed and reveal step by step */
  stepwise?: boolean;
  opts?: PrettyOptions;
  title?: string;
}

let nodeIds = 0;
interface N {
  id: number;
  d: Deriv;
  children: N[];
  depth: number;
  formation: boolean;
}

function isFormation(d: Deriv): boolean {
  return d.type?.k === 'sort';
}

function build(d: Deriv, depth = 0): N {
  return { id: nodeIds++, d, depth, formation: isFormation(d), children: d.premises.map((p) => build(p, depth + 1)) };
}

function countNodes(n: N): number {
  return 1 + n.children.reduce((a, c) => a + countNodes(c), 0);
}

function ContextView(props: { env: Environment; lctx: LocalContext; base: LocalContext; opts?: PrettyOptions }) {
  const extra = () => props.lctx.decls.slice(props.base.size);
  return (
    <span class="dt-ctx">
      <Show when={props.base.size > 0}>
        <span class="dt-gamma">Γ</span>
        <Show when={extra().length > 0}>
          <span class="t-punct">, </span>
        </Show>
      </Show>
      <For each={extra()}>
        {(d, i) => (
          <>
            <Show when={i() > 0}>
              <span class="t-punct">, </span>
            </Show>
            <span class="t-var">{d.name}</span>
            <span class="t-punct"> : </span>
            <Term env={props.env} expr={d.type} lctx={ctxBefore(props.lctx, d.id)} opts={props.opts} />
            <Show when={d.value}>
              <span class="t-punct"> := </span>
              <Term env={props.env} expr={d.value!} lctx={ctxBefore(props.lctx, d.id)} opts={props.opts} />
            </Show>
          </>
        )}
      </For>
    </span>
  );
}

function ctxBefore(l: LocalContext, id: number): LocalContext {
  let r = l;
  // LocalContext is persistent; rebuild the prefix before `id`
  const decls = l.decls;
  const i = decls.findIndex((d) => d.id === id);
  r = decls.slice(0, i).reduce((acc, d) => acc.push(d), (l.constructor as unknown as { empty: LocalContext }).empty);
  return r;
}

function SideView(props: { env: Environment; s: SideCond; opts?: PrettyOptions }) {
  const s = props.s;
  const [open, setOpen] = createSignal(false);
  if (s.k === 'text') return <span class={`dt-side ${s.ok === false ? 'bad' : ''}`}>{s.text}</span>;
  if (s.k === 'lookup')
    return (
      <span class="dt-side">
        ({s.name} : <Term env={props.env} expr={s.type} lctx={s.lctx} opts={props.opts} />) ∈ Γ
      </span>
    );
  if (s.k === 'whnf')
    return (
      <span class="dt-side">
        <Term env={props.env} expr={s.from} lctx={s.lctx} opts={props.opts} /> ⟶<sub>whnf</sub> <Term env={props.env} expr={s.to} lctx={s.lctx} opts={props.opts} />
      </span>
    );
  // conversion
  const nf = createMemo(() => {
    if (!open()) return undefined;
    try {
      const tc = new TypeChecker(props.env, s.lctx, { fuel: 50_000 });
      return { a: tc.normalize(s.a), b: tc.normalize(s.b) };
    } catch {
      return undefined;
    }
  });
  return (
    <span class={`dt-side conv ${s.ok ? '' : 'bad'}`}>
      <Term env={props.env} expr={s.a} lctx={s.lctx} opts={props.opts} /> {s.ok ? '≡' : '≢'} <Term env={props.env} expr={s.b} lctx={s.lctx} opts={props.opts} />
      <button class="dt-why" onClick={() => setOpen(!open())} title="show the normal forms of both sides">
        why?
      </button>
      <Show when={open() && nf()}>
        <span class="dt-nf">
          both normalise to: <Term env={props.env} expr={nf()!.a} lctx={s.lctx} opts={props.opts} />
          <Show when={!s.ok}>
            {' '}vs <Term env={props.env} expr={nf()!.b} lctx={s.lctx} opts={props.opts} />
          </Show>
        </span>
      </Show>
    </span>
  );
}

function ruleTip(e: MouseEvent, id: string) {
  const r = rules[id];
  if (!r) return;
  const div = document.createElement('div');
  div.style.maxWidth = '26rem';
  const f = document.createElement('div');
  f.style.textAlign = 'center';
  f.style.margin = '0.2rem 0 0.4rem';
  const tex = `\\dfrac{${r.premises.join('\\qquad ') || '\\vphantom{x}'}}{${r.conclusion}}${r.side ? `\;\; ${r.side}` : ''}`;
  try {
    f.innerHTML = katex.renderToString(tex, { throwOnError: false });
  } catch {
    f.textContent = r.conclusion;
  }
  const b = document.createElement('div');
  b.textContent = `${r.name}: ${r.blurb}`;
  b.style.color = 'var(--ink-2)';
  div.append(f, b);
  showTooltip(e.clientX, e.clientY, div);
}

export function DerivationTree(props: DerivationTreeProps) {
  const root = createMemo(() => build(props.deriv));
  const [hideForm, setHideForm] = createSignal(props.hideTypeFormation ?? false);
  const [collapsed, setCollapsed] = createSignal<Set<number>>(new Set());
  const [revealDepth, setRevealDepth] = createSignal(props.stepwise ? 0 : Infinity);
  const [zoom, setZoom] = createSignal(1);
  const maxDepth = createMemo(() => {
    const go = (n: N): number => Math.max(n.depth, ...n.children.map(go));
    return go(root());
  });
  const base = () => props.deriv.lctx;

  const toggle = (id: number) => {
    const s = new Set(collapsed());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setCollapsed(s);
  };

  const Node = (p: { n: N }) => {
    const n = p.n;
    const d = n.d;
    const visibleChildren = () => n.children.filter((c) => !(hideForm() && c.formation));
    const hiddenCount = () => n.children.length - visibleChildren().length;
    const isCollapsed = () => collapsed().has(n.id) || n.depth >= revealDepth();
    return (
      <div class={`dt-node ${d.failed ? 'failed' : ''}`}>
        <Show when={n.children.length > 0 || d.side.length > 0 || true}>
          <div class="dt-premises">
            <Show
              when={!isCollapsed()}
              fallback={
                <Show when={n.children.length > 0}>
                  <button class="dt-more" onClick={() => (n.depth >= revealDepth() ? setRevealDepth(n.depth + 1) : toggle(n.id))}>
                    {n.children.length} premise{n.children.length > 1 ? 's' : ''} ⋯
                  </button>
                </Show>
              }
            >
              <For each={visibleChildren()}>{(c) => <Node n={c} />}</For>
              <Show when={hiddenCount() > 0}>
                <span class="dt-hidden" title="type-formation premises hidden">
                  ⊢ type ✓
                </span>
              </Show>
            </Show>
          </div>
        </Show>
        <div class="dt-bar" />
        <div class="dt-annot">
          <span class="dt-rule" onMouseEnter={(e) => ruleTip(e, d.rule)} onMouseLeave={hideTooltip} onClick={() => toggle(n.id)}>
            {ruleName(d.rule)}
          </span>
          <Show when={d.side.length > 0}>
            <span class="dt-sides">
              <For each={d.side}>{(s) => <SideView env={props.env} s={s} opts={props.opts} />}</For>
            </span>
          </Show>
        </div>
        <div class="dt-concl">
          <ContextView env={props.env} lctx={d.lctx} base={base()} opts={props.opts} />
          <span class="dt-turnstile"> ⊢ </span>
          <Term env={props.env} expr={d.term} lctx={d.lctx} opts={props.opts} />
          <span class="t-punct"> : </span>
          <Show when={d.type} fallback={<span class="dt-fail">✗</span>}>
            <Term env={props.env} expr={d.type!} lctx={d.lctx} opts={props.opts} />
          </Show>
        </div>
      </div>
    );
  };

  return (
    <div class="dtree widget wide">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Typing derivation'}</span>
        <span class="badge">{countNodes(root())} judgements</span>
        <span class="grow" />
        <Show when={props.stepwise || revealDepth() !== Infinity}>
          <button class="btn small" onClick={() => setRevealDepth(Math.max(0, revealDepth() - 1))} disabled={revealDepth() === 0}>
            ◀ fewer
          </button>
          <button class="btn small primary" onClick={() => setRevealDepth(revealDepth() + 1)} disabled={revealDepth() > maxDepth()}>
            grow tree ▲
          </button>
        </Show>
        <label class="row" style={{ gap: '0.3rem', 'font-size': '0.75rem' }}>
          <input type="checkbox" checked={hideForm()} onChange={(e) => setHideForm(e.currentTarget.checked)} /> hide type formation
        </label>
        <div class="seg">
          <button onClick={() => setZoom(Math.max(0.5, zoom() - 0.1))}>−</button>
          <button onClick={() => setZoom(1)}>{Math.round(zoom() * 100)}%</button>
          <button onClick={() => setZoom(Math.min(1.6, zoom() + 0.1))}>+</button>
        </div>
      </div>
      <div
        class="dt-scroll"
        ref={(el) =>
          requestAnimationFrame(() => {
            el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
            el.scrollTop = el.scrollHeight;
          })
        }
      >
        <div class="dt-canvas" style={{ zoom: zoom() }}>
          <Show when={root()} keyed>
            {(r) => <Node n={r} />}
          </Show>
        </div>
      </div>
      <div class="widget-foot">
        Read bottom-up: the conclusion is at the bottom, each bar is one rule application. Hover a rule name for the rule, a term for its type; click a rule to fold its premises.
      </div>
    </div>
  );
}

export { Printer };
