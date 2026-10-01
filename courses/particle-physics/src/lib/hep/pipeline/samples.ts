/**
 * Precomputed samples: a preset run once, offline, by `scripts/data/samples.ts` with the same code and seeds as the live pipeline, and stored as a JSON file
 * (`static/data/samples/<preset>.json`) so that a chapter figure shows a finished histogram at once. "Regenerate with my code" reruns the pipeline live with the
 * reader's hooks installed and replaces it.
 *
 * A payload holds the configuration it was made with, the leading-order cross-sections, the accumulated result (counts only, no events) and a manifest
 * (seeds, code version, selection, approximations).
 */
import { PIPELINE_VERSION, type PipelineConfig } from './config.ts';
import type { BatchResult } from './accum.ts';

export interface SampleManifest {
  /** The preset name. */
  preset: string;
  /** What the file is, in one sentence. */
  description: string;
  /** Run seed and number of events generated per sample (events 0 … n − 1 of that run). */
  seed: number;
  events: number;
  eventsPerSample: Record<string, number>;
  /** `PIPELINE_VERSION` of the code that made it, and of the physics library (the same number: the library is part of the repository). */
  pipelineVersion: string;
  /** The script that made it and when (ISO date). */
  script: string;
  made: string;
  /** The selection and observables in words, for the reader. */
  selection: string;
  /** The hooks that were installed when it was made: none (the reference code). */
  hooks: string[];
  /** Normalisation: cross-sections at leading order times the K-factors in the configuration. */
  normalisation: string;
  /** Wall-clock seconds the script took, and the number of worker threads it used. */
  seconds: number;
  threads: number;
  /** Known approximations. */
  notes: string[];
}

export interface SamplePayload {
  manifest: SampleManifest;
  config: PipelineConfig;
  /** LO cross-section in pb of each sample (window included, K-factors not). */
  xsec: number[];
  result: BatchResult;
}

/** Check that a parsed JSON value has the shape of a payload; throws with a reason if not. */
export function parsePayload(x: unknown): SamplePayload {
  const p = x as Partial<SamplePayload> | null;
  if (!p || typeof p !== 'object' || !p.manifest || !p.config || !Array.isArray(p.xsec) || !p.result) throw new Error('not a sample payload');
  if (!Array.isArray(p.result.samples) || p.result.samples.length !== p.xsec.length) throw new Error('sample payload: xsec and result disagree');
  return p as SamplePayload;
}

/** The part of a configuration that determines the physics of a run (everything but labels and the analysis's presentation options). */
export function physicsKey(c: PipelineConfig): string {
  const a = c.analysis;
  return JSON.stringify([
    c.machine, c.generator, c.detector, c.reco, c.trigger,
    a.observables, a.binning, a.selection,
  ]);
}

/** Whether a payload was made with this configuration's physics (so its histograms are this configuration's, up to statistics). */
export function payloadMatches(p: SamplePayload, c: PipelineConfig): boolean {
  return p.manifest.pipelineVersion === PIPELINE_VERSION && physicsKey(p.config) === physicsKey(c);
}
