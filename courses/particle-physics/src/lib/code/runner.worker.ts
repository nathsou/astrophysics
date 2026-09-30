/// <reference lib="webworker" />
import { runTests } from './run';
import type { RunRequest } from './protocol';

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, code, tests } = e.data;
  (self as unknown as Worker).postMessage(await runTests(id, code, tests));
};
