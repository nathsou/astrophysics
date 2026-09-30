# Course plan — *Particle Physics*

The living plan for the course: agreed decisions, curriculum, the pipeline the reader builds, and
milestones. Update it when decisions change or chapters land.

The course explains the Standard Model and how we know it. Alongside the physics, the reader builds a
mini-LHC in the browser: a machine, an event generator, a detector, reconstruction, a trigger and an
analysis. Each chapter adds or upgrades one stage, often with code the reader writes. In Chapter 29 the
whole chain runs to find the Higgs boson in simulation. The same analysis then runs on real open data from
the LHC experiments.

## Decisions (agreed 2026-09-30)

| Topic | Decision | Notes |
|---|---|---|
| Title | **Particle Physics** | Slug `particle-physics`, published at `/particle-physics/`. *Accelerator Physics* was the other candidate. It names the beam-dynamics field, which is one part of this course (Part V), so it would promise a different course. |
| Reader | **A software engineer who has worked at CERN** | Knows the lab, its machines and experiments by name, and its software (ROOT, Geant4, the grid, the experiments' frameworks). Has not necessarily studied the physics. No tourist introductions; the physics and the maths are taught from the ground up. |
| Text | **One text for everyone** | No depth slider and no tiered variants (unlike astrophysics). A long derivation may fold into `:::details`, but the main text never depends on it. |
| Maths | Engineering-school maths, used freely | Algebra, calculus, vectors and matrices, complex numbers, probability. Special relativity, quantum mechanics, Lagrangians and matrix groups are taught where needed, with primers in appendices A and B. Tree-level calculations are done in full for a few processes, with helicity amplitudes rather than trace technology. Loops and renormalisation are shown, not derived. |
| Units | Natural units (ħ = c = 1, energies in GeV) from Chapter 1 | SI where the machine needs it (tesla, metres, amperes). A units converter and hoverable constants are available everywhere. Metric signature (+, −, −, −). LHC coordinate conventions: z along the beam, azimuth φ, polar angle θ, pseudorapidity η, transverse momentum pT. |
| Aim | Understand the Standard Model and how it is measured, by **building a mini-LHC** | Six stages: machine → generator → detector → reconstruction → trigger → analysis. See *The pipeline*. |
| Order | Physics order, with the pipeline **interleaved** | Each part adds the stage its physics needs: detectors before the zoo, the first generator with QED, jets with QCD, the machine before proton-collider physics, the trigger just before the Higgs search. |
| Code-along | The reader writes pipeline code in **TypeScript**, in the browser | The harness is copied from Language Models: CodeMirror 6, a TS 6 language service in a worker, code run in a worker against hidden tests, and a *use my code* toggle per stage. Every stage also has a reference implementation, so skipping an exercise never blocks a later chapter. |
| Simulation | Our own TypeScript physics library, `hep` | No third-party generator, simulator or fitter runs in the browser. Pythia, MadGraph, Geant4, Delphes and FastJet appear in validation scripts outside CI and in *In the experiments* callouts. |
| Real data | Open data only **where it makes the chapter better** | See *Real data*. Small derived subsets (at most 5 MB each) made by scripts outside CI, with a manifest recording the source, licence, selection and checksum. |
| Site | SvelteKit 2 + Svelte 5, `adapter-static`, the Markdown-with-directives compiler copied from Digital Circuits | Single npm package. Output in `dist/`, base path from `BASE_PATH`. |
| Physics components | Ported from astrophysics | Equations with hoverable terms, hoverable constants, Fermi estimates, predict questions, history cards with portraits, photographs with credits. The depth tiers are not ported. |
| TypeScript version | **TS 6**, as in Digital Circuits, Proofcraft and Language Models | `svelte-check` and the in-browser language service need the TypeScript JS API, which TS 7 does not have. |
| Editor | CodeMirror 6 | TypeScript for the reader's pipeline code. |
| Rendering | SVG for diagrams; Canvas 2D for plots and histograms; WebGL2 for the chambers, the event display, the field lattice and beam tracking | WebGPU only where it pays (the lattice gauge demo), always with a fallback. No three.js or charting libraries, as in the rest of the collection. Respect `prefers-reduced-motion`. |
| Compute | Web Workers for generation, simulation and reconstruction; a seeded random number generator everywhere | Long chains start from precomputed samples, made by a script with the same code and seeds. *Regenerate* reruns them with the reader's code. |
| Sound | Web Audio: Geiger clicks, the muon detector's beeps | **Off by default**, one global toggle remembered in `localStorage`. |
| Images | Historic photographs and portraits only under a clear licence (public domain, CC0, CC BY), with attribution | Same attribution rules as astrophysics' `Portrait`. |
| Progress | `localStorage` for exercises and settings; IndexedDB for the reader's code and saved pipeline configurations; export/import as JSON | |
| Design | **"Tracks"**: bubble-chamber film by day, an event display by night | See *Look and feel*. Shares the collection's `theme` key. |
| Scope | The Standard Model and how it is measured | Nuclear physics only as needed (astrophysics covers fusion and nucleosynthesis). Heavy ions are a section of Chapter 18. No formal QFT course. Gravity and strings appear only in Chapter 32. |
| Language | British English | |

## Through-lines

1. **The mini-LHC.** The reader builds the six stages of *The pipeline*, and later chapters run on what they
   built.
   - A chapter marked *You write* has a code exercise. Once it passes its tests, the reader's function
     replaces the reference one in that stage (*use my code*).
   - Every stage has a reference implementation, and the toggle can switch back at any time.
   - The Control Room shows the whole chain and which parts are the reader's.
   - This is Digital Circuits' parts bin, applied to physics software.
2. **Truth and reconstruction.** Every simulated event exists twice, linked object by object:
   - the **truth**: what the generator produced;
   - the **reconstruction**: what the detector and the algorithms saw.

   Efficiency, fake rates and resolution are all comparisons between the two. With real data, only the
   reconstruction exists, and Chapter 29 makes that point by swapping one for the other.
3. **The dimuon map.** In Chapter 2, the reader's first function computes the invariant mass of real muon
   pairs, and peaks appear, unlabelled. Each peak gets its label in the chapter that explains it:
   - ρ, ω and φ in Chapter 13;
   - the Z in Chapter 23;
   - the J/ψ, ψ(2S) and Υ family in Chapter 24.

   Chapter 27 explains the one feature that is not a particle: the step near 8 GeV where the trigger
   switches on.
4. **Predict, then reveal.** At the historic moments, the reader gets the data physicists had and makes the
   call before the answer is shown. Examples:
   - which way Anderson's particle travelled;
   - the mass of the Ω⁻;
   - the number of neutrino types;
   - where the Higgs would be.
5. **Scattering is seeing.** One experiment recurs at every scale: fire something at a target and look at
   what comes out. The energy–distance dial (λ ≈ ħc/E) follows it:
   - Rutherford and Hofstadter (Chapter 4);
   - SLAC (Chapter 13);
   - LEP (Chapter 23);
   - the LHC (Chapter 29).
6. **The ledger.** The conservation laws are collected in a ledger (Chapter 11). Some are later struck
   through:
   - parity (Chapter 22);
   - CP (Chapter 24);
   - lepton flavour (Chapter 31).

   Energy–momentum, charge and colour remain. Baryon number is tested by proton-decay limits (Chapter 32).
7. **Programmer's view.** Short callouts map physics and its software to ideas the reader already has:
   - a Feynman diagram expansion is a series expansion, truncated;
   - event generation is Monte Carlo sampling, and weighted events are importance sampling;
   - a Kalman filter is recursive state estimation, as in GPS or robotics;
   - reconstruction is an inverse problem;
   - a trigger is a stream filter with a latency and bandwidth budget;
   - blinding is a held-out test set;
   - the look-elsewhere effect is multiple comparisons (p-hacking done honestly);
   - a systematic uncertainty is a model that might be wrong.
8. **In the experiments.** For a reader who has worked at CERN, callouts show how the production systems do
   what the course's toy does, and where the toy is simpler. Examples:
   - Pythia and MadGraph for generation;
   - Geant4 and Delphes for simulation;
   - ACTS for tracking;
   - FastJet for jets;
   - ROOT and RDataFrame for analysis;
   - EDM4hep for event data;
   - the trigger farms and the grid.

## Chapter template

Hook (a real event, a photograph or a history card) → 🔮 predict → explore (the flagship interactive) →
explain (hoverable equations) → 🧮 Fermi estimate → 🧑‍💻 build (a code exercise that joins the pipeline) →
🔭 in the experiments → ⚙️ under the hood → 🔧 build it for real (where there is a lab) → what's next →
further reading.

Standards per chapter:

- 3,000–6,000 words, in one text.
- One flagship interactive, plus 2–4 smaller figures.
- At least one *predict* question, placed where intuition is usually wrong.
- At least one Fermi estimate and one history card.
- At least one exercise. Chapters marked *You write* have a code exercise that feeds the pipeline.
- Every symbol in an equation is hoverable.
- An *Under the hood* box wherever the library does something non-trivial.
- A closing section that leads into the next chapter.

## Curriculum

### Prologue

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 0 | Anatomy of a collision | One LHC collision, followed from the beams to one entry in a histogram; the six stages; what the reader will build; how the course works | Scroll-driven journey: bunches cross → partons collide → particles cross the detector → hits → reconstructed objects → trigger decision → a histogram bin gains one entry | The finished pipeline, shown running |

### Part I — Foundations

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 1 | Scales and natural units | eV and GeV; ħ = c = 1; ħc ≈ 197 MeV·fm; energy ↔ length ↔ time ↔ mass; the barn; the energy–distance dial; from atoms to the LHC's 10⁻¹⁹ m | Powers-of-ten zoom from a grain of sand to the LHC's resolution, with the energy needed to see each scale | Adds: `hep/units` |
| 2 | Relativity for particles | Four-momenta; invariant mass; boosts; rapidity and pseudorapidity; pT; fixed target vs colliding beams; production thresholds; computing m² = E² − p² without catastrophic cancellation | **The dimuon map**: the reader's function runs on real CMS dimuon events and peaks appear, unlabelled | You write: four-vector operations, `invariantMass`, `boost`. Adds: kinematics |
| 3 | Quantum essentials | Spin; fermions and bosons; exclusion; uncertainty; decay as a random process; lifetime and width; the Breit–Wigner shape; branching ratios; cross-section and luminosity (rate = σL) | Decay clock: thousands of unstable particles, with lifetime and width linked by one slider; Geiger clicks make Poisson statistics audible | You write: decay-time sampling, two-body decays. Adds: generator v0 (a particle gun with decays) |
| 4 | Scattering is seeing | Rutherford scattering; the differential cross-section; resolution λ ≈ ħc/E; form factors and the size of the proton (Hofstadter); elastic and inelastic scattering | Geiger and Marsden rebuilt: fire alphas at gold foil, count scintillations at each angle, fit the result | You write: an accept–reject sampler for Rutherford's formula |

### Part II — Seeing particles

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 5 | Tracks | Charge in a magnetic field; p = 0.3·B·R; sagitta; Thomson's e/m; cloud and bubble chambers; ionisation trails; momentum resolution from field and lever arm | **Cloud chamber** (WebGL2): alphas, betas and cosmic muons. Add a field and a lead plate to recreate Anderson's photograph; its particle is identified in Chapter 9 | You write: a circle fit that returns pT. Adds: detector v0 (a silicon tracker in a solenoid) |
| 6 | Particles through matter | Bethe–Bloch and dE/dx; range; multiple scattering; radiation length; bremsstrahlung and pair production; electromagnetic showers (Heitler's model); hadronic showers; Cherenkov and transition radiation; why neutrinos escape | Shower lab: fire an electron, a pion or a muon into lead, iron or water and watch the shower develop | You write: Heitler's toy shower. Adds: material effects |
| 7 | Building a detector | The onion: tracker, ECAL, solenoid, HCAL, muon system; signatures of each particle; resolution formulae; hermeticity and missing momentum; how ATLAS and CMS chose differently | **Detector designer**: set the field, radii and calorimeter depths within a budget, fire particles, and watch the resolutions change | Adds: detector v1 (Onion's full fast simulation) and the event display |
| 8 | Reconstruction | From hits to objects: seeding and combinatorics; the Hough transform; the Kalman filter; vertices; calorimeter clusters; electrons, photons, muons; particle flow; truth matching, efficiency and fake rate | Tracking under growing pile-up: the reader's tracker against the reference, with efficiency and fake-rate curves updating live | You write: a Hough transform; a Kalman filter step. Adds: reconstruction v1 |

### Part III — The zoo

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 9 | Antimatter | Dirac's equation and its negative-energy solutions (the one place spinors are written out); the positron; pair production and annihilation; the antiproton and its threshold; antihydrogen at CERN; PET | Anderson's photograph solved: which way did the particle go, and what was it? | Adds: antiparticles to the particle table |
| 10 | Cosmic rays, pions and muons | Hess's balloons; air showers; Yukawa's argument from range to mass; the muon is not Yukawa's particle; the pion in emulsions; muon lifetime and time dilation; "who ordered that?" | An air shower from a 10¹⁵ eV proton; muons reaching the ground with and without time dilation | Adds: a cosmic-muon source (to compare with the *Build it for real* labs) |
| 11 | Conservation laws | Charge, baryon and lepton numbers; strangeness and associated production; exact and approximate laws; the ledger | **Reaction judge**: type a reaction and see every law checked, with the one that forbids it named | You write: the conservation checker over the particle table |
| 12 | The Eightfold Way | Isospin; strangeness; SU(3) flavour as a pattern; octets and decuplets; resonances as bumps (the Δ in pion–proton scattering); the Ω⁻ prediction | **Eightfold Way puzzle**: place the baryons, find the missing corner, predict its mass, then see the 1964 event re-simulated in the course's bubble chamber | — |
| 13 | Quarks | The quark model; colour (the Δ⁺⁺ and the exclusion principle); magnetic moments (μp/μn = −3/2); vector mesons; SLAC's deep inelastic scattering; Bjorken scaling; partons; parton distributions | Quark builder; deep inelastic scattering at increasing resolution, from a blob to three hard points | Adds: parton distributions (proton beams in the generator); ρ, ω and φ labelled on the dimuon map |

### Part IV — Forces as fields

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 14 | Fields and particles | A field as coupled oscillators; quanta; mass and the dispersion relation; creation and annihilation; virtual particles and propagators; Yukawa's potential from exchange | **Field lattice** (WebGL2): pluck a field of coupled oscillators, add a mass term, and watch wave packets behave like particles | — |
| 15 | Feynman diagrams | Vertices and propagators; coupling powers; tree diagrams and loops; what a diagram is and is not; crossing | **Diagram sketchpad**: draw a process and the vertex rules accept or reject it; all tree diagrams for a process are enumerated | Challenge: enumerate the tree diagrams of e⁺e⁻ → μ⁺μ⁻γ |
| 16 | QED | e⁺e⁻ → μ⁺μ⁻ computed: σ = 4πα²/3s and 1 + cos²θ; Bhabha scattering; the electron's g − 2; running α; the R ratio and three colours | A virtual e⁺e⁻ collider: scan √s, measure σ and the angular distribution, then compare R with real data | You write: Monte Carlo integration and unweighting. Adds: generator v1 (e⁺e⁻ → f f̄ with matrix elements); analysis v1 (cross-sections from counts and luminosity) |
| 17 | Symmetry and gauge invariance | Noether's theorem; global and local phase symmetry; the covariant derivative; the photon as the price of local symmetry; U(1), SU(2) and SU(3) as matrix groups; generators and commutators | **Phase dial**: rotate arrows on a grid globally or locally; the link field that keeps local rotations consistent. Optional: U(1) lattice gauge Monte Carlo (WebGPU) | — |
| 18 | QCD | Colour and gluons; gluon self-coupling; asymptotic freedom and confinement; string breaking and hadronisation; jets; three-jet events and the gluon's discovery; running α_s; the quark–gluon plasma (ALICE) | String breaking; a parton shower growing into jets | You write: anti-kT jet clustering. Adds: generator v2 (parton shower, toy string hadronisation); jets in reconstruction |

### Part V — The machine

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 19 | Accelerating particles | Electrostatic machines; RF cavities and linacs; the cyclotron and its relativistic limit; the synchrotron; phase stability and RF buckets; bunches; CERN's injector chain from Linac4 to the LHC | **RF bucket**: particles oscillating in longitudinal phase space; overfill it and watch them spill | — |
| 20 | Steering and focusing | Dipoles and p = 0.3·B·ρ; superconducting magnets; quadrupoles; strong focusing; transfer matrices; FODO cells; stability (\|Tr M\| < 2); betatron tune and resonances; emittance and the β function | **Lattice designer**: build a ring from dipoles and quadrupoles, track particles turn by turn, and find stable tunes | You write: transfer-matrix tracking |
| 21 | Colliding beams | Luminosity; β* and crossing angles; pile-up; integrated luminosity; synchrotron radiation (∝ γ⁴/ρ); why LEP stopped at 209 GeV and the LHC collides protons; stored energy and machine protection; the 2008 incident; HL-LHC and future colliders | **Collider dashboard**: set bunch intensity, emittance and β*, read the luminosity and pile-up, and see the effect in the detector | You write: the luminosity formula. Adds: the machine stage (rates and pile-up overlay) |

### Part VI — The weak force

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 22 | The weak force | The continuous beta spectrum; Pauli's neutrino; Fermi's theory and G_F; detecting the neutrino; parity violation; helicity and V − A; π → eν vs π → μν (helicity suppression, computed) | **Mirror**: Wu's experiment and its mirror image, side by side | Parity struck through in the ledger |
| 23 | W and Z | Electroweak unification; the weak mixing angle; W and Z masses predicted; neutral currents; the SppS and stochastic cooling; the W and Z discovered; the Z lineshape and three neutrinos; the W mass today | **Counting neutrinos**: fit the LEP Z lineshape with 2, 3 and 4 neutrino types | You write: missing transverse momentum; transverse mass. Adds: Drell–Yan Z and W production; the Z labelled on the dimuon map |
| 24 | Flavour | Three generations; Cabibbo; GIM and charm; the November Revolution; the CKM matrix and unitarity; CP violation in kaons and B mesons; b-hadron lifetimes and displaced vertices; LHCb | The unitarity triangle built from measurements; the J/ψ and Υ peaks labelled on the dimuon map | You write: impact parameter; a secondary-vertex b-tagger. Adds: vertexing and b-tagging. CP struck through in the ledger |
| 25 | The top quark | The last quark; its mass predicted from precision fits; the Tevatron discovery; it decays before it can form hadrons; tt̄ events; mass reconstruction and combinatorics | Reconstruct top pairs in the lepton + jets channel; watch the combinatorial background shrink with b-tagging | You write: jet–parton assignment by χ². Adds: tt̄ production |

### Part VII — The Higgs boson

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 26 | The Higgs mechanism | Why mass terms break gauge symmetry; spontaneous symmetry breaking; Goldstone bosons and the longitudinal W and Z; the Higgs boson; Yukawa couplings and fermion masses; the superconductor analogy | **Mexican hat**: a ball in the potential; all particle masses on one log scale | — |
| 27 | A needle in a haystack | Higgs production is about one collision in 10⁹; rate = σL again; the trigger: L1 in hardware within microseconds, HLT in software; menus, thresholds and prescales; the trigger's step on the dimuon map; data volumes; the Worldwide LHC Computing Grid | **Trigger game**: 40 MHz in, about a thousand events per second out; design a menu and see which physics you threw away | You write: an L1 algorithm. Adds: the trigger stage |
| 28 | The statistics of discovery | Counting and Poisson; likelihoods and fits; p-values and 5σ; the look-elsewhere effect; systematics and nuisance parameters; blinding; limits; famous false alarms | **Bump hunter**: inject a signal, run pseudo-experiments, and watch fluctuations fool you | You write: a likelihood fit; the significance. Adds: analysis v2 (fits, significance, limits) |
| 29 | Finding the Higgs | Signal and backgrounds for H → γγ and H → ZZ* → 4ℓ; selection; the diphoton mass fit; the four-lepton peak; the 4 July 2012 seminar; the same analysis on real open data | **The whole pipeline**: machine → generator → detector → reconstruction → trigger → analysis, then the simulation swapped for real data | The reader's analysis on their own pipeline, then on open data |
| 30 | Measuring the Higgs | Spin and parity; couplings proportional to mass; production modes and decays; the self-coupling and the shape of the potential; vacuum stability; HL-LHC | Couplings against mass: the straight line, built from the measurements | — |

### Part VIII — Open questions

| # | Chapter | Key ideas | Flagship interactive | Pipeline |
|---|---|---|---|---|
| 31 | Neutrinos | The solar neutrino problem; oscillations; Super-Kamiokande, SNO, KamLAND; the PMNS matrix; the mass ordering; absolute masses (KATRIN); Majorana or Dirac; long-baseline beams, CNGS and OPERA | **Oscillation lab**: sliders for mixing angles, Δm² and L/E; reproduce reactor and atmospheric data | You write: the oscillation probability. Lepton flavour struck through in the ledger |
| 32 | Beyond the Standard Model | Dark matter (with the astrophysics course's evidence); the matter–antimatter asymmetry; the hierarchy problem; supersymmetry and other searches; unification and proton decay; gravity; the muon g − 2 saga; future colliders | **Search sandbox**: a hypothetical new particle; set its mass and coupling, run the pipeline, set a limit | Adds: limit setting in the analysis |
| 33 | Particle physics in the world | Medical imaging and therapy; muography from Alvarez's pyramid scan to ScanPyramids; detector spin-offs (Medipix); the Web and the grid; what to explore next | Muography: find a hidden chamber from muon counts | — |

Appendices:

- **A.** Maths primers: complex numbers and phases; vectors, matrices, eigenvalues and unitarity; a calculus
  refresher; probability (Poisson, Gaussian, likelihood); Fourier intuition; Lagrangians in brief.
- **B.** Physics primers: special relativity and quantum mechanics, linked to astrophysics' primers where
  they overlap.
- **C.** Units, constants and conventions: natural units, conversions, the metric, detector coordinates.
- **D.** Particle data: the Standard Model particles, the hadrons used in the course, decay tables (from the
  PDG, cited).
- **E.** The pipeline: what each stage models and what it does not (in the spirit of Digital Circuits'
  appendix C).
- **F.** The `hep` library reference, for the code exercises.
- **G.** Build it for real: kit list, safety, and each lab.
- **H.** Glossary, timeline (the history-card deck) and bibliography.

### Links to the astrophysics course

Link to these chapters instead of repeating them:

- `primer-quantum`, `relativity` (E² = p²c² + m²c⁴) and `primer-waves`;
- `fusion`: the pp chain, the weak interaction and solar neutrinos (Chapter 31);
- `big-bang`: freeze-out, g*, and the number of neutrino types from helium (the same answer as LEP's in
  Chapter 23);
- `neutron-stars`: degeneracy and beta equilibrium;
- `cmb`, `galactic-dynamics` and `structure`: the evidence for dark matter (Chapter 32).

## The pipeline

The reader's mini-LHC. Each stage is a module of the `hep` library with a reference implementation. The
functions the reader writes plug into these modules.

### Event model (`src/lib/hep/event`)

- **Truth record:** particles with PDG IDs, four-momenta, production vertices, status (incoming,
  intermediate, final) and mother/daughter links, in the style of HepMC.
- **Simulation output:** hits, calorimeter deposits and digitised signals.
- **Reconstructed objects:** tracks, vertices, clusters, electrons, photons, muons, jets and missing pT. In
  simulation, each has links to the truth.
- **Event tables for analysis:** columnar (structure of arrays), with jagged collections stored as offsets
  plus values, as in Awkward Array.
- **Open data:** converted into the same reconstructed-object format, so one analysis runs unchanged on
  simulation and on real data.
- *In the experiments:* EDM4hep and the experiments' own event data models.

### Stage 1: machine (`src/lib/hep/machine`)

- **Modes:** e⁺e⁻, pp, and pp̄ (for the SppS and the Tevatron).
- **Parameters:** √s, bunch spacing, and instantaneous luminosity from beam parameters (Chapter 21).
- **Pile-up:** the mean number of collisions per crossing follows from σ_inel and the luminosity, and the
  luminous region spreads the vertices along z.
- **Optics toolkit** (Chapters 19–20):
  - transfer matrices for drifts, quadrupoles (thin and thick), dipoles and RF kicks;
  - ring tracking, tunes, and β functions from the one-turn matrix;
  - longitudinal dynamics: synchrotron motion and the RF bucket.
- **Not modelled:** collective effects (instabilities, electron cloud) and the beam–beam interaction, beyond
  prose.

### Stage 2: generator (`src/lib/hep/gen`)

- **Processes**, with leading-order matrix elements:
  - e⁺e⁻ → μ⁺μ⁻, τ⁺τ⁻, qq̄ through γ and Z, with their interference and the forward–backward asymmetry;
  - Bhabha scattering;
  - Drell–Yan (γ*/Z → ℓℓ) and W → ℓν;
  - QCD 2 → 2, for jets and for fakes;
  - the γγ continuum;
  - gg → H through the effective vertex, with H → γγ and H → ZZ* → 4ℓ;
  - tt̄ from gg and qq̄;
  - a hypothetical Z′ for the search sandbox;
  - a toy minimum-bias model for pile-up.
- **Parton distributions:** a coarse grid of one leading-order set, interpolated, or a documented
  parametrisation. The choice depends on licences (*Open questions*).
- **Phase space:**
  - two-body decays and RAMBO for n bodies;
  - Breit–Wigner mappings for resonances;
  - VEGAS-style adaptive integration;
  - weighted and unweighted events.
- **Parton shower:** a toy final-state shower (pT-ordered, with the Sudakov veto algorithm) and simplified
  initial-state radiation.
- **Hadronisation:** a toy Lund string for qq̄ systems, with hadron decays from a reduced table.
- **Decays:** the particle table with branching ratios from the PDG. Spin correlations are kept only where a
  chapter needs them (Z → ℓℓ angular distributions, W → ℓν, H → ZZ* → 4ℓ).
- **Not modelled:** higher-order corrections (K-factors are applied where a chapter quotes rates, and the
  text says so), colour reconnection, and a tuned underlying event.

### Stage 3: detector, *Onion* (working name) (`src/lib/hep/detector`)

- **Geometry:** cylindrical barrel and endcaps. Configurable:
  - solenoid field;
  - pixel and strip layers (radii, resolution, material);
  - ECAL (material, depth in radiation lengths, granularity);
  - HCAL (depth in interaction lengths);
  - muon system (radii, optional return-yoke field);
  - η coverage.
- **Propagation:** helices in a uniform field; RK4 in the non-uniform return field.
- **Material effects:**
  - energy loss (Bethe–Bloch, with Landau fluctuations);
  - multiple scattering (Highland's formula);
  - bremsstrahlung and photon conversions in the tracker material.
- **Calorimetry:**
  - parametrised electromagnetic and hadronic showers (longitudinal gamma distribution, lateral profile);
  - sampling fluctuations, so the energy resolution emerges from the parameters rather than being imposed.
- **Signals:** hits and digitised signals with resolution and noise. Dead regions can be switched on for
  exercises.
- **Presets:** one for each chapter's needs, one for each design philosophy (a CMS-like compact solenoid; an
  ATLAS-like layout with its toroid approximated), and a sandbox.
- **Not modelled:** Geant4-grade simulation, electronics, detailed timing.

### Stage 4: reconstruction (`src/lib/hep/reco`)

- **Tracking:**
  - seeding from pixel triplets, or from the Hough transform (Chapter 8);
  - a combinatorial Kalman filter;
  - track fits with χ² and pulls.
- **Vertices:** primary vertices by clustering in z, then fitting; secondary vertices.
- **Calorimetry:** topological clustering and energy calibration.
- **Objects:**
  - electrons (a track plus an ECAL cluster); photons (ECAL, no track, with conversions); muons (tracker plus
    muon system);
  - jets: anti-kT, kT and Cambridge/Aachen, with a choice of R;
  - a simplified particle flow;
  - missing pT;
  - b-tagging (impact-parameter significance, secondary-vertex mass);
  - isolation.
- **Truth matching:** by ΔR and by shared hits. Efficiencies and fake rates are computed from it.

### Stage 5: trigger (`src/lib/hep/trigger`)

- **L1:** coarse calorimeter towers and muon-chamber stubs, a fixed latency budget, and thresholds.
- **HLT:** a fast version of the reconstruction.
- **Menus:** with prescales.
- **Rates:** from weighted cross-sections times luminosity, with dead time.

### Stage 6: analysis (`src/lib/hep/analysis`)

- **Data:** columnar event tables, and selections written as typed TypeScript lambdas.
- **Histograms:** fixed and variable binning, with weights.
- **Fits:** binned and unbinned maximum likelihood, a quasi-Newton minimiser, and profile-likelihood
  intervals.
- **Significance:** asymptotic formulae, the profile-likelihood ratio, and pseudo-experiments.
- **Limits:** CLs.
- **Look-elsewhere:** the trials factor from pseudo-experiments.

### Performance targets (set in M0 from benchmarks, revised then)

| What | Target |
|---|---|
| e⁺e⁻ → μ⁺μ⁻ generation | At least 100,000 events/s per worker |
| pp → Z → μμ with parton distributions, toy shower and hadronisation | At least 5,000 events/s per worker |
| Onion simulation and reconstruction, Z → μμ, no pile-up | At least 2,000 events/s per worker |
| The same with 50 pile-up collisions | At least 50 events/s per worker |
| Event display | 60 fps with 20,000 hits and 1,000 tracks |
| Chambers and field lattice | 60 fps on an integrated GPU |
| Analysis | 10⁶ events histogrammed in under 100 ms; an unbinned fit to 10⁵ events in under 1 s |
| Chapter 29 | The Higgs peak visible within 2 minutes of a cold start on a recent laptop (precomputed samples show it at once) |

## The Control Room (`#/control-room`)

A full-screen workspace for the whole pipeline, the counterpart of Digital Circuits' bench. It is also
embedded in compact form in chapters.

- **Panes:** one per stage (machine, generator, detector, reconstruction, trigger, analysis). Each pane shows
  its configuration and whether it runs the reference code or the reader's.
- **Run:** events stream through the workers. Each stage shows its rates and counters, as a run-control
  display does, and histograms fill live.
- **Event display:**
  - 3D (WebGL2), transverse (r–φ) and longitudinal (r–z) views, and an η–φ lego plot;
  - truth and reconstruction overlaid, and linked: select an object to see what it came from;
  - step through events, filtered on the trigger decision or on an analysis selection.
- **Status strip:** machine mode, √s, luminosity, pile-up, events processed and trigger rate, in the spirit
  of the LHC's *Page 1*.
- **Sharing:** configurations are shared by URL (JSON compressed with `CompressionStream`, then base64url)
  and autosaved.
- **Links:** every chapter figure that runs part of the pipeline has an **Open in the Control Room** button.

## Other interactives

| Interactive | Chapters | Notes |
|---|---|---|
| Cloud and bubble chambers | 5, 9, 10, 12 | WebGL2 droplets and bubbles. Tracks come from the detector library's material model, so range, dE/dx, curvature and delta rays are physically right |
| Scanning table | 5, 12, 23 | Measure tracks with an on-screen ruler and protractor, on simulated pictures and on historic photographs where their licence allows |
| Reaction judge | 11 onwards | Quantum-number tables from the particle table; explains *why* a reaction is forbidden, and that allowed is not the same as observed |
| Eightfold Way puzzle and quark builder | 12, 13 | Weight diagrams generated from the SU(3) representations |
| Feynman sketchpad | 15 onwards | Diagram model (a graph with typed edges), vertex rules from the Standard Model couplings, automatic layout, SVG in the textbook style (wavy photons, curly gluons, dashed Higgs, fermion-flow arrows); tree-level enumeration for a process |
| Field lattice | 14 | Symplectic leapfrog integration on WebGL2 |
| Phase dial and lattice gauge demo | 17 | Metropolis updates of a U(1) lattice on WebGPU, with a CPU fallback on a smaller lattice |
| RF bucket and lattice designer | 19, 20 | Canvas 2D phase-space plots; turn-by-turn tracking; tunes from an FFT of the turn-by-turn positions |
| Oscillation lab | 31 | Three-flavour PMNS probabilities, with matter effects by numerical propagation |
| Muography | 33 | Muon counts through a pyramid with and without a hidden chamber |

## Real data

Open data is used where it makes a chapter better than a simulation would. Every dataset is a small derived
subset, made by a script in `scripts/data/` (Python with uproot, outside CI). The output is committed under
`static/data/` with a manifest giving the source DOI or URL, the licence, the selection applied, the
software versions and a checksum. A dataset without a licence that allows redistribution is not shipped.
Datasets and precomputed samples share a budget of about 40 MB in total, set in M0.

The survey behind this table (2026-09-30) could read GitHub and PyPI directly. The CERN Open Data portal,
HEPData, the PDG site, arXiv and CDS were not reachable from the planning environment. Rows marked
*to confirm* rely on secondary sources and are re-checked on the record page before anything ships.

| Ch | Dataset | Source and licence | What it shows | Shipped as |
|---|---|---|---|---|
| 2, 13, 23, 24, 27 | **CMS dimuon events**: 100,000 opposite-sign muon pairs from the 2011 DoubleMu stream | CERN Open Data record 5201 (education mirror on GitHub, `Dimuon_DoubleMu.csv`, 13.9 MB). CC0 | The dimuon map. Checked: the masses run from 0.3 to 300 GeV, and ρ/ω, φ, J/ψ, ψ(2S), Υ(1S, 2S, 3S) and Z all stand out above the continuum. The trigger's turn-on near 8 GeV is visible too, which Chapter 27 explains | Four-momenta and charges only (the reader computes the mass), as Float32 columns: about 3.4 MB |
| 29 | **CMS H → ZZ* → 4ℓ candidates**, 2011–12 | CERN Open Data record 5200 (CSV files of 5–31 kB each, with full four-vectors). CC0 | The four-lepton mass peak at 125 GeV, from the events CMS used | As published |
| 29 | **ATLAS H → γγ and H → 4ℓ**, 13 TeV: the 2020 education release (10 fb⁻¹; the GamGam sample is 3.5 GiB) or the 2025 education release (36 fb⁻¹) | CERN Open Data, ATLAS records 15000–15006 and 93910. CC0 | The diphoton bump, the result the reader's pipeline found in simulation | A few MB of photon and lepton four-vectors, reduced once with uproot |
| 23 | **LEP Z lineshape**: hadronic cross-section against √s | HEPData tables from L3, OPAL and DELPHI (CC0 by default; ALEPH's to confirm). Combined results: Phys. Rept. 427 (2006) 257 | Counting neutrinos: N_ν = 2.9840 ± 0.0082 (2006), moved to 2.9963 ± 0.0074 by two 2020 corrections to the luminosity measurement (a beam–beam effect, Voutsinas et al.; the Bhabha cross-section, Janot and Jadach). The move is a lesson in systematics, used again in Chapter 28 | A few kB |
| All | **Particle data**: masses, widths, lifetimes, quantum numbers, branching ratios | The PDG API data (CC BY 4.0, 2026 edition), read from the `pdg` package's SQLite file (package under a modified BSD licence) | The particle table, `:particle[…]` chips, the generator's decays | A few hundred kB of JSON, cited |
| 16, 18 | **R ratio** and pp cross-sections against √s | The PDG's cross-section compilations (COMPAS group): small ASCII files. Licence *to confirm* | R's steps at the charm and bottom thresholds; three colours | A few kB, if the licence allows; otherwise reference values from the PDG review text (CC BY 4.0) |
| 31 | **Oscillation parameters** | NuFIT 6.0 (JHEP 12 (2024) 216, CC BY 4.0) | Defaults for the oscillation lab | Numbers only, cited |
| 31 | **Reactor and atmospheric L/E points** (KamLAND, Super-Kamiokande) | No machine-readable tables found. Points would be digitised from the published figures | The oscillation curve in real data | Only if digitising is judged acceptable; otherwise simulated from the NuFIT parameters, and labelled as simulated |
| 31 | **OPERA events** (CNGS beam from CERN to Gran Sasso) | CERN Open Data, including ν_τ candidates. CC0 | A ν_τ appearing in a ν_μ beam, in the experiment's own hits | Hit lists, if small enough. *To confirm* |
| 10, 28 | **Cosmic-muon flux** | PDG *Cosmic rays* review (CC BY 4.0): about 70 m⁻² s⁻¹ sr⁻¹ vertically above 1 GeV, or about 1 cm⁻² min⁻¹ on a horizontal detector; a cos²θ zenith dependence | The reference the *Build it for real* measurements are compared with | Numbers only, cited |

Not shipped:

- **TrackML** (the 2018 Kaggle tracking challenge). Its licence is unconfirmed and it is about 200 GB.
  Chapter 8 uses Onion's own hits, which have exact truth.
- **Detector event displays from CDS** unless the record says CC BY 4.0 or CC BY-SA 4.0. CERN's general
  audiovisual terms do not allow making images available to third parties. The CMS Higgs candidate
  displays appear to be CC BY-SA 4.0 (*to confirm*); ATLAS's are unconfirmed.

Historic images:

| Ch | Image | Licence | Use |
|---|---|---|---|
| 5, 9 | Anderson's positron photograph (1932) | Public domain (Wikimedia Commons: the US copyright was not renewed) | Shown, then solved in Chapter 9 |
| 12 | The Ω⁻ bubble-chamber photograph (Brookhaven, 1964) | BNL's copy is CC BY-NC-ND 2.0 and asks for permission; the Commons tag looks doubtful | Not shown unless BNL grants permission. The event is re-simulated in the course's bubble chamber from its published kinematics, with a link to BNL's photograph |
| 23 | Gargamelle's neutral-current event (1973) | CDS 39468: CC BY 4.0 (*to confirm*). CDS 39470 is under CERN's standard terms and is not used | Scanning-table exercise |
| Any | Other CERN photographs | Only from CDS's *Creative Commons Images from CERN* collection (CC BY 4.0, some older ones CC BY-SA) | History cards |

## Under the hood

The reader is a programmer, so the library is part of the subject. Each *Under the hood* box explains the
algorithm behind the chapter's figures, with an excerpt of the real code.

| Ch | Topic |
|---|---|
| 2 | Floating point and relativity: m² = E² − p² for a 6.8 TeV electron keeps about two significant digits in double precision and none in single precision (the storage format of the event tables); the forms that keep them, such as (E − p)(E + p), and why the library computes in doubles |
| 3 | Sampling: inverse transform for exponentials; two-body phase space; RAMBO for n bodies |
| 4 | Accept–reject and importance sampling for Rutherford's 1/sin⁴(θ/2), which diverges at small angles |
| 5 | Helix propagation; RK4 in a non-uniform field; algebraic circle fits (Kåsa, Karimäki) |
| 6 | Material effects as random processes: Landau fluctuations, Highland's formula, parametrised showers |
| 7 | Detector geometry as a spatial index; digitisation; resolution models |
| 8 | Combinatorial track finding; the Hough transform; the Kalman filter's predict and update; χ² and pulls |
| 11 | The reaction judge: quantum-number tables, and why "allowed" is not "observed" |
| 12 | Generating SU(3) multiplets from a highest weight |
| 13 | Parton-distribution grids and their interpolation; sampling x₁ and x₂ |
| 14 | Integrating a lattice of coupled oscillators: symplectic leapfrog and its dispersion |
| 15 | Enumerating tree diagrams from vertex rules: graph generation with symmetry factors |
| 16 | Monte Carlo integration, VEGAS and unweighting |
| 18 | The Sudakov veto algorithm; the Lund string toy; anti-kT from O(N³) to O(N²), and FastJet's O(N log N) geometry |
| 20 | Transfer matrices and symplecticity; tunes from the FFT of turn-by-turn data |
| 21 | Luminosity integrals; overlaying pile-up; the bunch-crossing timeline |
| 23 | Missing pT and the transverse mass; sampling Breit–Wigner resonances |
| 24 | Vertex fitting; impact-parameter significance |
| 25 | Combinatorial jet assignment by χ² |
| 27 | Trigger emulation; rate estimation with weighted events; prescales and dead time |
| 28 | A quasi-Newton minimiser; the profile likelihood; the asymptotic formulae of Cowan, Cranmer, Gross and Vitells; pseudo-experiments |
| 29 | Converting open data into the course's format; the whole chain in workers; precomputed samples and caching |
| 31 | Three-flavour oscillations with a complex unitary matrix; matter effects |

## History cards

`:::history` blocks render as flip cards, as in Digital Circuits. The front shows a photograph or portrait
(when its licence is clear), the year and a one-line hook. The back tells the story, why it matters for the
chapter, and the sources. The cards the reader has seen are collected in the timeline (appendix H).

| Ch | Cards |
|---|---|
| 0 | The CERN convention comes into force (1954) |
| 1 | Planck's natural units (1899) |
| 2 | Einstein (1905) and Minkowski's spacetime (1908) |
| 3 | Stern and Gerlach (1922); spin (Uhlenbeck and Goudsmit, 1925); Pauli's exclusion principle (1925) |
| 4 | Geiger and Marsden (1909) and Rutherford's nucleus (1911); Hofstadter measures the proton's size (1950s) |
| 5 | Thomson's e/m (1897); Wilson's cloud chamber (1911); Glaser's bubble chamber (1952) |
| 6 | Bethe's energy-loss formula (1930); Cherenkov's light (1934) |
| 7 | Charpak's multiwire proportional chamber at CERN (1968); silicon microstrip detectors in fixed-target experiments at CERN (early 1980s) |
| 8 | Hough invents his transform to analyse bubble-chamber pictures (1959); Kalman (1960); the Kalman filter applied to track fitting (Frühwirth, 1987) |
| 9 | Dirac's equation (1928); Anderson's positron (1932); the antiproton at the Bevatron (1955); antihydrogen at CERN (1995, 2002); antimatter falls down (ALPHA-g, 2023) |
| 10 | Hess's balloon flights (1912); Yukawa (1935); the muon (1936–37); Rossi and Hall measure time dilation with muons (1941); Conversi, Pancini and Piccioni (1947); the pion in emulsions (1947) |
| 11 | The V particles (Rochester and Butler, 1947); strangeness (Gell-Mann, Nishijima, 1953) |
| 12 | Fermi's Δ resonance (1952); the Eightfold Way (Gell-Mann, Ne'eman, 1961); the Ω⁻ at Brookhaven (1964) |
| 13 | Gell-Mann's quarks and Zweig's aces, written at CERN (1964); colour (Greenberg, 1964; Han and Nambu, 1965); SLAC–MIT deep inelastic scattering (1968); Feynman's partons (1969) |
| 14 | Dirac quantises the electromagnetic field (1927) |
| 15 | Feynman's diagrams at the Pocono conference (1948); Dyson's equivalence (1949) |
| 16 | The Lamb shift and Kusch's g − 2 (1947); Schwinger's α/2π (1948) |
| 17 | Noether's theorem (1918); Weyl's gauge idea (1918, 1929); Yang and Mills (1954) |
| 18 | Asymptotic freedom (Gross, Wilczek, Politzer, 1973); Wilson's lattice (1974); three-jet events at PETRA (1979) |
| 19 | Widerøe's linac (1928); Lawrence's cyclotron (1931); Cockcroft and Walton split the atom (1932); phase stability (Veksler, 1944; McMillan, 1945); CERN's Synchrocyclotron (1957) |
| 20 | Strong focusing (Christofilos, 1950; Courant, Livingston and Snyder, 1952); the PS (1959) |
| 21 | AdA, the first electron–positron storage ring (1961); the ISR, the first hadron collider (1971); van der Meer's stochastic cooling (1972); LEP (1989–2000); the LHC incident (19 September 2008) and first 7 TeV collisions (30 March 2010) |
| 22 | The continuous beta spectrum (Chadwick, 1914); Pauli's letter to the "radioactive ladies and gentlemen" (1930); Fermi's theory, rejected by *Nature* (1933); Reines and Cowan (1956); Wu (1957); Goldhaber measures the neutrino's helicity (1958) |
| 23 | Glashow (1961), Weinberg (1967), Salam (1968); 't Hooft and Veltman (1971); neutral currents in Gargamelle (1973); UA1 and UA2 find the W and Z (1983); LEP counts neutrinos (1989) |
| 24 | Cronin and Fitch (1964); Cabibbo (1963); GIM (1970); Kobayashi and Maskawa (1973); the November Revolution (1974); the Υ (1977); CP violation in B mesons (BaBar and Belle, 2001) |
| 25 | CDF and D0 find the top quark (1995) |
| 26 | Englert and Brout, Higgs, Guralnik, Hagen and Kibble (1964) |
| 27 | Berners-Lee's proposal, "vague but exciting" (1989); ROOT (mid-1990s); the Worldwide LHC Computing Grid |
| 28 | Faster-than-light neutrinos and a loose connector (OPERA, 2011–12); the 750 GeV diphoton excess (2015–16) |
| 29 | LEP's final hints at 115 GeV (2000); the 4 July 2012 seminar |
| 30 | The Nobel Prize to Englert and Higgs (2013); H → bb̄ and ttH observed (2018) |
| 31 | Pontecorvo (1957); Davis's Homestake tank (1968); Super-Kamiokande (1998); SNO (2001); OPERA's ν_τ appearance (2015) |
| 32 | Zwicky (1933) and Rubin (1970s), linked to astrophysics; Sakharov's conditions (1967); the muon g − 2 from Brookhaven to Fermilab's final result (2025), and the tension that dissolved when lattice QCD recomputed the hadronic contribution |
| 33 | Alvarez scans Khafre's pyramid with muons (1960s); ScanPyramids finds a void in Khufu's pyramid (2017); Robert Wilson proposes proton therapy (1946) |

Every date and claim on a card cites a source in the bibliography. The list above is checked in the review
pass of each milestone.

## Build it for real

Optional `:::real` boxes, collected in appendix G.

- **Kit:**
  - a cloud chamber: a clear box, dry ice, isopropyl alcohol, felt, a torch;
  - a Geiger counter and a potassium-rich salt substitute (potassium chloride, whose ⁴⁰K is a natural beta
    and gamma source);
  - a CosmicWatch desktop muon detector (or two, for coincidences): under $100 in parts. Its design is
    CC BY-NC 4.0, so the course links to the project and does not redistribute its files or data;
  - a smartphone, whose camera sensor is a silicon pixel detector.
- **Safety:**
  - dry ice: gloves, never in a sealed container, ventilation;
  - isopropyl alcohol: flammable, ventilation, no flames;
  - only exempt everyday sources such as potassium chloride; no bought or old radioactive sources (no
    thoriated mantles, no radium dials);
  - no high voltage (so no spark chambers).

| Ch | Lab |
|---|---|
| 3 | Count ⁴⁰K decays with a Geiger counter; check that the counts are Poisson-distributed |
| 5 | Build a dry-ice cloud chamber; tell alphas, betas and muons apart by their tracks |
| 7 | Use a phone camera as a pixel detector: cover the lens, record, and find the hits |
| 10 | Measure the cosmic-muon rate with CosmicWatch; its dependence on the zenith angle; the rate at altitude (on a mountain or in an aeroplane) and underground |
| 28 | Analyse your own muon data: rates, uncertainties, and a fit of the zenith-angle distribution |

## Look and feel: "Tracks"

- **Light theme:** bubble-chamber film. A pale, slightly warm grey page, tracks and diagrams in ink, and
  fiducial crosses as section markers.
- **Dark theme:** an event display. A near-black page, luminous tracks and calorimeter towers.
- **Particle styles:** each kind of particle has one colour and one line style everywhere (event displays,
  Feynman diagrams, histograms, the particle table), in both themes. Colour is never the only cue:
  - electrons and photons (solid and wavy);
  - muons (thick solid);
  - hadrons and jets (thin solid, jet cones);
  - neutrinos and missing pT (dotted);
  - quarks, gluons, W, Z and H in diagrams (arrows, curls, wavy, dashed).
- **Type:** JetBrains Mono (shared with the collection) for values and code. The display and prose faces are
  chosen with the mockups in M0 and must differ from the other courses'.
- **Collection index card:** an electron's spiral from a bubble-chamber picture, drawn as one stroke, beside
  two muon tracks leaving an event display.
- **Accessibility:**
  - every widget is keyboard-operable;
  - live values are exposed to screen readers;
  - colours meet WCAG contrast in both themes;
  - animation and sound are optional.

## Content and components

The Markdown compiler, layout and content components are copied from Digital Circuits and adapted (the
collection keeps each course self-contained). The code-along harness is copied from Language Models.

- **Reused directives:**
  - callouts (`:::key`, `:::question`, `:::warning`, `:::challenge`, …);
  - `:::bio`, `:::details`, hints, `quiz`, `parsons`;
  - equations with hoverable terms;
  - glossary terms, timeline, bibliography;
  - `:::predict`, `:::programmer`, `:::hood`, `:::real`, `:::history`.
- **New directives:**
  - `:::fermi{title}`: a Fermi estimate, ported from astrophysics;
  - `:const[hbarc]`: a hoverable constant with its value and units (CODATA), ported from astrophysics' `C`;
  - `:particle[Z]`: a hoverable particle chip with its mass, width, lifetime and quantum numbers from the
    particle table;
  - `:::experiments`: *In the experiments*, how the production systems do it;
  - `::event{src views truth}`: an embedded event display, with *Open in the Control Room*;
  - `::pipeline{stages config}`: a compact pipeline run, with *Open in the Control Room*;
  - `::feynman{process}`: a diagram, drawn from its text description;
  - `::units`: the natural-units converter.
- **Code blocks:**
  - ` ```ts ` blocks are highlighted at build time and type-checked by the tests against `hep`;
  - ` ```ts live ` blocks are editable and runnable.
- **Exercises** (fenced YAML, as in Digital Circuits):
  - `code`: implement a function against hidden tests. On success, it can replace the reference in the
    pipeline;
  - `reaction`: allowed or forbidden, and by which law;
  - `diagram`: draw the Feynman diagrams for a process in the sketchpad;
  - `scan`: measure tracks on a chamber picture, within a tolerance;
  - `identify`: name the particles in an event display;
  - `cuts`: choose selection cuts to maximise the expected significance, against a par;
  - `trigger`: design a trigger menu within a rate budget, maximising signal efficiency;
  - `lattice`: design a stable beam line or ring that meets a target;
  - `fit`: fit a model to data, within a tolerance;
  - `fermi`: an order-of-magnitude estimate, accepted within a factor of about 3;
  - `quiz`, `predict`, `parsons`.

## Architecture

```
courses/particle-physics/
  docs/PLAN.md
  content/            outline.ts; chapters/<nn>-<slug>/{index.md, widgets/*.svelte};
                      YAML glossary, timeline, bibliography, terms, constants; the particle table (from the PDG)
  src/lib/hep/        the physics library, importable from the reader's code as 'hep/...'
    units/            natural units, constants, conversions
    random/           seeded generators, samplers (inverse transform, accept–reject, importance, VEGAS)
    kinematics/       four-vectors, boosts, rapidity, invariant mass, phase space
    particles/        the particle table, quantum numbers, decay tables
    event/            the event model: truth, simulation output, reconstructed objects, columnar tables
    machine/          optics, longitudinal dynamics, luminosity, pile-up
    gen/              matrix elements, parton distributions, shower, hadronisation, decays
    detector/         Onion: geometry, propagation, material effects, calorimetry, digitisation
    reco/             tracking, vertexing, clustering, objects, jets, missing pT, b-tagging, truth matching
    trigger/          L1 and HLT emulation, menus, rates
    analysis/         histograms, selections, fits, significance, limits
    data/             loaders for the shipped datasets
    worker.ts         Web Worker host for the pipeline
  src/lib/code/       the code-along harness (from Language Models): editor, TS language service, runner, tests
  src/lib/display/    the event display: 3D (WebGL2), r–φ, r–z, lego; truth–reconstruction linking
  src/lib/control/    the Control Room
  src/lib/feynman/    diagram model, vertex rules, enumeration, layout, SVG rendering
  src/lib/sims/       chambers, field lattice, lattice gauge demo, RF bucket, lattice designer, oscillations
  src/lib/audio/      Web Audio (Geiger clicks, muon beeps)
  src/lib/components/ content blocks, exercises, layout, ui
  tools/markdown/     Markdown → Svelte compiler (from Digital Circuits)
  scripts/data/       dataset preparation (Python, outside CI)
  scripts/validate/   comparisons with Pythia, MadGraph, FastJet and Delphes (outside CI)
  static/data/        dataset subsets, precomputed samples, and their manifest
  tests/
```

## Testing

- **Kinematics:**
  - property tests (fast-check): invariants are unchanged by boosts, and boosts compose;
  - every generated event conserves energy and momentum to 10⁻⁹ relative;
  - phase-space generators are flat (χ² tests with fixed seeds).
- **Physics:**
  - cross-sections against closed forms (σ(e⁺e⁻ → μ⁺μ⁻) = 86.8 nb / s in GeV²; the Z peak cross-section);
  - widths and branching ratios against the particle table;
  - generator distributions against MadGraph and Pythia, from fixtures produced outside CI and committed.
- **Detector:**
  - propagation against the analytic helix;
  - energy is conserved in showers;
  - measured resolutions match the configured parameters.
- **Reconstruction:**
  - tracking efficiency and fake rate on standard samples;
  - Kalman-filter pulls have unit width;
  - anti-kT jets are identical to FastJet's on fixture events.
- **Analysis:**
  - fits recover injected parameters without bias, with pulls of unit width;
  - asymptotic significances agree with pseudo-experiments.
- **Data:** loaders round-trip; manifest checksums match; every dataset records its licence.
- **Determinism:** seeded generators everywhere; worker results do not depend on how events are split
  between workers.
- **Content:**
  - every chapter compiles;
  - every exercise's reference solution passes;
  - every `code` exercise's starter code fails its hidden tests, so no test is vacuous;
  - every ` ```ts ` block type-checks.
- **Validation scripts** (outside CI):
  - `validate:gen`: cross-sections and distributions against MadGraph and Pythia;
  - `validate:jets`: anti-kT against FastJet;
  - `validate:detector`: Onion's resolutions against Delphes' CMS and ATLAS cards;
  - `validate:data`: the open-data analyses against the experiments' published results.
- **Before finishing a change:** `npm test`, `npm run check`, `npm run build`.

## Integration with the collection

- **Root `README.md`:** a row in the course table and the install line.
- **`scripts/build.mjs`:** build with `BASE_PATH=<base>/particle-physics` and copy to
  `dist/particle-physics/`.
- **`.github/workflows/deploy.yml`:** `npm ci` and the lockfile cache path.
- **`.github/workflows/particle-physics.yml`:** tests, check and build on changes under
  `courses/particle-physics/`.
- **`site/index.html` and `site/styles.css`:** the course card, under the *Physics* topic and marked *in
  progress* until M8, and the course count in the copy and meta description.
- **Theme:** the shared `theme` key in `localStorage`.
- **Cross-links:** to and from the astrophysics chapters listed in *Links to the astrophysics course*.

## Milestones

- [ ] **M0 — Foundations.**
  - SvelteKit shell and Markdown compiler (from Digital Circuits); the code-along harness (from Language
    Models).
  - "Tracks" design tokens and mockups; particle styles.
  - `hep`: units, constants, random, kinematics, the particle table, the event model.
  - The dimuon dataset: preparation script, manifest, loader.
  - Benchmarks for the performance targets.
  - **Chapter 2 (Relativity for particles) as the reference chapter.** It exercises a code exercise, real
    data (the dimuon map), a history card, a predict question and a Fermi estimate.
  - The course's `CLAUDE.md` and `docs/AUTHORING.md`.
- [ ] **M1 — Foundations, continued.**
  - Prologue and chapters 1, 3 and 4.
  - Generator v0 (particle gun, decays); the Rutherford simulation; Geiger clicks.
  - Appendices A–C.
  - Wired into the collection as *in progress*.
- [ ] **M2 — Seeing particles.**
  - Chapters 5–8.
  - Chambers (WebGL2); Onion's fast simulation; the event display; reconstruction v1; truth matching.
- [ ] **M3 — The zoo.**
  - Chapters 9–13.
  - Reaction judge; Eightfold Way puzzle; quark builder; parton distributions; scanning table; historic
    images.
- [ ] **M4 — Forces as fields.**
  - Chapters 14–18.
  - Field lattice; Feynman sketchpad and enumeration; e⁺e⁻ generator with matrix elements; toy shower and
    hadronisation; jets.
- [ ] **M5 — The machine.**
  - Chapters 19–21.
  - Optics toolkit; RF bucket; lattice designer; luminosity and pile-up; the machine stage; the Control Room.
- [ ] **M6 — The weak force.**
  - Chapters 22–25.
  - Drell–Yan, W and tt̄; missing pT; vertexing and b-tagging; the LEP lineshape; the dimuon map completed.
- [ ] **M7 — The Higgs boson.**
  - Chapters 26–30.
  - Trigger emulation and the trigger game; the analysis library; H → γγ and H → 4ℓ in simulation; the open
    data; the whole chain; precomputed samples; validation scripts.
- [ ] **M8 — Open questions and finish.**
  - Chapters 31–33; the lattice gauge demo; appendices D–H (timeline deck).
  - Accessibility, mobile and reduced-motion pass; fact-check and review pass; *in progress* label removed.

## Open questions

- **Names:** *Onion* for the detector is a working name.
- **Parton distributions:** which leading-order set to ship (licence and size), or a documented
  parametrisation instead.
- **Real data:** each dataset is confirmed (licence, size, what it shows) when its chapter is written.
- **Lattice gauge demo:** kept in Chapter 17 only if it runs well on integrated GPUs; otherwise a stretch
  goal after M8.
- **Heavy ions:** a section of Chapter 18 for now; perhaps a chapter of its own.
- **Design:** the display and prose typefaces, the palette, and the particle styles (with the M0 mockups).
- **Build it for real:** which phone app to recommend for the camera lab.
- **Permissions and digitising:** whether to ask BNL for the Ω⁻ photograph; whether to digitise the
  KamLAND and Super-Kamiokande L/E points or to simulate them.
