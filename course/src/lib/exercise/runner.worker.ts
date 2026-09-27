/// <reference lib="webworker" />
import * as harness from './harness';
import { LIBRARY, describeError, evaluate } from './modules';
import type { RunReport, RunRequest } from './protocol';

const fmt = (a: unknown) => (typeof a === 'string' ? a : harness.show(a));

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, code, tests } = e.data;
  const start = performance.now();
  const logs: string[] = [];
  const log = (prefix: string) => (...a: unknown[]) => {
    if (logs.length < 200) logs.push(prefix + a.map(fmt).join(' '));
  };
  const cons = { log: log(''), info: log(''), warn: log('⚠ '), error: log('✖ ') };
  const userFile = `${id}/solution.ts`;
  let report: RunReport;
  try {
    let user: Record<string, unknown>;
    try {
      user = evaluate(code, userFile, (s) => LIBRARY[s], cons);
    } catch (err) {
      throw new Error(describeError(err, userFile));
    }
    evaluate(tests, `${id}/solution.test.ts`, (s) => (s === './solution.ts' || s === './solution' ? user : s === '@lm/test' ? harness : LIBRARY[s]), cons);
    const results = await harness.runRegistered((err) => describeError(err, userFile));
    report = { ok: true, results, logs, ms: performance.now() - start };
  } catch (err) {
    report = { ok: false, error: err instanceof Error ? err.message : String(err), results: [], logs, ms: performance.now() - start };
  }
  (self as unknown as Worker).postMessage(report);
};
