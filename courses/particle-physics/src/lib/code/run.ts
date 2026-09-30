/**
 * Runs an exercise's tests against a piece of code. Used by the worker, by Vitest (reference solutions) and by
 * anything else that wants a verdict without a worker.
 */
import * as harness from './harness';
import { LIBRARY, describeError, evaluate } from './modules';
import type { RunReport } from './protocol';

const fmt = (a: unknown) => (typeof a === 'string' ? a : harness.show(a));

/** Evaluate `code` (the solution module) and run `tests` (which `import … from 'solution'`). */
export async function runTests(id: string, code: string, tests: string): Promise<RunReport> {
  const start = performance.now();
  const logs: string[] = [];
  const log = (prefix: string) => (...a: unknown[]) => {
    if (logs.length < 200) logs.push(prefix + a.map(fmt).join(' '));
  };
  const cons = { log: log(''), info: log(''), warn: log('⚠ '), error: log('✖ ') };
  const userFile = `${id}/solution.ts`;
  try {
    let user: Record<string, unknown>;
    try {
      user = evaluate(code, userFile, (s) => LIBRARY[s], cons);
    } catch (err) {
      throw new Error(describeError(err, userFile));
    }
    evaluate(tests, `${id}/solution.test.ts`, (s) => (s === 'solution' || s === './solution' ? user : s === '@pp/test' ? harness : LIBRARY[s]), cons);
    const results = await harness.runRegistered((err) => describeError(err, userFile));
    return { ok: true, results, logs, ms: performance.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), results: [], logs, ms: performance.now() - start };
  }
}
