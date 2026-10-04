/** Run the peephole court in its own worker; returns a function that cancels the run (and stops the worker). */
import type { CourtEvent, CourtRequest } from '$lib/fv/rewrite/worker';

export function runCourt(req: CourtRequest, on: (e: CourtEvent) => void): () => void {
  const worker = new Worker(new URL('../../fv/rewrite/worker.ts', import.meta.url), { type: 'module', name: 'peephole-court' });
  let live = true;
  worker.onmessage = (e: MessageEvent<CourtEvent>) => {
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

/** The verdicts at every width, without waiting for certificates. */
export function courtVerdicts(text: string, widths: number[], timeout = 4000): Promise<{ error?: string; verdicts: Extract<CourtEvent, { kind: 'width' }>['verdict'][] }> {
  return new Promise((resolve) => {
    const verdicts: Extract<CourtEvent, { kind: 'width' }>['verdict'][] = [];
    let error: string | undefined;
    runCourt({ text, widths, timeout, certify: false }, (e) => {
      if (e.kind === 'width') verdicts.push(e.verdict);
      else if (e.kind === 'error') error = e.message;
      else if (e.kind === 'done') resolve({ error, verdicts });
    });
  });
}
