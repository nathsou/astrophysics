import type { ExerciseSpec } from '$lib/content/types';
import type { RunReport } from './protocol';

/**
 * Run an exercise's tests against learner code in a fresh worker.
 * A new worker per run means an infinite loop can always be killed by the timeout.
 */
export function runExercise(spec: ExerciseSpec, code: string, timeoutMs = 10_000): Promise<RunReport> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: `Timed out after ${timeoutMs / 1000}s — is there an infinite loop?`, results: [], logs: [], ms: timeoutMs });
    }, timeoutMs);
    worker.onmessage = (e: MessageEvent<RunReport>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, error: e.message || 'Worker failed to start', results: [], logs: [], ms: 0 });
    };
    worker.postMessage({ id: spec.id, code, tests: spec.tests });
  });
}
