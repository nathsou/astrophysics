import type { WorkerShape } from '@valtown/codemirror-ts/worker';
import type { Remote } from 'comlink';

let service: Promise<Remote<WorkerShape>> | undefined;

/** Lazily start the shared TypeScript language-service worker (a few MB; loaded on first use). */
export function tsService(): Promise<Remote<WorkerShape>> {
  service ??= (async () => {
    const Comlink = await import('comlink');
    const worker = new Worker(new URL('./ts.worker.ts', import.meta.url), { type: 'module' });
    const remote = Comlink.wrap<WorkerShape>(worker);
    await remote.initialize();
    return remote;
  })();
  return service;
}
