import type { WorkerLike } from './pool.ts';

/** A new pipeline worker (browser only: Vite bundles `worker.ts` with the library it imports). */
export function makeWorker(): WorkerLike {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}
