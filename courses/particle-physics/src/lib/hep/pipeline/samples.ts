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
  /** The script that made it and when (ISO date), and the SHA-256 of the source of `src/lib/hep` it ran (the code version beyond `pipelineVersion`). */
  script: string;
  made: string;
  codeSha256?: string;
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

/**
 * The part of a configuration that determines the events and histograms of a run. Everything else (the K-factor, the luminosity the histograms are scaled to, the
 * signal window, the fit, pseudo-data, the dead time) is applied when a result is read, so changing it does not need a new run.
 */
export function physicsKey(c: PipelineConfig): string {
  const a = c.analysis;
  const { kFactor: _k, ...generator } = c.generator;
  const { deadTimeNs: _d, ...trigger } = c.trigger;
  void _k; void _d;
  return JSON.stringify([c.machine, generator, c.detector, c.reco, trigger, a.observables, a.binning, a.selection]);
}

/** Whether a payload was made with this configuration's physics (so its histograms are this configuration's, up to statistics). */
export function payloadMatches(p: SamplePayload, c: PipelineConfig): boolean {
  return p.manifest.pipelineVersion === PIPELINE_VERSION && physicsKey(p.config) === physicsKey(c);
}

const GEV = (x: number) => `${Number(x.toPrecision(4))} GeV`;

/** The trigger menu, selection and observables of a configuration in words (for manifests and the page). */
export function describeSelection(c: PipelineConfig): string {
  const a = c.analysis, s = a.selection;
  const items = c.trigger.menu.filter((m) => m.enabled !== false).map((m) => `${m.key} ≥ ${GEV(m.l1Threshold)}${m.prescale > 1 ? ` (prescale ${m.prescale})` : ''}`);
  const trig = items.length ? `${items.join(', ')}${c.trigger.apply ? ': only kept events are analysed' : ': decisions recorded, all events analysed'}` : 'no trigger';
  const iso = s.isolationMax < 50 ? `, track isolation < ${s.isolationMax}` : '';
  const main = a.observables[0]!;
  const objs = [
    `leptons pT > ${GEV(s.leptonPtMin)}`, `photons pT > ${GEV(s.photonPtMin)}${s.ptOverM ? ' with pT/m > 0.35 and 0.25' : ''}`,
    `jets pT > ${GEV(s.jetPtMin)}, |η| < ${s.jetEtaMax}`,
  ].join('; ');
  return `Trigger: ${trig}. Objects: ${objs}; leptons and photons |η| < ${s.etaMax}${iso}. Main observable: ${main}${a.window ? `, signal window ${a.window[0]}–${a.window[1]}` : ''}.`;
}
