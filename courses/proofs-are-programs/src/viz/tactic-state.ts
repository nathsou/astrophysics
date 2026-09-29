// Which tactic step does the cursor point at?
//
// Like Lean's infoview: inside a tactic block, the goals shown are those after
// the tactic on or before the cursor; on a tactic, the goals before and after it.

import type { TacticStep } from '@kernel/elab/tactics.ts';
import type { Expr } from '@kernel/core/expr.ts';

export interface StepAtCursor {
  step: TacticStep;
  /** the cursor is inside this step's own text */
  inside: boolean;
  /** the previous leaf step of the same block (for the lens: what changed) */
  prev?: TacticStep;
  /** index among the leaf steps of the block, and their number */
  index: number;
  count: number;
  leaves: TacticStep[];
}

const contains = (s: { from: number; to: number }, t: { from: number; to: number }) => s.from <= t.from && t.to <= s.to && (s.from !== t.from || s.to !== t.to);

/** steps that do not contain other steps (the tactics actually run, not `·` or `<;>` wrappers) */
export function leafSteps(steps: TacticStep[]): TacticStep[] {
  return steps.filter((s) => !steps.some((t) => t !== s && contains(s.span, t.span)));
}

export function stepAt(steps: TacticStep[], pos: number): StepAtCursor | undefined {
  // the innermost tactic block containing the cursor
  const blocks = new Map<string, TacticStep[]>();
  for (const s of steps) {
    const k = `${s.blockSpan.from}:${s.blockSpan.to}`;
    if (!blocks.has(k)) blocks.set(k, []);
    blocks.get(k)!.push(s);
  }
  let best: TacticStep[] | undefined;
  for (const list of blocks.values()) {
    const b = list[0].blockSpan;
    if (b.from <= pos && pos <= b.to + 1) {
      if (!best || b.to - b.from < best[0].blockSpan.to - best[0].blockSpan.from) best = list;
    }
  }
  if (!best) return undefined;
  const leaves = leafSteps(best).sort((a, b) => a.span.from - b.span.from);
  if (leaves.length === 0) return undefined;
  let idx = -1;
  for (let i = 0; i < leaves.length; i++) if (leaves[i].span.from <= pos) idx = i;
  if (idx < 0) return { step: leaves[0], inside: false, index: -1, count: leaves.length, leaves };
  const step = leaves[idx];
  return { step, inside: step.span.from <= pos && pos <= step.span.to, prev: leaves[idx - 1], index: idx, count: leaves.length, leaves };
}

/** paths (in the printer's convention) where `after` fills a hole of `before` */
export function filledPaths(before: Expr | undefined, after: Expr): number[][] {
  if (!before) return [];
  const out: number[][] = [];
  const isHole = (e: Expr) => {
    let h = e;
    while (h.k === 'app') h = h.fn;
    return h.k === 'mvar';
  };
  const go = (b: Expr, a: Expr, path: number[]) => {
    if (isHole(b)) {
      if (!isHole(a)) out.push(path);
      return;
    }
    if (b.k !== a.k) return;
    switch (b.k) {
      case 'app':
        go(b.fn, (a as typeof b).fn, [...path, 0]);
        go(b.arg, (a as typeof b).arg, [...path, 1]);
        return;
      case 'lam':
      case 'pi':
        go(b.type, (a as typeof b).type, [...path, 0]);
        go(b.body, (a as typeof b).body, [...path, 1]);
        return;
      case 'let':
        go(b.type, (a as typeof b).type, [...path, 0]);
        go(b.value, (a as typeof b).value, [...path, 1]);
        go(b.body, (a as typeof b).body, [...path, 2]);
        return;
    }
  };
  go(before, after, []);
  return out;
}

/** paths of the holes (unsolved goals) in a term */
export function holePaths(e: Expr): { path: number[]; id: number }[] {
  const out: { path: number[]; id: number }[] = [];
  const go = (x: Expr, path: number[]) => {
    let h = x;
    while (h.k === 'app') h = h.fn;
    if (h.k === 'mvar') {
      out.push({ path, id: h.id });
      return;
    }
    switch (x.k) {
      case 'app':
        go(x.fn, [...path, 0]);
        go(x.arg, [...path, 1]);
        return;
      case 'lam':
      case 'pi':
        go(x.type, [...path, 0]);
        go(x.body, [...path, 1]);
        return;
      case 'let':
        go(x.type, [...path, 0]);
        go(x.value, [...path, 1]);
        go(x.body, [...path, 2]);
        return;
    }
  };
  go(e, []);
  return out;
}
