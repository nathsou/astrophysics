---
number: F
title: The hep library
summary: The reference for the course's physics library, module by module, with units, conventions and signatures; every hook that the exercises feed, and how the "use my code" switch works.
duration: Look things up
prerequisites: []
---

Everything that moves in this course is computed by `hep`, a TypeScript library written for it. It runs in the browser, in a Web Worker and under the test runner, and it has no dependencies: no DOM, no Svelte, no Node-only features, no `Math.random`. A code exercise imports it as `hep` (everything) or `hep/<module>` (one module):

```ts
import { rng } from 'hep/random';
import { generate } from 'hep/gen';
import { pairMass } from 'hep/kinematics';
import type { P4 } from 'hep';
```

This appendix lists the modules, their conventions and their entry points, and then the **hooks**, the places where your own function can replace the reference one. It is a map, not the full manual: each module has a `README.md` in `src/lib/hep/<module>/` with every function, and the code is short enough to read. [Appendix E](/appendix/the-pipeline/) says what each pipeline stage models and does not model.

## Conventions

- **Units.** Natural units, energies, momenta and masses in GeV. Inside the detector model, lengths are in millimetres, times in nanoseconds, fields in tesla. Cross-sections are in picobarns unless a name says otherwise. The exceptions are named in their modules: `hep/oscillations` uses km, GeV and eV² (so that the constant 1.267 appears as itself), `hep/scattering` uses MeV and fm for alpha particles, `hep/muography` uses g/cm² for thickness. A function whose name ends in `Mm`, `Fm`, `Km`, `Seconds` or `Pb` says what it returns.
- **Four-vectors** are plain objects `{ E, px, py, pz }` (type `P4`), metric (+, −, −, −). z is along the beam, φ is in (−π, π], η = −ln tan(θ/2).
- **Randomness.** Every random number comes from a seeded `Rng` (`rng(seed)`, a small fast generator, sfc32). `rng.fork(label)` gives an independent stream. The same seed gives the same events in a test, a worker and your browser. Nothing in `hep` calls `Math.random`.
- **Particles** are identified by PDG code (Appendix D); negative codes are antiparticles.
- **Truth and reconstruction.** An event exists twice, linked: the truth the generator wrote, and the objects reconstruction found, each with the index of the truth particle it came from.

## The core modules

| Module | What it is | Main entry points |
|---|---|---|
| `hep/units` | Natural units and constants (CODATA 2018, PDG 2024) | `fmToGeV`, `geVToFm`, `widthToLifetime`, `lifetimeToWidth`, `decayLength`, `invGeV2ToPb`, `pbToInvGeV2`, `geVToKg`, `kelvinToGeV`, `formatEnergy`, `formatLength`, `formatTime`; constants `HBARC_GEV_FM`, `HBAR_GEV_S`, `C_M_S`, `HBARC2_GEV2_PB`, `ALPHA`, `ALPHA_S_MZ`, `G_F`, `M_PLANCK_GEV`, `N_A` |
| `hep/random` | Seeded generator and samplers | `rng(seed)`, `uniform`, `normal`, `exponential`, `poisson`, `binomial`, `breitWigner(r, mass, width, lo, hi)`, `choice(r, weights)`, `acceptReject`, `tabulated`, `shuffle` |
| `hep/kinematics` | Four-vectors and kinematics | `fromMass`, `fromPtEtaPhiM`, `add`, `sub`, `scale`, `sum`, `dot`, `mass`, `mass2`, `pairMass`, `invariantMass`, `pt`, `eta`, `phi`, `theta`, `rapidity`, `mT`, `transverseMass`, `deltaPhi`, `deltaR`, `openingAngle`, `boost`, `toRestFrame`, `mandelstamS`, `twoBodyMomentum`, `isotropic`, `twoBodyDecay`, `phaseSpace` (RAMBO) |
| `hep/particles` | The particle table (Appendix D) | `particle(pdg)`, `allParticles()`, `byName`, `hasParticle`, `antiId`, `charge`, `isColoured`, `isLepton`, `isNeutrino`, `isHadron`, `isQuark`, `symbols(ids)`, `quantumNumbers(ids)`. A `Particle` has `mass`, `width`, `lifetime`, `charge3` (3Q), `spin2` (2J), `baryon3` (3B), `lepton`, `strangeness`, `charm`, `bottom`, `top`, `i3x2`, `quarks`, `decays: { br, products }[]` |
| `hep/event` | The event model | types `TruthEvent`, `TruthParticle`, `DetectorEvent`, `Hit`, `CaloCell`, `MuonHit`, `RecoEvent`, `Track`, `Vertex`, `Cluster`, `RecoObject`, `FullEvent`; the columnar `EventTable` (`setColumn`, `setJagged`, `col`, `row`, `select`), in the style of Awkward Array |
| `hep/hooks` | Plug points for your code | `hook(name, reference)`, `setOverride(name, fn)`, `activeOverrides()` (below) |
| `hep/data` | Loaders for the shipped datasets | `loadDimuon(base)`, `parseDimuon`, `dimuonMasses`: the 100,000 CMS muon pairs of Chapter 2 |
| `hep/sm` | Standard-Model inputs | `M_Z`, `GAMMA_Z`, `M_W`, `M_T`, `M_H`, `V_EW`, `SIN2W_EFF`, `alphaEM(Q)` (running), `alphaS(Q)`, `zCouplings`, `zPartialWidth`, `zWidths`, `wTotalWidth`, `topWidth`, `higgsWidths`, `ckmMatrix`, `rRatio`, `propagator`, `breitWignerPdf` |

The kinematics functions on four-vectors are the ones you write in Chapters 2 and 3 (`pairMass`, `twoBodyDecay`) and later (`transverseMass`). The conventions of `Rng` and of the table's integer encoding of charge, spin and baryon number are the only things in the core that surprise people.

## The pipeline stages

The six stages of the mini-LHC are modules with a reference implementation each. The stage modules compose: the output of one is the input of the next, in the event model above.

| Stage | Module | What it does | Entry points |
|---|---|---|---|
| 1. Machine | `hep/machine` | Beam optics, longitudinal dynamics, synchrotron radiation, luminosity and pile-up | `oneTurnMatrix`, `periodicTwiss`, `trackThroughLattice`, `tuneFromTurns`, `trackLongitudinal`, `energyLossPerTurn`, `luminosity`, `pileup`, `machineStage(config)`; presets `LHC`, `LEP`, `LHC_DESIGN`, `RUN3_LIKE` |
| 2. Generator | `hep/gen` (with `hep/shower`, `hep/hadronise`, `hep/decay`) | A named process at leading order, the parton shower, the Lund string toy, particle decays, pile-up overlay | `generate(process, { sqrtS, pileup, … }, rng)`, `crossSection`, `getProcess`, `listProcesses`, `drellYan`, `zPrime`, `higgsGGF`, `ttbar`, `eeToFermions`; `shower`, `hadronise`, `decayAll`, `Vegas`, `xf`, `pdf` |
| 3. Detector | `hep/detector` | The fast simulation *Onion*: tracker, calorimeters, muon system | `simulate(truth, cfg, rng, { pileup })`, `presets`, `customise`, `helix`, `bethe`, `landau`, `multipleScatteringAngle`, `heitlerShower`, `caloResponse`, `materials` |
| 4. Reconstruction | `hep/reco` | Tracks, vertices, clusters, particle flow, leptons, photons, jets, missing pT, b-tags | `reconstruct(det, cfg, rc?, truth?)`, `circleFit`, `houghTransform`, `kalmanTrackFit`, `findTracks`, `fitVertex`, `antiKt`, `bTagScore`, `missingPt`, `truthMatch`, `efficiency`, `fakeRate` |
| 5. Trigger | `hep/trigger` | Level 1 and high-level trigger, menus, prescales, rates | `l1Decision`, `l1InputFromReco`, `evaluateMenu`, `estimateRates`, `physicsLost`, `turnOn`, `generateToySamples`, `scoreReport` |
| 6. Analysis | `hep/analysis` | Histograms, selections, fits, significance, limits | `Hist1D`, `Hist2D`, `applyCuts`, `minimize`, `fitBinned`, `fitUnbinned`, `significance`, `discovery`, `cls`, `upperLimit`, `clsModel`, `bumpHunt`, `lookElsewhere` |
| All six | `hep/pipeline` | The whole chain as a function call | `presetConfig(name)`, `runBatch(cfg, n, seed)`, `runEvent`, `summarise`, `sampleXsec`; presets `zmumu`, `higgs-gamgam`, `higgs-4l`, `ttbar`, `dijet`, `minbias`, `ee-zpole` |

Highlights of each stage follow, and the full lists are in the module READMEs.

**`hep/gen`.** Processes are named. `listProcesses()` returns them: `ee->mumu`, `ee->tautau`, `ee->qq`, `ee->ee`, `pp->Z->mumu`, `pp->W->munu`, `pp->jj`, `pp->gammagamma`, `pp->H->gammagamma`, `pp->H->ZZ->4l`, `pp->ttbar`, `pp->Zprime->mumu`, `minbias` and their variants. The centre-of-mass energy goes in the configuration, not the name. Cross-sections are in pb, at leading order. The parton distributions are a documented teaching parametrisation, not a fit. `crossSection(process, sqrtS, nEvents)` returns a Monte Carlo value with its error and, where there is one, the analytic value for comparison.

**`hep/detector`.** Geometry is cylindrical, the field uniform. A hit has a `layer`, a smeared position and an energy deposit; `truth` is the index of the truth particle (the ancestor, for secondaries), −1 for noise. The resolution of the calorimeters emerges from the stochastic, constant and noise parameters of the configuration. `presets` are `minimal`, `onion`, `cms-like`, `atlas-like`, `sandbox`.

**`hep/reco`.** Helix parameters are the five perigee parameters; a positive particle turns clockwise seen from +z. `reconstruct` returns tracks, vertices (primary, pile-up, secondary), clusters, objects and the missing transverse momentum, each linked to truth when the truth record is supplied.

**`hep/analysis`.** Histogram bins keep weights and the sum of squared weights. Binned fits use the exact integral of the model over each bin and the Baker–Cousins goodness of fit. `significance(s, b)` is the Asimov formula. `cls(nObs, s, b)` is the CLs value of a counting experiment (Chapter 28). `upperLimit(model, data)` gives the observed and expected limits with their bands.

## The supporting modules

| Module | Chapter | What it provides |
|---|---|---|
| `hep/scattering` | 4 | Rutherford scattering, the sampler of the scattering angle (hook `scattering.sampleRutherfordAngle`), a thin-foil experiment, form factors, the Mott cross-section |
| `hep/chamber` | 5, 9, 10, 12 | Particles in cloud and bubble chambers: tracks, ionisation, range, circle fits, ready-made pictures (Anderson's, the Ω⁻) |
| `hep/conservation` | 11 | The ledger and the reaction checker `checkReaction(initial, final)` (hook `conservation.checkReaction`), and `parseReaction` |
| `hep/su3` | 12, 13 | Flavour SU(3): representations, decompositions, the baryon octet and decuplet, the Gell-Mann–Okubo formulae, quark content |
| `hep/diagrams` | 15 | Feynman diagrams as data: processes, vertex rules, validation, enumeration of tree and one-loop diagrams, symmetry factors |
| `hep/fields` | 14, 17, 18, 26 | Coupled-oscillator fields, Yukawa potential, gauge fields on a lattice, a U(1) lattice, the string model, the Higgs potential |
| `hep/topreco` | 25 | Top-pair reconstruction in the lepton + jets channel: the neutrino's longitudinal momentum, jet assignment by χ² (hook `reco.assignTopJets`) |
| `hep/oscillations` | 31 | Two- and three-flavour oscillation probabilities in vacuum and matter, the PMNS matrix, neutrino-mass observables (hook `oscillations.probability`) |
| `hep/muography` | 33 | Sea-level muon flux, energy loss in rock, counts behind a structure (no hook) |

### `hep/oscillations`

Units: baseline km, energy GeV, Δm² in eV², angles in radians. `OSC_PHASE_CONSTANT` = 1.26693…, derived from ħc, so that the phase of an oscillation is `OSC_PHASE_CONSTANT * dm2 * L / E`. `probability(theta, dm2, L, E)` is the two-flavour formula (the hook). For three flavours, `defaultParams()` gives approximate global-fit values, `probabilities3(params, L, E, { matter, anti })` returns the matrix `P[α][β]` = P(ν_α → ν_β), computed by exponentiating the Hamiltonian, exactly, in layers of constant density. `pmns`, `jarlskog`, `matterPotential`, `solarSurvival`, `neutrinoMasses`, `betaDecayMass` and `majoranaMass` complete the module.

### `hep/muography`

Units: GeV, g/cm², cm⁻² s⁻¹ sr⁻¹, radians from the vertical. `differentialFlux` and `integralFlux` are Gaisser's sea-level parametrisation (valid above about 100 GeV/cosθ); `STANDARD_ROCK`, `range`, `minimumEnergy` and `energyAfter` are a continuous energy-loss model (a = 2 MeV cm²/g, b = 4 × 10⁻⁶ cm²/g, of the right size for rock and not a fit); `transmittedIntensity(X, θ)` and `expectedCount` give the rate behind rock; `slantThickness(pyramid, detector, θ, density, chamber)` is the geometry of Figure 33.3.

## Hooks, and how "use my code" works

A function that an exercise asks you to write is fetched by the library through `hook(name, reference)`. Names are `<stage>.<function>`. If you have installed a version with `setOverride(name, fn)`, `hook` returns yours; otherwise it returns the reference:

```ts
// inside the library
const fit = hook('reco.circleFit', circleFit);
```

The library looks the hook up **at every call**, so installing a version takes effect at once everywhere that function is used: in the figures, in the Control Room's pipeline, in the other stages. A wrong solution can therefore break the figure it feeds, but the library protects itself: the internal code that must stay correct (the fits and the optimiser, the widgets' own checks) calls the reference directly.

How your code gets there:

1. A **code exercise** declares the hook it feeds (`hook: oscillations.probability`). You write a function with the exercise's signature; the hidden tests run in a Web Worker against your code (the reference solution passes them and the starter code does not, which a test of the course checks).
2. When all tests pass, the code is saved in the browser (local storage), keyed by the hook name. Nothing is sent anywhere.
3. A figure or the Control Room, when it loads, evaluates the saved code (TypeScript is transpiled in the browser, and the code can import only `hep` and `hep/<module>`), finds the export whose name is the last part of the hook name (`probability` for `oscillations.probability`) and installs it with `setOverride`. A **use my code** tick box appears on the figures that depend on a hook, and the Control Room has a toggle for each stage.
4. Untick it, and the reference returns.

### Every hook

| Hook | Reference | Signature | Used by | Exercise |
|---|---|---|---|---|
| `kinematics.pairMass` | `pairMass` | `(a: P4, b: P4) => number` | the dimuon map, the HLT, the pipeline's observables | Chapter 2 |
| `kinematics.twoBodyDecay` | `twoBodyDecay` | `(r: Rng, parent: P4, m1: number, m2: number) => [P4, P4]` | the Breit–Wigner figure, the decay lab | Chapter 3 |
| `scattering.sampleRutherfordAngle` | `sampleRutherfordAngle` | `(r: Rng, thetaMin: number) => number` | the Geiger and Marsden experiment | Chapter 4 |
| `reco.circleFit` | `circleFit` | `(points: {x, y, sigma?}[]) => { xc, yc, R, chi2 }` | every track fit, the Kalman seed | Chapter 5 |
| `detector.heitlerShower` | `heitlerShower` | `(E0: number, Ec: number, rng?: Rng, opts?) => HeitlerShower` | the shower lab | Chapter 6 |
| `detector.multipleScatteringAngle` | `multipleScatteringAngle` | `(p: number, beta: number, xOverX0: number, z?: number) => number` | the detector simulation | Chapter 6 (optional) |
| `reco.houghTransform` | `houghTransform` | `(hits: {x, y}[], opts?) => { accumulator, nAngle, nCurv, peaks }` | track finding with `seeding: 'hough'` | Chapter 8 |
| `reco.kalmanUpdate` | `kalmanUpdate` | `(state: {x, P}, meas: {z, R}, H) => { x, P, chi2 }` | `kalmanTrackFit` | Chapter 8 |
| `conservation.checkReaction` | `checkReaction` | `(initial: number[], final: number[]) => { allowed, violated }` | the reaction judge | Chapter 11 |
| `gen.samplePartonX` | `samplePartonX` | `(f: (x) => number, n: number, r: Rng, xMin?) => number[]` | the parton-distribution figures | Chapter 13 |
| `gen.dsigmaEeMuMu` | `ee2mumuDiffXsec` | `(s: number, cosTheta: number) => number` (GeV⁻²) | `ee->mumu-qed`, hence `crossSection` | Chapter 16 |
| `gen.unweight` | `unweight` | `(w: number, wMax: number, rng: Rng) => boolean` | every hadron-collider process, the ISR sampler | Chapter 16 |
| `reco.antiKt` | `antiKt` | `(particles: P4[], R: number, ptMin?) => { jets: P4[], constituents: number[][] }` | jet clustering in `reconstruct` | Chapter 18 |
| `machine.trackLongitudinal` | `referenceTrackLongitudinal` | `(particles, params: RfParams, nTurns) => …` | the RF bucket | Chapter 19 |
| `machine.trackThroughLattice` | `referenceTrackThroughLattice` | `(lattice, x0, xp0, nTurns, plane) => { x, xp }` | the lattice designer | Chapter 20 |
| `machine.luminosity` | `referenceLuminosity` | `(p: LumiParams) => number` (cm⁻² s⁻¹) | the collider dashboard, the machine stage | Chapter 21 |
| `reco.missingPt` | `missingPt` | `(objects: P4[]) => { x, y }` | `reconstruct`, the W figures | Chapter 23 |
| `kinematics.transverseMass` | `transverseMass` | `(lepton: P4, met: {x, y}) => number` | the W transverse-mass figure | Chapter 23 |
| `reco.impactParameter` | `impactParameter` | `(track, vertex, jet?) => { d0, sigma, significance, … }` | `reconstruct`, b-tagging | Chapter 24 |
| `reco.bTag` | `bTagScore` | `(jet: P4, tracks, vertices) => number` | `RecoObject.btag` | Chapter 24 |
| `reco.assignTopJets` | `assignTopJetsReference` | `(jets, lepton, met, opts?) => Assignment \| null` | the top reconstruction figure | Chapter 25 |
| `trigger.l1Decision` | `referenceL1Decision` | `(ev: { towers, muonStubs }, thresholds: Record<string, number>) => string[]` | the pipeline's trigger stage | Chapter 27 |
| `analysis.fitLikelihood` | `fitLikelihoodReference` | `(data: number[], model: (p) => number[], p0: number[]) => { params, nll, errors }` | the fit figures | Chapter 28 |
| `analysis.significance` | `significanceReference` | `(s: number, b: number) => number` | the cut optimiser, the pipeline | Chapter 28 |
| `analysis.cls` | `clsReference` | `(nObs: number, s: number, b: number) => number` | the limit-setting code, the search sandbox | Chapter 32 |
| `oscillations.probability` | `probabilityTwoFlavourReference` | `(theta, dm2, L, E) => number` | the two-flavour figure | Chapter 31 |

Some of the hooks above exist before the exercise that feeds them is written, and a chapter may offer an exercise on a hook that is not in this list. The list is generated from the library: `grep -rn "hook('" src/lib/hep` finds every one, and the names are in each stage's README.

## Tests, and what they guarantee

Every module has Vitest tests next to the code (`*.test.ts`), deterministic, with fixed seeds. They check physics against closed forms and known numbers (the cross-section for e⁺e⁻ → μ⁺μ⁻, the Z width, the proton range in water, the unitarity of the PMNS matrix), conservation (energy and momentum in every generated event, to 10⁻⁹ relative), statistical behaviour (fit pulls with unit width, the distribution of the test statistic in pseudo-experiments) and, for some modules, speed. The speed tests assert **lower bounds, set at half the planning target** so that they pass on a loaded machine: they are guarantees of "at least this fast", not of the typical speed (Appendix E gives both). A test of the course also checks that every code exercise's reference solution passes its hidden tests and that its starter code fails them, so that no test is vacuous.
