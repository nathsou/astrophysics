/**
 * The flow client: runs the FPGA flow in a Web Worker (`worker.ts`, imported with `?worker`) and reports progress;
 * falls back to running in the page when workers are unavailable. One request at a time: a new `run` cancels the
 * previous one (its promise rejects with `Cancelled`).
 */
import type { RtlDesign } from '../../hdl/rtl';
import type { FlowMessage, FlowRequest, FpgaResult, VFpgaSize } from './types';

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

export class FlowFailure extends Error {
  constructor(
    message: string,
    readonly stage?: string,
    readonly elements: string[] = [],
  ) {
    super(message);
    this.name = 'FlowFailure';
  }
}

export interface FlowRun {
  design: RtlDesign;
  device?: VFpgaSize;
  seed?: number;
  pins?: Record<string, string>;
  onProgress?: (stage: string, phase: 'start' | 'end', ms?: number) => void;
}

export interface FlowClient {
  run(req: FlowRun): Promise<FpgaResult>;
  cancel(): void;
  readonly worker: boolean;
  dispose(): void;
}

export function createFlowClient(options: { worker?: boolean } = {}): FlowClient {
  let worker: Worker | undefined;
  let fallback = options.worker === false || typeof Worker === 'undefined';
  let nextId = 1;
  let current: { id: number; resolve: (r: FpgaResult) => void; reject: (e: Error) => void; onProgress?: FlowRun['onProgress'] } | undefined;

  const settle = (m: FlowMessage) => {
    const c = current;
    if (!c || c.id !== m.id) return;
    if (m.type === 'progress') c.onProgress?.(m.stage, m.phase, m.ms);
    else {
      current = undefined;
      if (m.type === 'result') c.resolve(m.result);
      else c.reject(new FlowFailure(m.message, m.stage, m.elements));
    }
  };

  const start = async () => {
    if (worker || fallback) return;
    try {
      const mod = await import('./worker.ts?worker');
      worker = new mod.default();
      worker.onmessage = (ev: MessageEvent<FlowMessage>) => settle(ev.data);
      worker.onerror = () => {
        // A blocked or crashed worker: carry on in the page.
        fallback = true;
        worker?.terminate();
        worker = undefined;
        const c = current;
        current = undefined;
        c?.reject(new FlowFailure('The worker stopped; try again.'));
      };
    } catch {
      fallback = true;
    }
  };

  return {
    get worker() {
      return !!worker;
    },
    async run(req) {
      current?.reject(new Cancelled());
      current = undefined;
      const id = nextId++;
      await start();
      return new Promise<FpgaResult>((resolve, reject) => {
        current = { id, resolve, reject, onProgress: req.onProgress };
        const msg: FlowRequest = { id, design: req.design, device: req.device, seed: req.seed, pins: req.pins };
        if (worker && !fallback) worker.postMessage(msg);
        else {
          // In the page: yield first so the progress bar can paint, then run.
          setTimeout(async () => {
            const { handle } = await import('./worker');
            handle(msg, settle);
          }, 20);
        }
      });
    },
    cancel() {
      const c = current;
      current = undefined;
      c?.reject(new Cancelled());
      // A running worker cannot be interrupted: replace it.
      if (worker) {
        worker.terminate();
        worker = undefined;
      }
    },
    dispose() {
      this.cancel();
    },
  };
}
