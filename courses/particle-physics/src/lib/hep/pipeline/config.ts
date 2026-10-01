/**
 * The configuration of the whole pipeline: one plain, JSON-serialisable object with a section per stage.
 *
 *   machine         mode, √s, luminosity (or the beam parameters it comes from), simulated pile-up
 *   generator       a list of samples (a hep/gen process each, with role, share and optional generator-level window), K-factor
 *   detector        a preset of hep/detector and a few knobs (field, resolutions, dead channels), or a full DetectorConfig
 *   reco            options of hep/reco (`Partial<RecoConfig>`)
 *   trigger         a menu (hep/trigger item settings), whether the analysis sees only triggered events, the dead time per accept
 *   analysis        observables, selection, binning, fit model, integrated luminosity the histograms are scaled to
 *
 * `presetConfig(name)` returns a fresh copy of one of the named presets; `mergeConfig(base, patch)` applies a partial
 * configuration (for instance one decoded from a shared URL) on top of a base.
 */
import type { DetectorConfig } from '../detector/index.ts';
import type { RecoConfig } from '../reco/index.ts';
import type { ItemSetting } from '../trigger/index.ts';
import { makeSetting } from '../trigger/index.ts';

export const STAGE_NAMES = ['machine', 'generator', 'detector', 'reconstruction', 'trigger', 'analysis'] as const;
export type StageName = (typeof STAGE_NAMES)[number];
export const STAGE_TITLES: Record<StageName, string> = {
  machine: 'Machine',
  generator: 'Generator',
  detector: 'Detector',
  reconstruction: 'Reconstruction',
  trigger: 'Trigger',
  analysis: 'Analysis',
};

/** Bumped whenever a change to the pipeline changes its numerical output (recorded in the manifests of the precomputed samples). */
export const PIPELINE_VERSION = '1.0.0';

// ── Machine ──────────────────────────────────────────────────────────────────────────────────

export interface MachineSettings {
  mode: 'pp' | 'ee' | 'ppbar';
  /** Centre-of-mass energy in GeV. */
  sqrtS: number;
  /** Instantaneous luminosity in cm⁻² s⁻¹, given directly; if absent it is computed from the beam parameters (`hep/machine` `machineStage`). */
  lumi?: number;
  /** Beam parameters (defaults: the Run-3-like set of `hep/machine`). */
  beam?: { bunchIntensity?: number; nBunches?: number; epsN?: number; betaStar?: number; crossingAngle?: number; sigmaZ?: number };
  /** Mean number of pile-up collisions simulated with each hard collision; null means the machine's own μ = L σ_inel / (n_b f_rev). */
  pileupMean: number | null;
  bunchSpacingNs: number;
}

// ── Generator ────────────────────────────────────────────────────────────────────────────────

/** A cut on the hard process at generator level: the invariant mass of the two hardest outgoing particles with |PDG id| = `pdg`. Makes a background sample affordable. */
export interface GenWindow {
  pdg: number;
  lo: number;
  hi: number;
}

export interface SampleSpec {
  /** Short key, unique in the configuration (used in tables and files). */
  name: string;
  label: string;
  /** A process name of `hep/gen` (see `listProcesses()`), or `'pp->ZZ*->4l'`, the toy four-lepton continuum of this module. */
  process: string;
  /** Options of the process factory (`ptMin`, `ptMax`, `mMin`, `mMax`, `mH`, `lo`, `hi`, …). */
  options?: Record<string, number | string | boolean>;
  /** An extra generator-level window; the sample's cross-section is reduced by the fraction of events that pass it. */
  window?: GenWindow;
  role: 'signal' | 'background';
  /** Events are dealt to samples in a cycle of Σ shares events. */
  share: number;
  /** K-factor of this sample (default 1). The cross-section is the leading-order one times this. */
  kFactor?: number;
}

export interface GeneratorSettings {
  samples: SampleSpec[];
  /** Multiplies every sample's K-factor (the UI's single control). 1 means leading order. */
  kFactor: number;
  shower: boolean;
  hadronise: boolean;
  decay: boolean;
  /** e⁺e⁻ only: initial-state radiation. */
  isr: boolean;
}

// ── Detector ─────────────────────────────────────────────────────────────────────────────────

export interface DetectorSettings {
  /** A key of `hep/detector` `presets`. */
  preset: string;
  /** Solenoid field in tesla (default: the preset's). */
  bField?: number;
  /** Multiplies the position resolutions of every tracker layer (default 1). */
  trackerResolution?: number;
  /** Stochastic terms (√GeV) of the calorimeters (default: the preset's). */
  ecalStochastic?: number;
  hcalStochastic?: number;
  deadFraction?: number;
  noiseHitsPerLayer?: number;
  /** A complete configuration, used instead of the preset when present. */
  custom?: DetectorConfig;
}

// ── Trigger ──────────────────────────────────────────────────────────────────────────────────

export interface TriggerSettings {
  /** Menu items from the catalogue of `hep/trigger` (key, L1 threshold, HLT threshold, prescale, enabled). */
  menu: ItemSetting[];
  /** If true the analysis sees only events the trigger kept. */
  apply: boolean;
  /** Dead time after each Level-1 accept, in nanoseconds. */
  deadTimeNs: number;
}

// ── Analysis ─────────────────────────────────────────────────────────────────────────────────

export interface Selection {
  /** Minimum pT (GeV) of the muons and electrons used. */
  leptonPtMin: number;
  photonPtMin: number;
  jetPtMin: number;
  /** |η| limit for leptons and photons; jets use `jetEtaMax`. */
  etaMax: number;
  jetEtaMax: number;
  /** Maximum relative track isolation (100 or more: no cut). */
  isolationMax: number;
  /** Diphoton selection: pT/m above 0.35 for the leading and 0.25 for the second photon. */
  ptOverM: boolean;
  /** Jets with a b-tag score above this count as b-tagged. */
  btagMin: number;
}

export interface Binning {
  bins: number;
  lo: number;
  hi: number;
}

export interface FitSettings {
  /** A name of `hep/analysis` `namedModel`: signal shape `gauss`, `cb`, `bw` or `bwrel`, then `+`, then a background `exp`, `flat`, `chebN` or `bernN`. */
  model: string;
  /** Fit range in the main observable; null uses the whole histogram. */
  range: [number, number] | null;
}

export interface AnalysisSettings {
  /** Names of observables (see `OBSERVABLES`); the first is the main one: it decides which events count as selected and is the one fitted. */
  observables: string[];
  /** Overrides of the default binning, by observable. */
  binning: Record<string, Binning>;
  selection: Selection;
  /** The signal region of the main observable, for the event counts and the expected significance; null for none. */
  window: [number, number] | null;
  fit: FitSettings | null;
  /** The integrated luminosity (fb⁻¹) the histograms are scaled to; null shows simulated events with no scaling (only meaningful for one sample). */
  lumiFb: number | null;
  /** Show Poisson-fluctuated pseudo-data (fixed uniform numbers per bin, so the picture does not flicker as it fills) on top of the expectation. */
  pseudoData: boolean;
}

// ── The whole configuration ──────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** The preset this configuration started from (a label). */
  name: string;
  machine: MachineSettings;
  generator: GeneratorSettings;
  detector: DetectorSettings;
  reco: Partial<RecoConfig>;
  trigger: TriggerSettings;
  analysis: AnalysisSettings;
}

export type PresetName = 'zmumu' | 'higgs-gamgam' | 'higgs-4l' | 'ttbar' | 'dijet' | 'minbias' | 'ee-zpole';
export const PRESET_NAMES: PresetName[] = ['zmumu', 'higgs-gamgam', 'higgs-4l', 'ttbar', 'dijet', 'minbias', 'ee-zpole'];

export interface PresetInfo {
  name: PresetName;
  title: string;
  summary: string;
}
export const PRESET_INFO: Record<PresetName, PresetInfo> = {
  zmumu: { name: 'zmumu', title: 'pp → Z → μμ', summary: 'Drell–Yan Z production with a muon pair: the dimuon mass and a fit of the Z peak.' },
  'higgs-gamgam': { name: 'higgs-gamgam', title: 'H → γγ', summary: 'A Higgs boson decaying to two photons, over the irreducible diphoton background (mass window at generator level), scaled to a stated luminosity.' },
  'higgs-4l': { name: 'higgs-4l', title: 'H → ZZ* → 4ℓ', summary: 'A Higgs boson decaying to four leptons, over a toy ZZ* continuum, scaled to a stated luminosity.' },
  ttbar: { name: 'ttbar', title: 'tt̄ → ℓ + jets', summary: 'Top-quark pairs with one leptonic W: jets, b-tags, missing energy and HT.' },
  dijet: { name: 'dijet', title: 'QCD dijets', summary: 'Hard QCD scattering in four pT slices, each with its own weight: the dijet mass spectrum over several decades.' },
  minbias: { name: 'minbias', title: 'Minimum bias', summary: 'Soft inelastic collisions, as in pile-up: charged-particle multiplicity and transverse-energy sum.' },
  'ee-zpole': { name: 'ee-zpole', title: 'e⁺e⁻ → Z → μμ', summary: 'A lepton collider on the Z pole, with initial-state radiation: the radiative return and the muon angular distribution.' },
};

const DEFAULT_SELECTION: Selection = { leptonPtMin: 10, photonPtMin: 20, jetPtMin: 30, etaMax: 2.4, jetEtaMax: 2.5, isolationMax: 0.3, ptOverM: false, btagMin: 0.5 };

function base(name: string): PipelineConfig {
  return {
    name,
    machine: { mode: 'pp', sqrtS: 13600, pileupMean: 0, bunchSpacingNs: 25 },
    generator: { samples: [], kFactor: 1, shower: true, hadronise: true, decay: true, isr: false },
    detector: { preset: 'onion' },
    reco: {},
    trigger: { menu: [], apply: true, deadTimeNs: 100 },
    analysis: { observables: [], binning: {}, selection: { ...DEFAULT_SELECTION }, window: null, fit: null, lumiFb: null, pseudoData: false },
  };
}

/** A fresh copy of a named preset's configuration. */
export function presetConfig(name: PresetName | string): PipelineConfig {
  const c = base(name);
  switch (name) {
    case 'zmumu':
      c.machine.pileupMean = 0;
      c.generator.samples = [{ name: 'zmumu', label: 'Z → μμ', process: 'pp->Z->mumu', role: 'signal', share: 1 }];
      c.trigger.menu = [makeSetting('SingleMu', 20), makeSetting('DoubleMu', 8)];
      c.analysis.observables = ['mll', 'ptLead', 'nTracks'];
      c.analysis.selection = { ...DEFAULT_SELECTION, leptonPtMin: 15 };
      c.analysis.window = [81, 101];
      c.analysis.fit = { model: 'bw+exp', range: [70, 110] };
      break;
    case 'higgs-gamgam':
      c.machine.pileupMean = 10;
      c.generator.samples = [
        { name: 'hgg', label: 'H → γγ (gg → H)', process: 'pp->H->gammagamma', role: 'signal', share: 1 },
        { name: 'gg', label: 'γγ continuum', process: 'pp->gammagamma', options: { ptMin: 25 }, window: { pdg: 22, lo: 100, hi: 160 }, role: 'background', share: 3 },
      ];
      c.trigger.menu = [makeSetting('DoubleEG', 15)];
      c.analysis.observables = ['mgg', 'ptLead', 'nVertices'];
      c.analysis.binning = { mgg: { bins: 55, lo: 105, hi: 160 } };
      c.analysis.selection = { ...DEFAULT_SELECTION, photonPtMin: 25, ptOverM: true, isolationMax: 0.3 };
      c.analysis.window = [120, 130];
      c.analysis.fit = { model: 'gauss+exp', range: [105, 160] };
      c.analysis.lumiFb = 100;
      c.analysis.pseudoData = true;
      break;
    case 'higgs-4l':
      c.machine.pileupMean = 10;
      c.generator.samples = [
        { name: 'h4l', label: 'H → ZZ* → 4ℓ', process: 'pp->H->ZZ->4l', role: 'signal', share: 1 },
        { name: 'zz', label: 'ZZ* → 4ℓ (toy continuum)', process: 'pp->ZZ*->4l', options: { lo: 100, hi: 160 }, role: 'background', share: 1 },
      ];
      c.trigger.menu = [makeSetting('SingleMu', 20), makeSetting('DoubleMu', 8), makeSetting('SingleEG', 25), makeSetting('DoubleEG', 15)];
      c.analysis.observables = ['m4l', 'ptLead', 'nVertices'];
      c.analysis.binning = { m4l: { bins: 30, lo: 100, hi: 160 } };
      c.analysis.selection = { ...DEFAULT_SELECTION, leptonPtMin: 5, isolationMax: 0.5 };
      c.analysis.window = [120, 130];
      c.analysis.fit = { model: 'gauss+exp', range: [100, 160] };
      c.analysis.lumiFb = 100;
      c.analysis.pseudoData = true;
      break;
    case 'ttbar':
      c.machine.pileupMean = 10;
      c.generator.samples = [{ name: 'ttbar', label: 'tt̄ → ℓ + jets', process: 'pp->ttbar->leptonjets', role: 'signal', share: 1 }];
      c.trigger.menu = [makeSetting('SingleMu', 24), makeSetting('SingleEG', 28), makeSetting('SingleJet', 200)];
      c.analysis.observables = ['ht', 'njets', 'nbtag', 'met'];
      c.analysis.selection = { ...DEFAULT_SELECTION, leptonPtMin: 25 };
      c.analysis.lumiFb = 10;
      break;
    case 'dijet': {
      c.machine.pileupMean = 5;
      const slice = (name: string, lo: number, hi?: number) => ({
        name,
        label: hi ? `pT̂ ${lo}–${hi} GeV` : `pT̂ > ${lo} GeV`,
        process: 'pp->jj',
        options: hi ? { ptMin: lo, ptMax: hi } : { ptMin: lo },
        role: 'background' as const,
        share: 1,
      });
      c.generator.samples = [slice('jj30', 30, 80), slice('jj80', 80, 200), slice('jj200', 200, 500), slice('jj500', 500)];
      c.trigger.menu = [makeSetting('SingleJet', 100), makeSetting('HT', 250)];
      c.trigger.apply = false;
      c.analysis.observables = ['mjj', 'ptLead', 'njets'];
      c.analysis.binning = { mjj: { bins: 40, lo: 60, hi: 4000 } };
      c.analysis.lumiFb = 0.001;
      break;
    }
    case 'minbias':
      c.machine.pileupMean = 0;
      c.generator.samples = [{ name: 'minbias', label: 'minimum bias', process: 'minbias', role: 'background', share: 1 }];
      c.generator.shower = false;
      c.trigger.menu = [makeSetting('SingleJet', 60)];
      c.trigger.apply = false;
      c.analysis.observables = ['nTracks', 'sumEt', 'ptLead'];
      break;
    case 'ee-zpole':
      c.machine = { mode: 'ee', sqrtS: 91.1876, lumi: 2e31, pileupMean: 0, bunchSpacingNs: 25 };
      c.generator.samples = [{ name: 'eemumu', label: 'e⁺e⁻ → μ⁺μ⁻', process: 'ee->mumu', role: 'signal', share: 1 }];
      c.generator.isr = true;
      c.trigger.menu = [makeSetting('SingleMu', 5)];
      c.trigger.apply = false;
      c.analysis.observables = ['mll', 'cosThetaMu', 'nTracks'];
      c.analysis.binning = { mll: { bins: 50, lo: 20, hi: 110 } };
      c.analysis.selection = { ...DEFAULT_SELECTION, leptonPtMin: 5, isolationMax: 100 };
      c.analysis.window = [85, 97];
      break;
    default:
      throw new Error(`unknown preset "${name}"; available: ${PRESET_NAMES.join(', ')}`);
  }
  return c;
}

/** True if `name` is one of the presets. */
export const isPreset = (name: string): name is PresetName => (PRESET_NAMES as string[]).includes(name);

// ── Merging and keys ─────────────────────────────────────────────────────────────────────────

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Deep merge of plain objects; arrays and scalars in `patch` replace those in `base`. Neither argument is modified. */
export function deepMerge<T>(baseValue: T, patch: unknown): T {
  if (patch === undefined) return structuredCloneJson(baseValue);
  if (isObj(baseValue) && isObj(patch)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(baseValue)) out[k] = deepMerge((baseValue as Record<string, unknown>)[k], patch[k]);
    for (const k of Object.keys(patch)) if (!(k in out)) out[k] = structuredCloneJson(patch[k]);
    return out as T;
  }
  return structuredCloneJson(patch) as T;
}
function structuredCloneJson<T>(x: T): T {
  return x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T);
}

/** A configuration from a (possibly partial, possibly untrusted) object, on top of the preset `patch.name` (or `zmumu`). Unknown presets fall back to `zmumu`. */
export function mergeConfig(patch: unknown, fallback: PresetName = 'zmumu'): PipelineConfig {
  const requested = isObj(patch) && typeof patch.name === 'string' ? patch.name : fallback;
  const baseCfg = presetConfig(isPreset(requested) ? requested : fallback);
  const merged = deepMerge(baseCfg, patch);
  if (!isPreset(requested)) merged.name = requested;
  // a patch that lists samples or a menu replaces the preset's (deepMerge replaces arrays); make sure the shape is sane
  if (!Array.isArray(merged.generator.samples) || merged.generator.samples.length === 0) merged.generator.samples = baseCfg.generator.samples;
  merged.generator.samples = merged.generator.samples.filter((s) => s && typeof s.process === 'string');
  if (merged.generator.samples.length === 0) merged.generator.samples = baseCfg.generator.samples;
  if (!Array.isArray(merged.analysis.observables) || merged.analysis.observables.length === 0) merged.analysis.observables = baseCfg.analysis.observables;
  return merged;
}

/** A stable string key of the parts of a configuration that determine a run's physics (used to cache resolved objects). */
export function configKey(c: unknown): string {
  return JSON.stringify(c);
}
