# `hep/detector`: the fast simulation of *Onion*

Stage 3 of the pipeline. `simulate(truth, cfg, rng)` turns a generator's `TruthEvent` into a `DetectorEvent` (tracker hits,
calorimeter cells, muon-chamber hits). Everything random comes from the `Rng` you pass, so one seed gives one event.
Lengths are in mm, energies and momenta in GeV, fields in tesla, charges in units of *e*. No DOM, no Node, no `Math.random`.

```ts
import { simulate, presets, customise } from 'hep/detector';
import { rng } from 'hep';

const cfg = customise(presets.onion, { bField: 2 });          // a copy with one number changed
const event = simulate(truthEvent, cfg, rng(7), { pileup });  // pileup: extra TruthEvents to overlay
```

## Exported API

**Simulation** (`simulate.ts`)

| Export | What it is |
|---|---|
| `simulate(truth, cfg, rng, opts?)` | The fast simulation. `opts.pileup` overlays further truth events; `opts.secondaries` (an array) collects the particles created inside the detector. |
| `SimSecondary` | `{ pdg, parent, origin: 'decay' \| 'conversion' \| 'bremsstrahlung', vertex, p, charge }`, extra to the event model (the truth record does not contain these). |
| `truthOffsets(truth, pileup)` | Offsets of the pile-up events in the truth-index space (below). |
| `placeInBeamSpot(truth, cfg, rng)` | A copy of a truth event shifted to a vertex drawn from `cfg.beamSpot`. |

**Configuration** (`config.ts`)

| Export | What it is |
|---|---|
| `DetectorConfig` | `name, bField, trackerLayers[{r, halfLength, sigmaRPhi, sigmaZ, x0, kind}], ecal, hcal, muon{stations, returnField?, minPToReach}, etaMax, beamSpot, noiseHitsPerLayer, deadFraction`; optional extras: `ecal.material`, `hcal.material`, `hcal.noise`, `hcal.etaMax`, `solenoidRadius`, `description`. |
| `presets` | `minimal`, `onion`, `cms-like`, `atlas-like`, `sandbox`. |
| `customise(cfg, patch)` | Deep copy with fields replaced (sub-objects are shallow-merged, arrays replaced). |
| `deriveMuonMinP(ecal, hcal)` | The momentum a muon needs to cross the calorimeters (from the mean energy loss); the presets use it for `minPToReach`, which you can override. |
| `hcalOuterRadius(cfg)`, `ecalOuterRadius(cfg)`, `calorimeterThickness(ecal, hcal)` | Geometry helpers. |

**Helix** (`helix.ts`)

| Export | What it is |
|---|---|
| `helix(p, charge, vertex, bField)` | A `Helix`: `radius` (mm, `R[m] = pT / (0.29979 B)`), `pointAt(s)`, `directionAt(s)`, `momentumAt(s)` with `s` the 3-D path length in mm; `intersectCylinder(r, halfLength)` (arc length or `null` for a curler or an end-cap exit); `crossRadius`, `crossZ`, `exitVolume`, `turnLength`, `arcTo`. A positive particle turns clockwise seen from +z. `B = 0` or `charge = 0` gives a straight line. |
| `HelixTrack` | The mutable, allocation-free class behind it (`reset`, `evalAt`); the simulation uses it, widgets should use `helix()`. |
| `radiusOfCurvature(pT, B)`, `pTFromRadius(R, B)`, `sagitta(pT, B, chord)`, `CURVATURE_CONSTANT` | The 0.3 B R rule. |

**Matter** (`materials.ts`, `physics.ts`)

| Export | What it is |
|---|---|
| `materials` | Si, Fe, Pb, PbWO4, H2O, scintillator, Cu, air, W, Al, LAr, each with `density, X0, lambdaI` (g/cm²), `X0cm, lambdaIcm`, `Z, A, ZoverA, I, Ec`, plasma energy and density-effect parameters. `radiationLength(m)`, `interactionLength(m)` (cm), `criticalEnergy(m)` (GeV), `moliereRadius(m)` (cm). |
| `bethe({ material, betaGamma, mass?, z?, densityCorrection? })` | Mean collision loss in MeV cm²/g. `densityEffect`, `stoppingPower`, `meanEnergyLoss`. |
| `landau(rng, mpv, xi)` | A Landau-distributed energy loss with most probable value `mpv` and width `xi`. `landauPdf`, `landauCdf`, `landauLambda`, `mostProbableLoss`, `landauXi`, `sampleEnergyLoss`. |
| `multipleScatteringAngle(p, beta, x/X0, z?)` | Highland's projected angle width (radians). Hook: `detector.multipleScatteringAngle`. |
| `muonStoppingPower`, `muonEnergyAfter`, `muonRange`, `muonCriticalEnergy` | Muon ionisation plus radiative loss; range in cm. |
| `lnGamma`, `gammaP`, `gammaVariate`, `erf` | Special functions. |

**Showers and calorimetry** (`shower.ts`)

| Export | What it is |
|---|---|
| `heitlerShower(E0, Ec, rng?, opts?)` | The Heitler toy model: per-generation counts, mean energies, stopped energy; `totalDeposited` equals `E0`. Without an `rng` the split is equal (analytic); with one it is random. |
| `longitudinalProfile(E0, t, Ec, kind?)` | dE/dt at depth `t` (in X0) of the gamma-distribution profile; `longitudinalFraction`, `showerShape`. |
| `caloResponse('em' \| 'had', E, cfg, rng, nCells?)` | Measured energy: `a² Poisson(E/a²) (1 + bξ) + n √nCells η`. `caloResolution` gives σ/E predicted from the parameters. |
| `hadronShape`, `LATERAL_EM`, `LATERAL_HAD`, `smear` | The hadronic profile, the lateral profiles, the smearing function. |

## Conventions the other stages can rely on

* **Hits**: `layer` is the index in `cfg.trackerLayers`; `x, y, z` are the smeared position near the layer cylinder; `edep` (keV) is a
  Landau-fluctuated deposit in a 300 μm (pixel) or 320 μm (strip) silicon sensor, divided by the cosine of the angle of incidence.
  `truth` is the index in `truth.particles` of the particle the hit belongs to; for a secondary (a decay product, a conversion
  electron, a bremsstrahlung photon) it is the **truth ancestor**, so a kink or a V⁰ shows up as hits of one truth particle.
  `truth = −1` is noise.
* **Pile-up truth indices**: particle `i` of `pileup[k]` carries the index `truthOffsets(truth, pileup)[k] + i`, which is
  ≥ `truth.particles.length`. Particles of the hard event that carry `collision ≥ 1` are also followed and counted in
  `pileup`. Pile-up events whose first primary vertex is exactly (0, 0, 0) are spread along the beam by `cfg.beamSpot`.
* **Cells**: `eta, phi` are the cell centres (cell width `cellEta`; φ cells are `2π / round(2π / cellPhi)` wide); `layer` is the longitudinal
  segment; `truth` lists up to 64 contributors. A cell is kept when its energy after noise is above `2 × noise`; calorimeters cover
  `|η| < etaMax` (the endcap region is included, there are no separate disks).
* **Muon hits**: `station` is the index in `cfg.muon.stations`.
* Which truth particles are followed: `status === 'final'`; and charged particles with `status === 'decayed'` (or `'final'` with daughters) and an
  `endVertex`, only up to that vertex (their daughters are in the truth record). A `'final'` particle with no daughters that can decay
  (table lifetime, `decays`) is decayed in flight here, from the exponential law with its boosted lifetime (unless it has an
  `endVertex`, where it decays). Prompt resonances (π⁰, η, ρ, …) decay at their vertex. Neutrinos, quarks, bosons and unknown PDG codes are ignored.

## Physics in the simulation

1. **Geometry**. Concentric barrel cylinders; uniform field `bField` along +z inside the coil (`solenoidRadius`, default the HCAL
   outer radius), `muon.returnField` outside. Hits exist for tracks with |η| < `etaMax` at production, on each cylinder crossed
   within its half-length. A curler that cannot reach a layer leaves no hit there (and none beyond). Each track gives at most one hit per layer.
2. **Smearing**: Gaussian in the r·φ direction (σRPhi) and z (σZ). Dead channels are a fixed hash-map of (layer, φ·r/pitch, z/pitch) with
   pitch = σ√12, so the same channel is dead in every event; noise hits are Poisson in number, uniform in φ and z.
3. **Material in each tracker layer** (thickness `x0` radiation lengths, divided by the cosine of the incidence angle; silicon-like for ionisation):
   multiple scattering by Highland's θ0 (two independent planar kicks, direction updated); mean Bethe–Bloch ionisation loss (momentum updated, so
   later hits bend correctly); for electrons, bremsstrahlung with the Bethe–Heitler thickness law (−ln z is gamma-distributed with shape
   (x/X0)/ln 2), radiated energy emitted as real photons (accumulated until 50 MeV, flushed at the end of the tracker) that go on
   to the ECAL; for photons, conversion with probability 1 − exp(−7/9 x/X0) at the layer where it happens, the pair sharing the energy uniformly.
   A particle whose energy is used up stops.
4. **Decays in flight**: distance drawn from Exp(βγcτ); a channel by branching fraction; two-body decays isotropic, three or more by RAMBO with
   accept–reject; daughters start from the helix position and direction at the decay point and are followed in turn (K_S → ππ, Λ → pπ, π → μν, K → μν, μ → eνν, B → …).
5. **ECAL** (PbWO₄ by default): electrons and photons deposit with the gamma-distribution longitudinal profile (a = 1 + b t_max, b = 0.5,
   t_max = ln(E/Ec) ∓ 0.5), split over `ecal.layers`, the part beyond the ECAL going into the first HCAL layer; laterally a two-Gaussian
   profile (core 0.4 R_M with weight 0.9, halo 1.2 R_M) integrated over the cells, angular width = width / ρ at the entry point. Charged hadrons and
   neutral hadrons start showering at depth Exp(1) λI (ECAL then HCAL, each in its own λI), deposit their kinetic energy (plus 2m for antibaryons) with a
   gamma profile in λI (maximum 0.2 ln E + 0.7 λ) over both calorimeters, laterally 0.25 λI / 0.8 λI; a charged hadron that has not yet interacted leaves a MIP in the ECAL.
6. **Resolution emerges**: each shower's visible energy is multiplied by `a² Poisson(E/a²)/E × (1 + bξ)` (the same `a`, `b` for the whole shower; ECAL terms for
   the electromagnetic part, HCAL terms for hadrons), and every populated cell gets Gaussian noise σ = `noise`. σ/E of the summed cells follows a/√E ⊕ b (⊕ noise/E). There is no
   other resolution knob.
7. **Muons**: a MIP in every calorimeter layer (ECAL about 0.3 GeV, HCAL 0.03 GeV per λ); mean energy loss through the ECAL and HCAL absorber; stopped if
   p < `minPToReach` or the loss uses up the energy; otherwise a multiple-scattering kick for the absorber and a helix in the return field through the stations (σRPhi, σZ).
8. **Pile-up**: extra truth events go through the same code in a cheaper mode (see below).

## Performance

Measured as CPU time on one core of a busy shared machine (the tests assert half of the plan's targets): Z → μμ without pile-up
≈ 10⁴ events/s (target ≥ 2,000); with 50 pile-up collisions of 60 charged + 60 neutral-photon particles each (≈ 1,500 tracks and 1,500 photons in
acceptance) ≈ 45 events/s (target ≥ 50).
What makes it fast: no allocation in the track loop (`HelixTrack.reset/evalAt`), tabulated Landau quantiles, density effect, gamma-distribution
fractions and lateral profiles, dense integer keys for the cell maps, and the **cheap mode for pile-up**: particles of pile-up collisions
(`collision ≥ 1`, or from `opts.pileup`, and their decay products) skip the scattering, energy loss, bremsstrahlung and conversions in the tracker
(hit positions, counts and dE/dx are kept) and deposit calorimeter energy below 2 GeV in a single cell per layer. Particles pointing more than 0.3 in |η| beyond every detector are dropped at once.

## What is not modelled

* Geant4-grade physics: no δ-rays, no nuclear interactions or hadronic showers particle by particle, no photon or electron showers in the tracker,
  no low-energy processes; hadrons do not interact in the tracker and do not punch through to the muon system.
* Endcap disks (the η coverage of each layer comes from its half-length), the coil and cryostat material, cracks and gaps, tilted or stereo modules, a second crossing of a
  layer by a looping track, and non-uniform magnetic fields (the return field is uniform; the ATLAS toroids are approximated by a solenoidal stand-in).
* Curlers deposit nothing in the calorimeters; the helix inside the calorimeters is not followed (the shower axis is the entry point, charged or not).
* Calorimeter compensation: e/h = 1 and the ECAL measures hadronic energy on the hadronic scale; energy lost to neutrinos and nuclear binding is not removed;
  noise-only cells are not generated (only populated cells get noise and the 2σ suppression), sampling fractions are absorbed into the resolution terms.
* Electronics: no pulse shapes, timing, pile-up in time (out-of-time pile-up), cross-talk, charge sharing or cluster shapes; hits are points.
* Dead channels are a fixed fraction, not dead modules; noise hits are uniform.
* `minimal`, `sandbox`, `cms-like` and `atlas-like` use approximate and simplified numbers (comments in `config.ts` say which).

## Tests (`detector.test.ts`)

Helix against the analytic circle and the 0.3 B R rule; hit residual widths against σ; σ(pT)/pT of the onion preset from a least-squares circle fit
(0.4 % at 10 GeV, 1.2 % at 100 GeV, 4.7 % at 400 GeV, consistent with the Gluckstern estimate); Bethe–Bloch minimum in silicon (1.66 MeV cm²/g at βγ ≈ 3.5) and other
materials against the PDG; radiation lengths; Landau mode, FWHM and CDF; Highland widths in the simulation; energy conservation in Heitler showers and in the ECAL;
σ/E of `caloResponse` and of summed cells against a/√E ⊕ b ⊕ n/E; muon range, penetration and return-field bending; decay lengths, conversion and bremsstrahlung
probabilities; dead channels and noise; pile-up bookkeeping; determinism; robustness for every table particle; speed.
