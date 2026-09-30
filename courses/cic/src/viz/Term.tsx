// Rendering core terms with semantic colouring and hover information.

import { createEffect, onCleanup } from 'solid-js';
import type { Expr } from '@kernel/core/expr.ts';
import { LocalContext, type Environment } from '@kernel/core/env.ts';
import { Printer, type PNode, type PrettyOptions } from '@kernel/core/pretty.ts';
import { TypeChecker } from '@kernel/core/typechecker.ts';
import { hideTooltip, showTooltip } from './tooltip.ts';

export interface Highlight {
  path: number[];
  cls: string;
}

export interface TermProps {
  env: Environment;
  expr: Expr;
  lctx?: LocalContext;
  opts?: PrettyOptions;
  highlights?: Highlight[];
  /** show the type of the hovered subterm */
  hoverTypes?: boolean;
  onHoverPath?: (path: number[] | undefined) => void;
  onClickPath?: (path: number[], e: MouseEvent) => void;
  class?: string;
  block?: boolean;
}

const pathKey = (p: number[]) => p.join('.');

/** build DOM for a printed term; returns the root and a map from path to span */
export function renderPNode(root: PNode, subs: Map<string, HTMLElement>, nodes: Map<HTMLElement, PNode>): HTMLElement {
  const build = (n: PNode): Node => {
    if (n.text !== undefined && !n.children) {
      if (n.expr && n.path) {
        const s = document.createElement('span');
        s.className = `sub t-${n.cls ?? 'term'}`;
        s.textContent = n.text;
        const k = pathKey(n.path);
        if (!subs.has(k)) subs.set(k, s);
        nodes.set(s, n);
        return s;
      }
      if (!n.cls) return document.createTextNode(n.text);
      const s = document.createElement('span');
      // word-like keywords (fun, λ, ∀, let …) take the keyword colour; arrows and := stay quiet
      s.className = n.cls === 'kw' && /^[\p{L}λΠ∀∃]/u.test(n.text) ? 't-kw w' : `t-${n.cls}`;
      s.textContent = n.text;
      return s;
    }
    const s = document.createElement('span');
    if (n.expr && n.path) {
      s.className = 'sub';
      const k = pathKey(n.path);
      if (!subs.has(k)) subs.set(k, s);
      nodes.set(s, n);
    }
    for (const c of n.children ?? []) s.appendChild(build(c));
    return s;
  };
  const r = document.createElement('span');
  r.appendChild(build(root));
  return r;
}

export function typeTooltip(env: Environment, n: PNode): HTMLElement {
  const wrap = document.createElement('div');
  const printer = new Printer(env, { maxDepth: 40 });
  const lctx = n.lctx ?? LocalContext.empty;
  const term = document.createElement('div');
  term.className = 'term';
  try {
    const tc = new TypeChecker(env, lctx, { fuel: 5000 });
    const ty = tc.inferOnly(n.expr!);
    const e = renderPNode(printer.print(n.expr!, lctx), new Map(), new Map());
    const t = renderPNode(printer.print(ty, lctx), new Map(), new Map());
    term.append(e, document.createTextNode(' : '), t);
  } catch {
    term.appendChild(renderPNode(printer.print(n.expr!, lctx), new Map(), new Map()));
  }
  wrap.appendChild(term);
  return wrap;
}

export function Term(props: TermProps) {
  let host!: HTMLElement;
  let subs = new Map<string, HTMLElement>();
  let nodes = new Map<HTMLElement, PNode>();
  let hovered: HTMLElement | undefined;

  createEffect(() => {
    const printer = new Printer(props.env, props.opts ?? {});
    const p = printer.print(props.expr, props.lctx ?? LocalContext.empty);
    subs = new Map();
    nodes = new Map();
    host.replaceChildren(renderPNode(p, subs, nodes));
    applyHighlights();
  });

  const applyHighlights = () => {
    for (const el of subs.values()) el.classList.remove('redex', 'fresh', 'occ-strict', 'occ-negative', 'occ-nonstrict', 'occ-nested', 'sel');
    for (const h of props.highlights ?? []) {
      // find the closest printed ancestor of the path
      let p = [...h.path];
      let el = subs.get(pathKey(p));
      while (!el && p.length > 0) {
        p = p.slice(0, -1);
        el = subs.get(pathKey(p));
      }
      el?.classList.add(h.cls);
    }
  };
  createEffect(() => {
    void props.highlights;
    applyHighlights();
  });

  const onMove = (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('.sub') as HTMLElement | null;
    if (t === hovered) return;
    hovered?.classList.remove('hover');
    hovered = t && host.contains(t) ? t : undefined;
    if (hovered) {
      hovered.classList.add('hover');
      const n = nodes.get(hovered);
      props.onHoverPath?.(n?.path);
      if (props.hoverTypes !== false && n?.expr) showTooltip(e.clientX, e.clientY, typeTooltip(props.env, n));
    } else {
      props.onHoverPath?.(undefined);
      hideTooltip();
    }
  };
  const onLeave = () => {
    hovered?.classList.remove('hover');
    hovered = undefined;
    props.onHoverPath?.(undefined);
    hideTooltip();
  };
  const onClick = (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('.sub') as HTMLElement | null;
    const n = t ? nodes.get(t) : undefined;
    if (n?.path) props.onClickPath?.(n.path, e);
  };
  onCleanup(hideTooltip);

  return (
    <span
      ref={host as HTMLSpanElement}
      class={`term ${props.class ?? ''}`}
      style={{ display: props.block ? 'block' : 'inline' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    />
  );
}
