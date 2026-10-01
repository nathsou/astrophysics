# `hep/pipeline`: the whole mini-LHC as one function call

Machine → generator → detector → reconstruction → trigger → analysis, from one configuration object, with every stage's hooks live, so the reader's code
runs inside. Pure TypeScript (no DOM, no Node API, no `Math.random`); runs in the page, in a worker and under Vitest. Import as `hep/pipeline`
(or `$lib/hep/pipeline`). The Control Room page and the `::pipeline` widget (`src/lib/control/`) are built on it.

```ts
import { presetConfig, runBatch, runEvent, summarise, sampleXsec, mergeBatch } from 'hep/pipeline';

const cfg = presetConfig('zmumu');                           // a fresh copy of a preset; edit any field
const res = runBatch(cfg, 500, 1);                           // events 0…499 of the run with seed 1 → counters, histograms, trigger sums
const sum = summarise(res, cfg, cfg.generator.samples.map((s) => sampleXsec(s, cfg.machine.sqrtS)));
sum.fit!.params['sig.mean'];                                 // the fitted Z mass
const one = runEvent(cfg, 17, 1);                            // one complete FullEvent (truth, detector, reco), the trigger decision, observables
```

## What one event goes through (`run.ts`)

| Stage | What runs | Where the reader's code can enter |
|---|---|---|
| machine | `machineStage` gives luminosity, μ and the crossing rate; the number of pile-up collisions of an event is Poisson(μ) | `machine.luminosity` |
| generator | `hep/gen` `generate` of the event's sample: hard process, shower, hadronisation, decays, pile-up overlay | `gen.unweight`, `gen.dsigmaEeMuMu` |
| detector | `hep/detector` `simulate` | `detector.multipleScatteringAngle` |
| reconstruction | `hep/reco` `reconstruct`, with the truth record (so objects carry truth links) | `reco.circleFit`, `reco.houghTransform`, `reco.kalmanUpdate`, `reco.impactParameter`, `reco.missingPt`, `reco.bTag`, `reco.antiKt` |
| trigger | `hep/trigger` `evaluateMenu`: L1 from the detector's towers and muon hits, then the HLT; prescales drawn with the event's own stream | `trigger.l1Decision` |
| analysis | `observables.ts`: masses through `hook('kinematics.pairMass', pairMass)`, selection, histograms; the significance in the signal window through `analysis.significance` | `kinematics.pairMass`, `analysis.significance` |

A stage that throws (a faulty override, say) loses that event, which is counted (`failed`) and recorded in `errors` with the stage and the message; the run goes on.

**Randomness.** Event `i` of the run with seed `s` has its own generator, `eventRng(s, i)`, built from the two integers alone, and inside the event each stage takes its own stream
from it in a fixed order (`stageStreams`). So an event does not depend on the events around it, on how a run is split into batches, or on how many numbers a stage drew, and the
histograms and counters of a run are the same for any number of workers (tested: `pipeline.test.ts`, `control/pool.test.ts`). Floating-point sums (trigger probabilities, Σx, Σx²)
agree to rounding; every integer count agrees exactly. Wall-clock timings are the one non-deterministic part (`BatchResult.time`).

## API

```ts
presetConfig(name): PipelineConfig          // 'zmumu' | 'higgs-gamgam' | 'higgs-4l' | 'ttbar' | 'dijet' | 'minbias' | 'ee-zpole'
mergeConfig(patch, fallback?): PipelineConfig    // a partial configuration on top of its preset (used for shared links)
diffConfig(base, cur): partial config | undefined
prepare(config): Prepared                   // resolves processes, detector, menu, edges (cheap; no grids are trained)
runEvent(config, index, seed): EventOutput  // { event: FullEvent, decision, values, selected, truthMain, eff, time, failed? }
processEvent(prepared, index, seed, xsec?)  // the same with a prepared configuration
runBatch(config, n, seed, { start, keep, xsec, onEvent, shouldStop, prepared }): BatchResult
mergeBatch(a, b): BatchResult               // adds b into a; counts add, so any split of a run adds up to the same result
summarise(result, config, xsec, { seed, fit }): Summary
sampleXsec(sample, sqrtS, globalK?)         // pb: leading order × window fraction × K-factors
windowFraction(sample, sqrtS)               // the fraction of hard events inside the generator window, with its error
rateReportFrom(result, config, xsec, lumi, deadTimeS): RateReport   // hep/trigger's RateReport from the accumulated sums
```

`FullEvent` (from `hep/event`) in `EventOutput.event`: `truth`, `detector`, `reco`, `trigger` (the items that fired) and `weight`, which `runEvent` sets to the sample's cross-section in pb times
its K-factors (divide by the number of events generated for the sample and multiply by the luminosity in pb⁻¹ to get the expected events one simulated event stands for; `summarise` does that).

`BatchResult` holds, per sample: events generated, failed, multiplicities (pile-up, particles, hits, cells, tracks, objects by kind), the trigger sums `TriggerAcc` (acceptance
probabilities with squares, per-item, overlaps, unique counts, bandwidth, integer pass counts), the selected and signal-window counts, one histogram per observable (unit weights),
the main observable at truth level, (reco − truth)/truth of the main observable, truth-matching counts (muon, electron, photon: truth in acceptance, matched, reconstructed, fake) and
track-finding counts; plus stage timings, errors and (if asked for) a few complete kept events for display.

`summarise` turns it into what a page shows: histograms scaled to σ K L / N per sample (`weight`), the stack to draw, pseudo-data, the fit, the signal-window significance (Asimov,
through the hook `analysis.significance`), the stage counters and speeds (events/s on one core), trigger rates, truth-vs-reco efficiencies and fake rates, the machine's numbers.

## Configuration schema (`config.ts`)

```ts
interface PipelineConfig {
  name: string;                         // the preset it started from
  machine:   { mode: 'pp'|'ee'|'ppbar'; sqrtS: number /*GeV*/; lumi?: number /*cm⁻²s⁻¹, else from beam*/;
               beam?: { bunchIntensity, nBunches, epsN, betaStar, crossingAngle, sigmaZ };
               pileupMean: number | null /*null: the machine's μ*/; bunchSpacingNs: number };
  generator: { samples: SampleSpec[]; kFactor: number; shower; hadronise; decay; isr: boolean };
  detector:  { preset: string; bField?; trackerResolution?; ecalStochastic?; hcalStochastic?; deadFraction?; noiseHitsPerLayer?; custom?: DetectorConfig };
  reco:      Partial<RecoConfig>;       // hep/reco options
  trigger:   { menu: ItemSetting[]; apply: boolean; deadTimeNs: number };
  analysis:  { observables: string[]; binning: Record<string, {bins, lo, hi}>; selection: Selection;
               window: [lo, hi] | null; fit: { model: string; range: [lo, hi] | null } | null;
               lumiFb: number | null; pseudoData: boolean };
}
interface SampleSpec { name; label; process: string; options?: {…}; window?: { pdg; lo; hi }; role: 'signal'|'background'; share: number; kFactor?: number }
```

`process` is a name of `hep/gen` (`listProcesses()`), or `pp->ZZ*->4l`, the toy four-lepton continuum of this module (`zz.ts`). `options` goes to the factory of the process family:
`ptMin`, `ptMax` (dijets, γγ), `mMin`, `mMax` (Drell–Yan, W), `mH` (Higgs), `lo`, `hi` (ZZ*). `window` rejects hard events whose two hardest outgoing particles with |PDG id| = `pdg` have a mass outside
`[lo, hi)`, before the shower: cheap, and it makes a background sample affordable (for the diphoton background of H → γγ about one hard event in six is inside 100–160 GeV, and the others would be simulated
and thrown away). The sample's cross-section is σ_LO × (fraction inside), the fraction measured with 20,000 hard events and a fixed seed, so the normalisation does not depend on call order.
Events are dealt to samples in a cycle of Σ `share` events (a function of the event index alone).

`physicsKey(config)` is the part of a configuration that decides the events and histograms. The K-factor, the luminosity, the signal window, the fit, pseudo-data and the dead time are applied when a
result is read, so changing them needs no new run (the Control Room uses this to decide when to discard a run).

### The K-factor and the normalisation

Every cross-section is **leading order**. `generator.kFactor` (and `SampleSpec.kFactor`) multiply it; the default is 1, and `summarise` reports `isLO` so that a page can say that the normalisation is leading
order, and the Control Room and the widget do. For orientation (from the `hep/gen` README, "about right for leading order"): the higher-order corrections are 20–25 % for W and Z, a factor 1.9 for tt̄ and about 3.4 for gg → H.

## Presets

| Preset | Samples | Observables (main first) | Trigger | Pile-up | Scaled to |
|---|---|---|---|---|---|
| `zmumu` | pp → Z → μμ (60–120 GeV) | m(ℓℓ), pT, tracks | SingleMu 20, DoubleMu 8 | 0 | simulated events; fit `bw+exp` |
| `higgs-gamgam` | H → γγ (signal); γγ continuum with pT > 25 GeV in a generator window of 100–160 GeV (background, share 3) | m(γγ), pT, vertices | DoubleEG 15 | 10 | 100 fb⁻¹; fit `gauss+exp`; pseudo-data; window 120–130 |
| `higgs-4l` | H → ZZ* → 4ℓ; toy ZZ* → 4ℓ continuum, 100–160 GeV | m(4ℓ), pT, vertices | SingleMu 20, DoubleMu 8, SingleEG 25, DoubleEG 15 | 10 | 100 fb⁻¹; fit `gauss+exp`; pseudo-data |
| `ttbar` | tt̄ → ℓ + jets | H_T, jets, b-tags, missing pT | SingleMu 24, SingleEG 28, SingleJet 200 | 5 | 10 fb⁻¹ |
| `dijet` | QCD dijets in four pT̂ slices (30–80, 80–200, 200–500, > 500 GeV) with their own weights | m(jj) (log bins), pT, jets | SingleJet 100, HT 250 (recorded, not applied) | 5 | 1 pb⁻¹ |
| `minbias` | minimum bias, no shower | tracks, ΣE_T, pT | (recorded, not applied) | 0 | simulated events |
| `ee-zpole` | e⁺e⁻ → μ⁺μ⁻ at √s = m_Z with ISR | m(ℓℓ), cos θ(μ⁻), tracks | (recorded, not applied) | – | simulated events; L = 2 × 10³¹ cm⁻² s⁻¹ (illustrative, LEP-like) |

Defaults are for speed: the machine's own pile-up at 2 × 10³⁴ cm⁻² s⁻¹ is about 60 collisions per crossing, which the reconstruction handles at about 30 events/s per core; the presets simulate fewer.

### The toy ZZ* continuum (`zz.ts`)

`hep/gen` has no ZZ background, and a Higgs peak with nothing under it would mislead, so this module has a q q̄ → Z Z* → 4ℓ process (ℓ = e, μ) at leading order: t- and u-channel exchange with the exact
squared amplitude for two massive vector bosons (checked in `zz.test.ts` against an explicit Dirac trace for unequal masses, `dirac.ts`), the G_F-scheme Z couplings, both Z's off shell with the
Breit–Wigner mass distribution of a Z decaying to e⁺e⁻ or μ⁺μ⁻, the factor ½ for identical bosons, parton densities from `hep/gen`. Checks: the narrow-width limit above 2 m_Z agrees with an independent evaluation
using the parton luminosity function of `hep/gen` to 25 %, and the implied total σ(pp → ZZ) is of the order of 10 pb at 13 TeV (leading order, qq̄ only). **Not modelled:** photon exchange and the γ*/Z interference, gg → ZZ, spin
correlations between the decays (each Z decays isotropically), identical-lepton interference. It is a background *shape and size of the right order*, not a prediction.

## Observables (`observables.ts`)

`mll` (leading opposite-sign same-flavour pair, μμ then ee), `mgg` (two photons, optional pT/m > 0.35, 0.25), `m4l` (two OS-SF pairs: Z₁ nearest m_Z in 40–120 GeV, Z₂ in 12–120 GeV, pT > 20 and 10 GeV for the two hardest),
`mjj`, `ht`, `njets`, `nbtag`, `met`, `nTracks`, `nVertices`, `sumEt`, `ptLead`, `cosThetaMu`. Every mass goes through the hook `kinematics.pairMass`. `mll`, `mgg`, `m4l` and `cosThetaMu` also exist at **truth level**, from the prompt
final-state particles (no hadron among the ancestors) in the same acceptance; the pipeline histograms them and the (reco − truth)/truth resolution of the main observable. The efficiency of reconstructed muons, electrons and photons is the fraction of prompt truth objects
in the detector's acceptance (tracker η limit minus a margin; for muons the second-best muon station's reach, about |η| < 1.1 for the course detector) with a reconstructed object of the same kind within ΔR < 0.1; the fake rate is the fraction of
reconstructed objects with no truth particle of their kind within ΔR < 0.1.

**A known offset.** In the `higgs-gamgam` sample the reconstructed diphoton mass is on average 0.58 % above the truth-level mass ((reco − truth)/truth, 5,600 events, rms 1.6 %), so the fitted peak sits at 125.8 GeV for a generated 125.25: the photon energy scale of `hep/reco` is about 0.6 % high (its calibration is done with single photons and charged pions). The Control Room shows the offset in the resolution readout; it is not corrected here.

## Trigger rates

The rates of the events **in the run**, σ L ε: per item (after prescales, and before), in total with overlaps counted once, the dead-time live fraction 1/(1 + Rτ), the bandwidth, with binomial errors. `rateReportFrom` produces the same numbers as
`hep/trigger` `estimateRates` on the same events (asserted to 12 digits in `pipeline.test.ts`), without keeping the events. They are not the rates of everything a detector sees: the QCD and minimum-bias events that dominate a real trigger are not in a Z or Higgs run.

## Precomputed samples (`samples.ts`, `scripts/data/samples.ts`)

`node --experimental-strip-types scripts/data/samples.ts [preset …] [--threads 4] [--scale 1]` runs the presets with the reference code and fixed seeds and writes `static/data/samples/<preset>.json` (a `SamplePayload`: the manifest,
the configuration, the leading-order cross-sections and the accumulated result, counts only) and `index.json` (file, bytes, SHA-256, events, seed, date, code hash). The manifest records the seed, the events per sample, `PIPELINE_VERSION`, the SHA-256 of the source of `src/lib/hep` that ran,
the selection in words, the normalisation, the approximations, and the script and date. The page shows a payload only if `payloadMatches(payload, config)` (same version, same `physicsKey`). The total is well under the 6 MB budget (tens of kilobytes).

## Loader contract for real data (`real.ts`)

Chapter 29 runs the reader's analysis on recorded LHC events. Real data are **not** shipped with this module; another author may add them. The loader enables the real-data mode only if the manifest exists (an HTTP 404 means "no real data", and nothing is faked).

**Where:** `static/data/real/<preset>.manifest.json` and the file it names, `static/data/real/<name>.f32` (preset names: `higgs-gamgam`, `higgs-4l`, `zmumu`, …). The page fetches `${base}/data/real/<preset>.manifest.json`; the widget's `data="real"` and the Control Room's "real data" switch use it.

**File format (`objects-f32-v1`):** a flat list of reconstructed objects, little-endian Float32, stride 8, in event order (the same objects the simulated analysis reads):

| column | meaning |
|---|---|
| `event` | 0-based event number, non-decreasing |
| `kind` | 0 muon, 1 electron, 2 photon, 3 jet, 4 missing pT (`pt` = \|MET\|, `phi` its direction; `eta`, `E` ignored) |
| `pt` | GeV |
| `eta` | pseudorapidity |
| `phi` | radians |
| `E` | GeV (if ≤ 0 a massless object is assumed) |
| `charge` | −1, +1, or 0 for photons, jets and MET |
| `iso` | relative track isolation (scalar pT sum in a cone over the object's pT), or −1 if the source has none |

**Manifest (JSON), all required unless marked:** `name`, `title` (a legend line, e.g. "ATLAS Open Data, 13 TeV, 10 fb⁻¹"), `file`, `format` (`"objects-f32-v1"`), `events`, `rows`, `sha256`, `sqrtS` (GeV), `luminosityFb` (number or null), `observables` (names from `OBSERVABLES` this file supports, e.g.
`["mgg"]`), `selection` (the selection applied when the file was made: trigger, object definitions, pre-selection), `source` (`{ title, record, experiment?, dataset? }`), `licence` (e.g. "CC0 1.0"), `prepared` (ISO date); optional `script`, `software`.
Units are GeV throughout. A dataset without a licence that allows redistribution is not shipped (docs/PLAN.md, *Real data*); the file counts against the shared 40 MB budget and a 5 MB limit per dataset.

`parseRealManifest`, `parseRealObjects(buffer)` (→ `RecoEvent`s with only `objects` and `met`), `loadRealData(base, name, fetch?)` (null on 404 or an invalid manifest), `realManifestExists`, and `histogramReal(events, config)` (the main observable with the configuration's selection and binning) are in `real.ts`.
Observables that need tracks or vertices (`nTracks`, `nVertices`) are not available for real data. Every simulated histogram on the page is tagged "simulation" and real data are labelled with the manifest's `title`.

## Performance

Asserted in `pipeline.test.ts` at half the plan's target where the plan sets one for the stage (histogram filling: 10⁶ fills in under 200 ms, the plan asking 100 ms for the analysis library), and with a conservative floor for the whole chain
(Z → μμ without pile-up: at least 40 events/s per core, with the trigger, analysis and accumulation together under 25 % of the time; the stage timings account for the wall-clock time). The plan's per-stage targets (generation at 5,000 events/s, simulation and
reconstruction at 2,000 events/s without pile-up and 50 events/s with 50 pile-up collisions) are the library modules' targets and are tested in their own directories; the library agents measured the reconstruction at about 1,800 events/s without pile-up and about 30/s with 50
pile-up collisions, and the full generator chain at about 380 pp → Z → μμ events/s. The pipeline adds the trigger and the analysis, which together cost 2–10 % of an event.

Measured as CPU time per event in one Node process (`process.cpuUsage()`, so it does not depend on how busy the machine is, but the development machine was shared with a dozen other jobs, so an idle laptop will be faster), warm JIT, after 6 warm-up events:

| Preset (one core) | events/s | generator / detector / reconstruction / trigger / analysis (share of the time) |
|---|---|---|
| zmumu, no pile-up | 142 (257 on a quiet moment) | 22 / 30 / 43 / 3 / 1 % |
| zmumu, μ = 20 | 15 | 13 / 31 / 52 / 4 / 0 % |
| higgs-gamgam, μ = 10 | 26 | 18 / 33 / 47 / 2 / 1 % |
| higgs-4l, μ = 10 | 33 | 18 / 28 / 51 / 1 / 1 % |
| ttbar, μ = 5 | 18 | 12 / 38 / 47 / 2 / 1 % |
| dijet, μ = 5 | 23 | 18 / 26 / 51 / 3 / 2 % |
| minbias, no pile-up | 395 | 26 / 24 / 47 / 1 / 2 % |
| ee-zpole | 1,400 | 21 / 10 / 58 / 2 / 8 % |

In the browser the Control Room runs on `navigator.hardwareConcurrency − 1` workers (at most 12). Measured in headless Chromium on the same shared machine with 3 workers: Z → μμ at about 130 events/s (1,100 events/s in a quiet minute), H → γγ at 40–60 events/s.
**The Higgs peak:** with the `higgs-gamgam` preset the fit of the pseudo-data finds the peak at about 7σ (yield over its uncertainty; the Asimov significance in the 120–130 GeV window is 5.3σ at leading order, K = 1) about 10 seconds after pressing Start (165 events) in a freshly loaded page (served by the Vite dev server), and stable from about 20 seconds (770 events) onwards, on a shared machine; the
precomputed sample shows it at once. The target was two minutes.

## Files

`config.ts` configuration, presets, merging · `rand.ts` per-event streams · `processes.ts` processes, windows, cross-sections · `zz.ts` the toy ZZ* process, `dirac.ts` its test calculator · `observables.ts` · `accum.ts` mergeable results ·
`machine.ts`, `detector.ts` (resolution of those two parts without loading the generator) · `run.ts` · `summary.ts` · `samples.ts` precomputed payloads · `real.ts` real-data loader · `*.test.ts`.
The page, the pool of workers, the worker host and the widget are in `src/lib/control/`.
