/**
 * The analysis client: runs `analyze` in a Web Worker (`../worker.ts`, imported with Vite's `?worker`), or in
 * the page when workers are unavailable. Requests carry a key; only the newest request of each key gets an
 * answer (older ones resolve to `undefined`), so a fast typist never sees a stale result.
 */
import type { Analysis, AnalyzeRequest } from './analysis';

type Pending = { key: string; resolve: (a: Analysis | undefined) => void };

export interface Analyzer {
  /** Analyses a source; resolves to undefined if a newer request with the same key superseded it. */
  run(req: AnalyzeRequest, key?: string): Promise<Analysis | undefined>;
  /** Whether a worker is in use (false: analysis runs in the page). */
  readonly worker: boolean;
  dispose(): void;
}

let shared: Analyzer | undefined;

/** One analyzer for the whole page. */
export function getAnalyzer(): Analyzer {
  return (shared ??= createAnalyzer());
}

export function createAnalyzer(options: { worker?: boolean } = {}): Analyzer {
  let worker: Worker | undefined;
  let fallback = options.worker === false || typeof Worker === 'undefined';
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const latest = new Map<string, number>();
  let direct: Promise<typeof import('./analysis')> | undefined;

  const runDirect = async (req: AnalyzeRequest): Promise<Analysis> => {
    direct ??= import('./analysis');
    const { analyze } = await direct;
    // Yield first, so typing is not blocked by an analysis that started on the same tick.
    await new Promise((r) => setTimeout(r, 0));
    return analyze(req);
  };

  const start = async () => {
    if (worker || fallback) return;
    try {
      const mod = await import('../worker.ts?worker');
      worker = new mod.default();
      worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; value?: Analysis; error?: string }>) => {
        const p = pending.get(ev.data.id);
        if (!p) return;
        pending.delete(ev.data.id);
        if (!ev.data.ok) {
          console.error('DCL analysis failed:', ev.data.error);
          p.resolve(undefined);
        } else p.resolve(latest.get(p.key) === ev.data.id ? ev.data.value : undefined);
      };
      worker.onerror = () => {
        // A blocked or crashed worker: carry on in the page.
        fallback = true;
        worker?.terminate();
        worker = undefined;
        for (const [id, p] of pending) {
          pending.delete(id);
          p.resolve(undefined);
        }
      };
    } catch {
      fallback = true;
    }
  };

  return {
    get worker() {
      return !!worker;
    },
    async run(req, key = 'default') {
      const id = nextId++;
      latest.set(key, id);
      await start();
      if (fallback || !worker) {
        const a = await runDirect(req);
        return latest.get(key) === id ? a : undefined;
      }
      return new Promise<Analysis | undefined>((resolve) => {
        pending.set(id, { key, resolve });
        worker!.postMessage({ id, req });
      });
    },
    dispose() {
      worker?.terminate();
      worker = undefined;
      pending.clear();
    },
  };
}
