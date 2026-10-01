/// <reference lib="webworker" />
/**
 * The Control Room's worker host: runs batches of the pipeline for the page.
 *
 * The page posts `init` with the reader's saved solutions, which are evaluated and installed as hook overrides *in this worker* (each worker has its own
 * module state), and then jobs (`start`, `n`). A job runs events of the run with the page's seed with `runBatch`; its result is posted back as plain
 * data. Prepared configurations are cached, and so are the integration grids of the generator, so only the first job of a configuration is slow.
 *
 * `createHost(post)` holds the logic and is independent of the worker globals, so that Vitest can drive it in-process.
 */
import { prepare, runBatch, sampleSigmaLO, windowFraction, configKey, type Prepared } from '../hep/pipeline/index.ts';
import { applyEntries } from './mineApply.ts';
import type { FromWorker, ToWorker } from './protocol.ts';

export function createHost(post: (m: FromWorker) => void): (m: ToWorker) => void {
  const cache = new Map<string, Prepared>();
  const preparedFor = (config: Parameters<typeof prepare>[0]): Prepared => {
    const key = configKey(config);
    let p = cache.get(key);
    if (!p) {
      if (cache.size > 4) cache.clear();
      p = prepare(config);
      cache.set(key, p);
    }
    return p;
  };
  return (m) => {
    try {
      if (m.type === 'init') {
        cache.clear();
        const applied = applyEntries(m.mine);
        post({ type: 'ready', active: applied.active, errors: applied.errors });
      } else if (m.type === 'xsec') {
        const t0 = performance.now();
        const p = preparedFor(m.config);
        const xsec = p.samples.map((s) => sampleSigmaLO(s, p.sqrtS));
        const windows = p.samples.map((s) => (s.window ? windowFraction(s, p.sqrtS) : null));
        post({ type: 'xsec', runId: m.runId, xsec, windows, ms: performance.now() - t0 });
      } else if (m.type === 'job') {
        const t0 = performance.now();
        const p = preparedFor(m.config);
        const result = runBatch(m.config, m.n, m.seed, { start: m.start, keep: m.keep, prepared: p });
        post({ type: 'result', runId: m.runId, jobId: m.jobId, start: m.start, n: m.n, result, ms: performance.now() - t0 });
      }
    } catch (e) {
      post({ type: 'fatal', runId: 'runId' in m ? m.runId : 0, message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    }
  };
}

// In a real worker, wire the host to the worker's message port. (Under Vitest and in the page `WorkerGlobalScope` does not exist, so nothing is installed.)
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const host = createHost((m) => (self as unknown as Worker).postMessage(m));
  self.onmessage = (e: MessageEvent<ToWorker>) => host(e.data);
}
