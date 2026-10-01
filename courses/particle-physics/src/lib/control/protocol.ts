/**
 * Messages between the Control Room's pool (main thread) and its workers. Everything is structured-cloneable plain data.
 */
import type { BatchResult, PipelineConfig } from '../hep/pipeline/index.ts';
import type { Mine } from '../code/mine.ts';

/** Page → worker. */
export type ToWorker =
  /** Install the reader's saved solutions (or none) as hook overrides. */
  | { type: 'init'; mine: Mine }
  /** Leading-order cross-sections (pb) of the configuration's samples, with the generator-level window fractions: trains the integration grids, so it takes up to a few seconds. */
  | { type: 'xsec'; runId: number; config: PipelineConfig }
  /** Run events `start … start + n − 1` of the run with this seed. */
  | { type: 'job'; runId: number; jobId: number; config: PipelineConfig; seed: number; start: number; n: number; keep: number };

/** Worker → page. */
export type FromWorker =
  | { type: 'ready'; active: string[]; errors: Record<string, string> }
  | { type: 'xsec'; runId: number; xsec: number[]; windows: ({ eff: number; error: number } | null)[]; ms: number }
  | { type: 'result'; runId: number; jobId: number; start: number; n: number; result: BatchResult; ms: number }
  /** The configuration could not even be prepared (an unknown process or observable, say). */
  | { type: 'fatal'; runId: number; message: string };

/** The stage of the pipeline a hook belongs to, or null if the pipeline does not use it. */
export function stageOfHook(hook: string): 'machine' | 'generator' | 'detector' | 'reconstruction' | 'trigger' | 'analysis' | null {
  const head = hook.split('.')[0]!;
  switch (head) {
    case 'machine': return 'machine';
    case 'gen': case 'shower': case 'hadronise': case 'decay': return 'generator';
    case 'detector': return 'detector';
    case 'reco': return 'reconstruction';
    case 'trigger': return 'trigger';
    case 'analysis': case 'kinematics': return 'analysis';
    default: return null;
  }
}
