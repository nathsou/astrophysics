/** Run k-induction or IC3 in a worker; returns a function that cancels the run (and stops the worker). */
import type { InductionEvent, InductionRequest } from '$lib/fv/ic3/worker';

export function runInduction(req: InductionRequest, on: (e: InductionEvent) => void): () => void {
  const worker = new Worker(new URL('../../fv/ic3/worker.ts', import.meta.url), { type: 'module', name: 'induction' });
  let live = true;
  worker.onmessage = (e: MessageEvent<InductionEvent>) => {
    if (!live) return;
    on(e.data);
    if (e.data.kind === 'done') {
      live = false;
      worker.terminate();
    }
  };
  worker.onerror = (e) => {
    if (!live) return;
    on({ kind: 'error', message: e.message || 'the checker stopped' });
    on({ kind: 'done' });
    live = false;
    worker.terminate();
  };
  worker.postMessage(req);
  return () => {
    live = false;
    worker.terminate();
  };
}
