---
number: E
title: The pipeline
summary: What each of the six stages of the mini-LHC models and what it does not, in the stages' own words, with the performance that the tests assert, which are lower bounds that pass on a loaded machine, beside what was measured.
duration: Look things up
prerequisites: []
---

Everything that moves in this course is computed by code written for the course: no third-party generator, simulator, fitter or plotting library runs in the browser. That makes the code part of the subject, and it makes an honest list of its limits part of the course. A simulation that does not say what it leaves out invites you to believe that it leaves nothing out.

This appendix is that list. It is derived from the `README.md` of each stage's module in `src/lib/hep/`, in which the author of each stage wrote down what is modelled, what is approximate and what is missing, and it follows them closely. Where a number is quoted, it is either the value a test asserts or a value that a test or script measured; the two are kept apart. [Appendix F](/appendix/hep-reference/) is the reference for the functions.

## The map

| # | Stage | Module | Question it answers |
|---|---|---|---|
| 1 | Machine | `hep/machine` | How many collisions per bunch crossing, how hard, and where along the beam? |
| 2 | Generator | `hep/gen`, with `hep/shower`, `hep/hadronise`, `hep/decay`, `hep/sm` | Given a process and an energy, which particles come out? (Truth) |
| 3 | Detector | `hep/detector` (*Onion*) | What would the sensors record? (Hits, cells) |
| 4 | Reconstruction | `hep/reco` | What do the algorithms think happened? (Tracks, objects) |
| 5 | Trigger | `hep/trigger` | Which events would be kept? |
| 6 | Analysis | `hep/analysis` | What does the kept data say? (Histograms, fits, limits) |

The stages exchange the event model of `hep/event`: the **truth** record (particles with PDG codes, four-momenta, vertices, status, mother and daughter links, in the style of the HepMC format that the field uses), the **detector** output (hits, calorimeter cells, muon hits), the **reconstructed** objects (each carrying the index of the truth particle it came from) and the **columnar tables** for analysis (one array per variable, jagged collections as offsets plus values, as in Awkward Array). The whole chain is also one function call, `hep/pipeline`'s `runBatch`, which gives each event its own random streams derived from the seed and the event number, so that a batch does not depend on how it is split between workers.

Three things hold for every stage.

- **Everything is seeded.** The same configuration and seed give the same events.
- **Energy and momentum are conserved** in every generated event, to a relative 10⁻⁹ (the tests assert it; the actual figure is about 10⁻¹⁴).
- **A stage is a toy of the production system it stands for**, and says so. The production systems appear in the *In the experiments* boxes of the chapters (Pythia and MadGraph for generation, Geant4 and Delphes for simulation, ACTS for tracking, FastJet for jets, ROOT for analysis).

## Stage 1: the machine (`hep/machine`)

**Models.** Beam optics with 2 × 2 transfer matrices (drifts, thin and thick quadrupoles, dipoles, RF kicks), ring tracking turn by turn, stability and Twiss parameters, tunes (from the one-turn matrix and from the FFT of tracked data), chromaticity, FODO cells and an LHC arc cell. Longitudinal dynamics: the standard map, the RF bucket (separatrix, height, area), slip factor, transition energy and synchrotron tune. Synchrotron radiation, stored energy and machine protection (energy per turn for electrons and protons, the energy of a beam in tonnes of TNT). Luminosity from the beam parameters, with the geometric factor for a crossing angle, the pile-up μ, the filling pattern, the burn-off of a fill, and the machine stage's output (luminosity, μ, bunch spacing, √s) that the generator and the trigger use.

**Does not model.** Collective effects (instabilities, electron cloud) and the beam–beam interaction, beyond the prose of Chapter 21. The LHC preset is made of numbers from the public design report (CERN-2004-003) and from the Run 3 parameters; each number is commented with its source, and the Run 3 values are illustrative and not an official table. The filling pattern is a simplified 3,564-slot pattern. The inelastic cross-section used for pile-up is 80 mb, which is approximate. The optics is first order: 2 × 2 transfer matrices.

**Measured.** Energy lost by an electron at LEP, 104.5 GeV, bending radius 3,026 m: 3.49 GeV per turn. An LHC proton at 7 TeV: 6.66 keV per turn (5.93 keV at 6.8 TeV), critical photon energy 43.8 eV. Design luminosity 1.009 × 10³⁴ cm⁻² s⁻¹ (geometric factor 0.840, σ\* = 16.6 µm, μ = 25.6). Stored energy 362 MJ, which is 86.6 kg of TNT. Synchrotron tune at 7 TeV 2.04 × 10⁻³ (23 Hz); injection bucket 1.43 eV·s. All are checked by tests.

## Stage 2: the generator (`hep/gen`, `hep/shower`, `hep/hadronise`, `hep/decay`, `hep/sm`)

**Models.** A **hard process** at leading order, chosen by name. The processes are: e⁺e⁻ → f f̄ through γ and Z with their interference and the forward–backward asymmetry (μμ, ττ, quarks), Bhabha scattering, Drell–Yan Z/γ\* → ℓℓ, W → ℓν, QCD 2 → 2 jets, γγ, gg → H with decays H → γγ, ZZ\* → 4ℓ, bb̄, ττ, WW\* → ℓνℓν, tt̄ (dilepton, lepton + jets, hadronic), a heavy Z′ (the sequential Z′ of Chapter 32, with adjustable mass and couplings), and a toy minimum-bias collision for pile-up. Cross-sections come from VEGAS-adapted Monte Carlo integration with an independent analytic cross-check wherever there is a closed form, and events are unweighted by accept–reject. Then the **parton shower** (`hep/shower`: a pT-ordered final-state shower on the Sudakov veto algorithm, with angular ordering, and a simplified initial-state shower), the **toy Lund string** (`hep/hadronise`), and the **decays** (`hep/decay`: from the particle table, with decay points from the lifetimes and exact conservation of four-momentum, charge, baryon and lepton number). `hep/sm` supplies the couplings, widths and running constants. Pile-up collisions are generated and decayed separately and merged.

**What it was checked against.** The tests compare with closed forms and with numbers: σ(e⁺e⁻ → μ⁺μ⁻) = 86.85 nb/s[GeV²] from 4πα²/3s; α(m_Z) = 1/128.96 (the on-shell-type running; the MS-bar value is 1/127.95); the leading-order widths Γ(Z → ℓℓ) = 83.4 MeV, Γ(Z → νν) = 165.9 MeV, Γ_Z = 2.42 GeV (2.48 GeV with the QCD factor), against the measured 83.98 MeV, 167.1 MeV and 2,495.5 MeV; the R-ratio plateaus; the CKM matrix unitarity to 10⁻¹⁰; the W and top-decay angular distributions; and, for every process, the Monte Carlo integral against the deterministic quadrature (pulls under 4). The leading-order cross-sections that come out at 13 TeV (Z → μμ 1.59 nb, W⁺ → μν 9.6 nb, gg → H 14.1 pb, tt̄ 439 pb) are "about right for leading order". **No claim of agreement with any measurement is made.** The higher-order corrections are 20–25 % for W and Z, a factor of 1.9 for tt̄ and about 3.4 for gg → H. Two reference totals mentioned in the source's documentation (48.58 pb for gg → H and 831.76 pb for tt̄ at 13 TeV) are quoted from memory of the LHC Higgs Cross Section Working Group and Top++ calculations, and should be checked before they are cited.

**Does not model.**

- *Higher orders.* No higher-order corrections beyond the optional K-factors (which the text says whenever a chapter quotes a rate); no colour reconnection; no tuned underlying event.
- *Parton distributions.* A **pedagogical parametrisation, not a fit**: hand-chosen shapes at Q₀ = 1.27 GeV, normalised by the sum rules, evolved with the real leading-order DGLAP equation. Nothing was downloaded and no published table was used. Individual distributions can differ from a real set by 10–30 %.
- *Matrix elements and spin.* Decays are isotropic, with no matrix elements, so the angular distributions and spin correlations of Z → ℓℓ, W → ℓν and H → ZZ\* → 4ℓ are produced at the hard process and not by the decay stage. No tt̄ spin correlation. No identical-lepton interference in H → 4ℓ. The lighter boson of H → VV\* is cut at 4 GeV and the heavier at m_H/2. Z, W and top widths in propagators are fixed numbers. The 3-body and 4-body decays have flat phase space instead of their real form-factor spectra, the Dalitz decay π⁰ → γ e⁺e⁻ included; τ decays have no polarisation and no V − A spectrum.
- *Approximate pieces.* The gg → γγ box normalisation is not checked against a published number. The minimum-bias constants (dN/dη, the multiplicity distribution, ⟨pT⟩ = 0.55 GeV) are rounded and approximate, and momentum is not conserved in a minimum-bias collision.
- *The shower* is a toy: one-loop coupling; massless kinematics inside the cascade; no interference beyond angular ordering; no spin correlations; no dead-cone radiation from c and b; a global rescaling that spreads the recoil over all partons instead of a local recoil; initial-state radiation with a toy parton-density ratio and a damping with pT0 = 2 GeV, a value quoted from memory; no matrix-element corrections; no multiple parton interactions; no g → q q̄ backward conversions; no initial-state radiation in e⁺e⁻ events (except the photon of the e⁺e⁻ processes). The first emission is limited to pT ≤ Q/6, a tuning of the toy (the mean Z pT it gives is about 8.5 GeV against about 10 GeV measured at the LHC, and its hard tail is missing). **The proton remnants are not modelled.**
- *The hadronisation* is a toy Lund string with parameters (a, b, σ, the strangeness and diquark fractions, the Peterson ε values) quoted from memory and labelled approximate. The partons of a gluon-carrying string are cut into q q̄ segments, which is closer to a cluster picture than to the kinked Lund string. The beam-remnant colour lines are closed on a stand-in remnant carrying 0.25 GeV, so hadrons carry that much extra energy. The hadron table lacks the vector K\*, D\* and B\* (replaced by K, D, B), the B_c, the Σ\*, Ξ\* and the heavy-flavour excited baryons, and the η_c, χ and η_b: **too few vector mesons and heavy baryons.** At 91 GeV the result is about 16 charged particles per event (LEP measures about 21).
- *The decay table* is a reduced list, and some branching fractions do not sum to one (D⁰ sums to 0.969); the renormalisation hides that.

**Performance.** The planning targets were 100,000 e⁺e⁻ → μ⁺μ⁻ hard events per second per core and 5,000 pp → Z → μμ events per second per core. The tests assert at least **50,000** and **2,500**: half of the targets. The developer's measurements were about 600,000 and about 27,000 events per second (hard process only); the whole chain with shower, hadronisation and decays runs at about 380 pp → Z → μμ events per second, and for a 100 GeV qq̄ dijet event the shower + hadronisation + decay chain is asserted at 500 events per second against a target of 1,000. (The first call at a new √s trains the VEGAS grid, which takes 0.1 to 2 s.)

## Stage 3: the detector (*Onion*, `hep/detector`)

**Models.** Concentric barrel cylinders in a uniform solenoid field; hits with Gaussian smearing in r·φ and z, noise and a fixed pattern of dead channels; multiple scattering by Highland's formula, Bethe–Bloch ionisation loss with Landau fluctuations, bremsstrahlung (Bethe–Heitler thickness law) and photon conversion in the tracker material; decays in flight; an ECAL and an HCAL with longitudinal and lateral shower profiles in which the resolution **emerges** from the stochastic, constant and noise parameters (a/√E ⊕ b ⊕ n/E) and is not imposed; a muon system with the muon's energy loss through the calorimeters and a return field; pile-up overlaid through a cheaper mode. Presets: `minimal`, `onion`, `cms-like`, `atlas-like` and `sandbox`.

**Does not model.**

- *Geant4-grade physics*: no δ-rays, no nuclear interactions and no hadronic showers particle by particle, no photon or electron showers in the tracker, no low-energy processes; hadrons do not interact in the tracker and do not punch through to the muon system.
- *Geometry*: no endcap disks (the η coverage of each layer follows from its half-length), no coil or cryostat material, no cracks or gaps, no tilted or stereo modules, no second crossing of a layer by a looping track, and no non-uniform fields (the return field is uniform; the ATLAS toroids are approximated by a solenoidal stand-in).
- *Calorimeters*: curlers deposit nothing; no compensation (e/h = 1, the ECAL measures hadronic energy on the hadronic scale); energy lost to neutrinos and nuclear binding is not removed; noise-only cells are not generated (only populated cells get noise and the 2σ suppression); sampling fractions are absorbed into the resolution terms.
- *Electronics*: no pulse shapes, no timing, no out-of-time pile-up, no cross-talk or charge sharing, no cluster shapes; hits are points. Dead channels are a fixed fraction, not dead modules; noise hits are uniform.
- `minimal`, `sandbox`, `cms-like` and `atlas-like` use approximate and simplified numbers, as the comments in `config.ts` say.

**What it was checked against.** The helix against the analytic circle and the 0.3 B R rule; hit residuals against σ; the transverse-momentum resolution of the `onion` preset from a circle fit (0.4 % at 10 GeV, 1.2 % at 100 GeV, 4.7 % at 400 GeV, consistent with the Gluckstern estimate); the Bethe–Bloch minimum in silicon (1.66 MeV cm²/g at βγ ≈ 3.5) and other materials against the PDG; radiation lengths; Landau mode, FWHM and cumulative distribution; Highland widths; energy conservation in Heitler showers and the ECAL; σ/E of the calorimeters against the formula within 10 %; muon range and penetration; decay lengths, conversion and bremsstrahlung probabilities.

**Performance.** Targets: Z → μμ without pile-up at least 2,000 events per second, with 50 pile-up collisions at least 50. The tests assert **1,000** and **25**. Measured by the developer: about 10,000 and about 45 events per second.

## Stage 4: reconstruction (`hep/reco`)

**Models.** Track finding by seeding from pixel triplets (or from the Hough transform) and a road-based extension, then a fit with the full covariance of hit resolution and multiple scattering, ambiguity resolution; a Kalman track fit; primary-vertex finding by clustering in z and fitting, secondary vertices from displaced tracks; topological calorimeter clustering and test-beam-style calibration; a simplified particle flow; muons (tracker plus muon-system stubs), electrons, photons (with conversions), taus (as narrow 1- and 3-prong jets), isolation, jets (anti-kT, kT, Cambridge/Aachen), missing pT, b-tagging by a logistic combination of impact-parameter and vertex features, and truth matching with efficiencies and fake rates.

**Does not model.**

- *Tracker*: barrel layers only; seeds need three hits in the four innermost layers (in the `cms-like` preset the pixel layers stop at |z| = 270 mm, so seeds exist only for |η| ≲ 1.6 there); no energy loss or bremsstrahlung in the fit (electrons are fitted with the pion mass, which is why E/p has a tail); no kink or V⁰ finding beyond a K⁰s veto; no looper tracks; no alignment or calibration constants; dead channels are not known.
- *Vertices*: no vertex-constrained refit, no adaptive or annealing finder (clusters closer than about 0.5 mm merge), no correlation between the transverse and z parts of a track's covariance.
- *Calorimeter*: no energy splitting of shared cells, no η-dependent or non-linear calibration (one scale per calorimeter), no timing.
- *Particle flow and objects*: the expected calorimeter response of a hadron is its momentum; a block's neutral excess is shared between one photon and one neutral hadron; no pile-up subtraction beyond charged-hadron subtraction (no PUPPI, no area subtraction); no jet energy corrections; no lepton identification beyond the listed variables; taus only as narrow jets; the muon momentum is the tracker's (no combined fit), so its resolution at very high pT is the tracker's.
- *b-tagging*: a logistic combination of six quantities, with weights fitted on simulated jets of the course detector. It is a calibration to the course detector and not a generic tagger. Its light-jet mistag rate (0.2 % at 70 % b efficiency) is better than the ~1 % of a real detector because the simulation has no gluon splitting to heavy flavour, no hadronic interactions in the material and no fake tracks. No calibration in data.
- *Truth matching*: a track's truth link is that of its hits, so decay products and conversion electrons link to their parent.

**Measured performance** (`onion` preset, simulated events of the detector stage). Tracking efficiency for pT > 1 GeV: 99.6 % with no pile-up, 98.8 % at 20 and 50 pile-up collisions, 99.4 % at 100; no fakes in 20,000 and 25,000 tracks at 20 and 50 pile-up, about 2 in 19,000 at 100. Momentum resolution (muons, |η| < 0.9): 0.4 % at 1 GeV, 0.36 % at 10 GeV, 1.8 % at 100 GeV, 5.5 % at 300 GeV; d0 resolution 44 µm at 1 GeV and 10–11 µm above 100 GeV. Z → μμ mass resolution 0.5 %. b-tagging at the 0.5 working point: b 74 %, c 26 %, light 0.3 %.

**Speed.** Targets: Z → μμ at least 2,000 events per second without pile-up and at least 50 with 50 pile-up collisions. The tests assert **1,000** and **25**. Measured: 0.55 ms per event (about 1,800 per second) and 33 ms per event (about 30 per second).

## Stage 5: the trigger (`hep/trigger`)

**Models.** Level 1 from coarse calorimeter towers (0.1 × 2π/64) and muon stubs, with a fixed latency budget (4 µs here), jet, e/γ and missing-ET algorithms and thresholds; the high-level trigger as a fast version of the reconstruction, with selections for muons, dimuons, electrons, diphotons, jets, HT, MET and low-mass B-physics; menus with prescales; rates from weighted cross-sections times luminosity, with dead time, bandwidth, per-item and overlap rates, and the physics lost; the turn-on curves and their fit.

**Approximate (the README's list).** The split of the L1 latency, the dead time per accept (100 ns), the L1 tower and stub model, and **all the cross-sections and acceptances of the toy samples, which are rounded, illustrative values at 13.6 TeV**.

**Tested.** That rate = σ L × efficiency with its binomial error; that a menu's OR counts overlapping events once; that the fast catalogue evaluator agrees with the general rate estimate; that a sensible menu keeps Higgs and Z events, thresholds at 100 GeV throw the Z away, and low jet thresholds blow up the rate. The trigger stage has no speed target.

## Stage 6: the analysis (`hep/analysis`)

**Models.** Histograms (fixed and variable bins, weights and the sum of squared weights, 2-D), selections and cut flows, a quasi-Newton minimiser (BFGS with a Nelder–Mead fallback, parameter limits, MINOS-style intervals), binned and unbinned maximum-likelihood fits with exact bin integrals, Gaussian, crystal-ball, Breit–Wigner, exponential and polynomial shapes, the likelihood of a counting experiment with a background-normalisation nuisance parameter, the asymptotic discovery significance (Cowan, Cranmer, Gross and Vitells), pseudo-experiments, local and global p-values (look-elsewhere), CLs limits with their bands, bump hunting, selection optimisation and blinding.

**Checked.** Over 500 toys each of binned and unbinned fits of a Gaussian on an exponential: pull means within ±0.15 of zero and widths of 0.93 to 1.06 for all five parameters. The distribution of the test statistic q₀ in 2,000 background-only toys matches ½χ²₁; the median toy significance for s = 20, b = 100 agrees with the Asimov value within 0.15σ. A CLs counting example (b = 3, n = 3) gives a 95 % limit s = 5.395, checked by direct Poisson sums. The limits from the asymptotic, toy and exact methods agree within 10 %.

**Does not model.** A real analysis has hundreds of nuisance parameters and control regions; the course's counting model has at most one background-normalisation nuisance parameter. The significance and limit formulae are asymptotic, with exact counting alternatives and toys for comparison.

**Performance.** Targets: 10⁶ events histogrammed in under 100 ms; an unbinned fit of 10⁵ events in under 1 s. The tests assert under **400 ms** and under **3 s**. Measured: about 85 ms, and 0.75 to 1.1 s.

## The whole chain

`hep/pipeline` runs all six stages from one configuration. Its test asserts that Z → μμ without pile-up runs at at least **40 events per second per core** through all stages, with the trigger, analysis and accumulation costing under a quarter of the time; the developer measured about 130 to 260 events per second on a busy machine (the generator alone about 380, the simulation about 1,000, the reconstruction about 800). The planning target for the whole chain, a Higgs peak visible within two minutes of a cold start, is met by shipping precomputed samples (`static/data/`) made by the same code with fixed seeds.

## What the figures of Part VIII add

Three figures of the last chapters are toys built **on top of** the stages and say so on the page.

- The **search sandbox** (Chapter 32) uses the generator for the signal and the Drell–Yan background and the analysis library for the limits, but replaces the detector and the reconstruction by a selection (two muons with |η| < 2.4 and pT > 30 GeV, 95 % efficient each) and a Gaussian mass smearing of 2 % ⊕ 2 % × (m/TeV). Only Drell–Yan enters the background.
- The **muography** and **proton** figures (Chapter 33) use `hep/muography` (a parametrisation of the sea-level muon flux and a continuous energy-loss model for rock) and `hep/detector`'s Bethe–Bloch for protons in water; they do not use the pipeline.
- The **oscillation lab** (Chapter 31) is `hep/oscillations`, which is exact for what it computes and models none of an experiment's detector.

## Why a pipeline with these limits is still useful

The aim of each stage is to be **right about the structure** of the production tool it stands for, and wrong, where it has to be, about the details. Event generation is Monte Carlo sampling of a cross-section; reconstruction is an inverse problem solved with a seed-and-extend search; a trigger is a filter with a bandwidth budget; a limit is a statistical test with a known sensitivity. These are the same in the production systems. The numbers are not. A physical result needs the production tools, with their calibration to data. Anything computed here answers "what would this method do?" and not "what is nature's value?".
