/**
 * The FPGA flow off the main thread: `fromRtl` and `runFlow` on an elaborated design, with a message at the start and
 * end of every stage. Imported with Vite's `?worker` by `client.ts`.
 */
import { FlowError } from '../../pld/fpga';
import { runFpgaFlow } from './result';
import type { FlowMessage, FlowRequest } from './types';

const post = (m: FlowMessage, transfer: Transferable[] = []) => (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(m, transfer);

/** Handles one request; `send` is `postMessage` in the worker and a direct call in tests and the fallback. */
export function handle(req: FlowRequest, send: (m: FlowMessage) => void): void {
  try {
    const result = runFpgaFlow(req.design, {
      device: req.device,
      seed: req.seed,
      pins: req.pins,
      progress: (stage, phase, ms) => send({ id: req.id, type: 'progress', stage, phase, ms }),
    });
    send({ id: req.id, type: 'result', result });
  } catch (e) {
    if (e instanceof FlowError) send({ id: req.id, type: 'error', message: e.message, stage: e.stage, elements: e.elements });
    else send({ id: req.id, type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
}

if (typeof self !== 'undefined' && typeof (self as { document?: unknown }).document === 'undefined' && 'onmessage' in self) {
  self.onmessage = (ev: MessageEvent<FlowRequest>) => handle(ev.data, (m) => post(m));
}
