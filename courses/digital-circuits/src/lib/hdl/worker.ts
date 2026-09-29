/**
 * The DCL analysis worker: checks, elaborates and lowers a source off the main thread, and answers with plain
 * data (see `editor/analysis.ts`). Imported by `editor/client.ts` with Vite's `?worker`.
 */
import { analyze, type AnalyzeRequest } from './editor/analysis';

self.onmessage = (ev: MessageEvent<{ id: number; req: AnalyzeRequest }>) => {
  const { id, req } = ev.data;
  try {
    (self as unknown as { postMessage(m: unknown): void }).postMessage({ id, ok: true, value: analyze(req) });
  } catch (e) {
    (self as unknown as { postMessage(m: unknown): void }).postMessage({ id, ok: false, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
};
