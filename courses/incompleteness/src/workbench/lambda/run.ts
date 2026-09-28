// Running reductions without freezing the page: the engine's `reduce` is called in small chunks,
// yielding to the browser between them. The engine decides every step; this only schedules.

import { useEffect, useState } from 'react';
import { reduce, type Contraction, type RunStatus, type Strategy, type Term } from '../../engine/lambda/lambda';

export interface ChunkedResult {
  final: Term;
  status: RunStatus;
  count: number;
  steps: Contraction[];
}

export interface ChunkedOptions {
  fuel: number;
  maxSize?: number;
  trace?: boolean;
  /** Steps per call to the engine. */
  chunk?: number;
  /** Milliseconds of work before yielding. */
  budgetMs?: number;
}

/** Runs `strategy` from `start` for at most `fuel` steps; returns a cancel function. */
export function runChunked(start: Term, strategy: Strategy, o: ChunkedOptions, onProgress: (count: number) => void, onDone: (r: ChunkedResult) => void): () => void {
  let cancelled = false;
  let cur = start;
  let count = 0;
  const steps: Contraction[] = [];
  const chunk = o.chunk ?? 50;
  const budget = o.budgetMs ?? 24;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = () => {
    if (cancelled) return;
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
      const remaining = o.fuel - count;
      const r = reduce(cur, strategy, { fuel: Math.min(chunk, remaining), maxSize: o.maxSize, trace: o.trace ?? false });
      if (o.trace) steps.push(...r.steps);
      count += r.count;
      cur = r.final;
      if (r.status !== 'out-of-fuel' || count >= o.fuel) {
        onDone({ final: cur, status: r.status, count, steps });
        return;
      }
    }
    onProgress(count);
    timer = setTimeout(tick, 0);
  };
  timer = setTimeout(tick, 0);
  return () => {
    cancelled = true;
    if (timer !== null) clearTimeout(timer);
  };
}

export type NormalFormState = { phase: 'running'; count: number } | ({ phase: 'done' } & ChunkedResult);

/** The result of reducing `term` by a strategy (default normal order), computed in the background. */
export function useReduction(term: Term | null, fuel: number, strategy: Strategy = 'normal', maxSize = 20_000): NormalFormState | null {
  const [state, setState] = useState<{ term: Term; s: NormalFormState } | null>(null);
  useEffect(() => {
    if (!term) return;
    setState({ term, s: { phase: 'running', count: 0 } });
    return runChunked(
      term,
      strategy,
      { fuel, maxSize },
      (count) => setState({ term, s: { phase: 'running', count } }),
      (r) => setState({ term, s: { phase: 'done', ...r } }),
    );
  }, [term, fuel, strategy, maxSize]);
  if (!term) return null;
  if (!state || state.term !== term) return { phase: 'running', count: 0 };
  return state.s;
}

/** A plain-language, honest description of how a run ended. */
export function statusText(status: RunStatus, count: number, strategyName?: string): string {
  const steps = `${count} step${count === 1 ? '' : 's'}`;
  switch (status) {
    case 'normal-form':
      return `Normal form reached after ${steps}.`;
    case 'stopped':
      return `${strategyName ? strategyName[0]!.toUpperCase() + strategyName.slice(1) : 'The strategy'} has no further step after ${steps}, but the term still contains redexes (under a λ, or in an argument this strategy does not evaluate).`;
    case 'out-of-fuel':
      return `No normal form within ${steps}. That is all this shows: it does not mean the term has none.`;
    case 'size-limit':
      return `Stopped after ${steps}: the term grew too large to continue here. That does not mean it has no normal form.`;
  }
}
