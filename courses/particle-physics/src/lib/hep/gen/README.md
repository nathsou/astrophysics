# `hep/gen` and `hep/sm`: the event generator and the Standard-Model inputs

Stage 2 of the pipeline. `hep/gen` turns a named process into truth events: a hard process at leading order, then the
parton shower (`hep/shower`), the toy Lund hadronisation (`hep/hadronise`) and the particle decays (`hep/decay`), with pile-up
overlaid. `hep/sm` holds the couplings, widths and constants the matrix elements use. Natural units, GeV; cross-sections
in **pb** unless a name says otherwise; lengths in mm. Every random number comes from a seeded `Rng`.

```ts
import { rng } from 'hep/random';
import { generate, crossSection, getProcess } from 'hep/gen';

const ev = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 20 }, rng(7));   // a TruthEvent
const xs = crossSection(getProcess('pp->ttbar'), 13000, 20000);              // { sigma, error, analytic, pull, nEvents } in pb
```

## Everything the course can ask for, by name

`listProcesses()` returns them; `getProcess(name)` returns the `Process`. `sqrtS` goes in the config, not the name.

| Name (aliases) | Process |
|---|---|
| `ee->mumu`, `ee->tautau`, `ee->qq` (`ee->hadrons`), `ee->uu` `dd` `ss` `cc` `bb` `tt` | e⁺e⁻ → f f̄ through γ and Z, with interference and the forward–backward asymmetry |
| `ee->mumu-qed` | e⁺e⁻ → μ⁺μ⁻ by photon exchange alone, α(0); the angular distribution comes from the hook `gen.dsigmaEeMuMu` |
| `ee->ee` (`bhabha`) | Bhabha scattering, s + t photon exchange, \|cosθ\| < 0.9 |
| `pp->Z->mumu`, `pp->Z->ee`, `pp->Z->tautau`, `ppbar->Z->mumu`, `ppbar->Z->ee` | Drell–Yan γ*/Z → ℓℓ, 60 < m < 120 GeV |
| `pp->W->munu`, `pp->W->enu`, `pp->W+->munu`, `pp->W-->munu`, `ppbar->W->munu` | W → ℓν |
| `pp->jj` (`pp->dijets`), `ppbar->jj` | QCD 2 → 2, five massless flavours and gluons, pT > 20 GeV |
| `pp->gammagamma` (`pp->diphoton`) | qq̄ → γγ and gg → γγ (box, approximate), pT > 20 GeV |
| `pp->H`, `pp->H->gammagamma`, `pp->H->ZZ->4l`, `pp->H->bb`, `pp->H->tautau`, `pp->H->WW->lnulnu` | gg → H in the effective vertex with the decay at matrix-element level |
| `pp->ttbar`, `pp->ttbar->dilepton`, `->leptonjets`, `->hadronic`, `ppbar->ttbar` | tt̄ with t → W b, W → ℓν or qq′ |
| `pp->Zprime->mumu` | a 3 TeV sequential Z′ on top of γ*/Z; other masses and couplings with `zPrime(spec)` |
| `minbias` | the toy minimum-bias collision (for pile-up) |

Factories give the variants: `drellYan({ lepton, mMin, mMax, beams, kFactor, zWidth, zPrime, signalOnly })`, `wBoson({ charge, lepton, mMin, mMax, beams, kFactor })`,
`zPrime(spec, options)`, `dijets({ ptMin, ptMax, beams, kFactor })`, `diphoton({ ptMin, ptMax, beams, kFactor, box })`,
`higgsGGF({ decay, mH, beams, kFactor })`, `ttbar({ decay, beams, kFactor, mt })`, `eeToFermions({ final, qedOnly, qcd, alpha, kFactor, zWidth })`,
`bhabha({ cosMax, kFactor })`, `minimumBias({ etaMax, k })`.

## API

### Generating

```ts
generate(process: Process | string, cfg: GenerateConfig, rng?: Rng): TruthEvent
interface GenerateConfig {
  sqrtS: number;            // GeV
  shower?: boolean;         // default true  (hep/shower)
  hadronise?: boolean;      // default true  (hep/hadronise)
  decay?: boolean;          // default true  (hep/decay: decayAll)
  pileup?: number;          // exactly this many extra minimum-bias collisions
  pileupMean?: number;      // or: a Poisson number with this mean (used if pileup is absent)
  seed?: number;            // used only if no rng is passed (default 1)
  isr?: boolean;            // e⁺e⁻ only: initial-state photon
  eventNumber?: number; weighted?: boolean; maxCtauMm?: number;
  beamSpot?: { sigmaZ?: number; sigmaXY?: number };   // mm; defaults 50 and 0.015
}
```

The record: `collision` is 0 for the hard scatter and 1, 2, … for pile-up; `primaryVertices[k]` is the vertex of collision k
(z Gaussian with σ = 50 mm, x and y with σ = 15 µm); every particle's `vertex` and `endVertex` are shifted to it. The pile-up
collisions are generated and decayed separately and then merged, so mothers and daughters never cross collisions.

### Processes, cross-sections, unweighting

```ts
interface Process {
  name: string; title: string; beams: 'ee' | 'pp' | 'ppbar';
  sigma(sqrtS: number): number;                         // pb, LO × K-factor; deterministic
  sigmaAnalytic?(sqrtS: number): number | undefined;    // closed form or quadrature, independent of the Monte Carlo
  weightedPoint(rng, cfg: ProcessConfig): number;       // one Monte Carlo point of the integral, pb
  generate(rng, cfg: ProcessConfig): { event: TruthEvent; weight: number };   // hard process only; weight 1 (pb if cfg.weighted)
}
crossSection(process, sqrtS, nEvents = 20000, rng = rng(1)): { sigma, error, analytic?, pull?, nEvents }   // Monte Carlo, in pb
getProcess(name), listProcesses(), registerProcess(names, factory)
kFactorFor(process, sqrtS, referencePb): number        // the K-factor that brings the LO cross-section to a reference value
```

Hadron-collider processes are built by `makeMCProcess` from a point specification; their VEGAS grids are trained lazily with a fixed seed
(the first `sigma` or `generate` at a new √s costs 0.1–2 s; dijets and γγ are the slowest) and cached, so results do not depend on call order.
Unweighted events are produced by accept–reject against a running maximum kept per `rng`.

```ts
class Vegas { constructor(dim: number, nb = 50); sample(rng, u: Float64Array): number /* jacobian */; adapt(alpha = 1.5): void;
              integrate(f: (u: Float64Array) => number, rng, { iterations, points, alpha, adapt }): { value, error, chi2, iterations, maxWeight } }
unweight(w: number, wMax: number, rng: Rng): boolean                  // the reference of the hook gen.unweight: accept with probability w/wMax
class Unweighter { constructor(initialMax = 0); accept(w: number, rng: Rng): boolean; state: { max, trials, accepted, overweight }; efficiency }
breitWignerMap(M, Gamma, lo, hi), powerMap(k, lo, hi), linearMap(lo, hi), mixMap([{ map, weight }])   // u ∈ [0,1] → x, with jacobian and density
gaussLegendre(n), integrateMapped(map, n, g)
```

### Parton distributions (`gen/pdf.ts`)

```ts
xf(pdg: number, x: number, Q: number, antiproton = false): number            // x·f(x, Q); pdg 1 d, 2 u, 3 s, 4 c, 5 b, 21 g, negative = antiquark
pdf(pdg, x, Q, antiproton?): number                                           // f(x, Q)
pdfAll(x, Q, out: Float64Array): Float64Array                                 // [d, d̄, u, ū, s, c, b, g]; s̄ = s, c̄ = c, b̄ = b
luminosity(tau, Q, flavours: [number, number][] | 'qqbar' | 'gg' | 'qg', antiproton = false): number   // dL/dτ, σ = ∫ dτ (dL/dτ) σ̂(τ s)
momentumFraction(pdgs, Q), numberFraction(pdgs, Q, signs?)                    // ∫x f dx and ∫ f dx, for the sum rules
```

**This is a pedagogical parametrisation, not a fit.** The input at Q₀ = 1.27 GeV is a set of hand-chosen shapes x q = A x^a (1 − x)^b (1 + γx) whose
normalisations follow from the sum rules; the evolution to higher Q is the real leading-order DGLAP equation (one-loop αs, nf = 4 then 5), solved once on
a grid and interpolated (cubic in ln 1/x, linear in ln Q²). Valid for Q from 1.27 GeV to 10 TeV (frozen outside), x from 10⁻⁶ to 1. Nothing was
downloaded and no published table was used. Expect 10–30 % differences from a real set in individual distributions.

### Hooks

| Hook | Signature | Reference | Where it acts |
|---|---|---|---|
| `gen.unweight` | `(w: number, wMax: number, rng: Rng) => boolean` | `unweight` | every hadron-collider process and the ISR sampler: the accept–reject decision |
| `gen.dsigmaEeMuMu` | `(s: number, cosTheta: number) => number` in GeV⁻² | `ee2mumuDiffXsec` = πα²(1 + cos²θ)/2s | `ee->mumu-qed`: events and `weightedPoint`, hence `crossSection` (while `sigma` stays the closed form 4πα²/3s, so a wrong function shows up as a large pull) |

The hooks are looked up at each call (`hook(name, reference)`), so installing the reader's version with `setOverride` takes effect at once.

### Helpers for building a process

`newEvent`, `addParticle`, `addBeams`, `decayAbout(parent, m1, m2, axis, cosθ, φ)`, `decayIsotropic` (= `kinematics.twoBodyDecay`), `boostZ`,
`conservation(ev, chargeOf)` (incoming minus outgoing four-momentum and charge of a hard-process record), `colourFlowValid(ev)` (Les Houches colour tags),
and the electroweak kernel `ewCoefficients`/`ewDiff`/`ewTotal`/`ewAfb` (`f f̄ → γ, Z, Z′ → f′ f̄′`, see `ewkernel.ts`).

## The hard-process record (what the shower, hadronisation and decays receive)

Particles 0 and 1 are the beams (status `beam`). For hadron collisions 2 and 3 are the incoming partons (`hard`, carrying x₁√s/2 and x₂√s/2, mothers = the beams); for e⁺e⁻ the
beams are the incoming particles. Resonances (γ*/Z = 23, Z′ = 32, W = ±24, H = 25, t = ±6) are `intermediate` with their daughters linked; outgoing particles
are `final`. Coloured partons carry `colour = [colour, anticolour]` in the Les Houches convention (tags from 101, leading-colour flows; where two flows are possible one is
chosen in proportion to the matrix-element terms). Momentum and charge are conserved between incoming and outgoing (1e-9, asserted for every process); the beam remnants of a hadron
collision are not recorded. A Higgs with `decay: 'none'` is left `final` for `decayAll`.

## What the matrix elements are

- **e⁺e⁻ → f f̄**: exact tree-level γ/Z amplitude with the final-state mass (helicity decomposition in `ewkernel.ts`), Z in the G_F scheme (e²/sin²θ_W cos²θ_W = 4√2 G_F mZ²), effective sin²θ_W = 0.23153,
  s-dependent Z width with the PDG value; photon exchange with α(0) by default (`alpha: 'running'` for α(√s)). Quark final states carry N_c = 3; `qcd: true` multiplies them by 1 + αs/π.
  ISR (`cfg.isr`): the exponentiated leading-log radiator, sampled with a three-channel mixture (soft photon, Z return, 1/s′); `sigmaISR(sqrtS)` gives the radiatively corrected cross-section.
- **Drell–Yan, W, Z′**: the same kernel with quark initial states (colour factor 1/3), α(m) running in the photon exchange, PDFs and α at the pair mass. No transverse recoil at LO: the lepton
  angle is measured in the parton frame (z along the beams), the shower supplies the pT. W: |V_ij|² G_F² mW⁴ ŝ (1 ± cosθ)²/(48π|ŝ − mW² + i mW ΓW|²) with the Wolfenstein CKM matrix.
  Z′: couplings in units of e/(sinθ_W cosθ_W), default those of the Z; the width is computed from the couplings unless given; interference with γ*/Z included unless `signalOnly`.
- **QCD 2 → 2, γγ**: the standard squared amplitudes (table in `qcd.ts`), αs and PDFs at Q = pT, one-loop αs.
- **gg → H**: heavy-top effective vertex, Γ(H → gg) = αs² mH³/(72π³v²), Breit–Wigner of width 4.1 MeV; decays at matrix-element level, with the full off-shell Z*/W* mass distribution and the
  spin correlations for ZZ* → 4ℓ and WW* → ℓνℓν (derived from conserved massless currents); γγ, bb̄, ττ isotropic.
- **tt̄**: LO gg and qq̄ with the top mass, αs and PDFs at Q = mt; t → W b with a Breit–Wigner W mass and the LO helicity fractions F₀ = 0.70, F_L = 0.30 for the lepton (or down-type quark) angle.
- **Minimum bias**: see the header of `minbias.ts`. dNch/dη(0) = 6.0 at 7 TeV, (√s)^0.23 scaling, negative-binomial multiplicity (k = 2), Tsallis pT with ⟨pT⟩ = 0.55 GeV, flat η plateau with Fermi edge,
  species 84 : 11 : 5, charge-balanced pairs, momentum not conserved. σ_inel = 72.5 mb + 9.7 mb ln(√s/7 TeV).

## What is verified against what

Against textbook or literature numbers I am sure of:

| Quantity | Result | Reference |
|---|---|---|
| σ(e⁺e⁻ → μ⁺μ⁻), photon exchange | 86.85 nb / s[GeV²] | 4πα²/3s, α = 1/137.036 (closed form, and the Monte Carlo integral of the differential formula) |
| α(0), α(mZ) | 1/137.036, 1/128.96 (QED running; the MS-bar value is 1/127.95) | PDG 1/128.95 for the on-shell-type running |
| Γ(Z → ℓℓ), Γ(Z → νν), Γ_Z at LO | 83.4 MeV, 165.9 MeV, 2.42 GeV (2.48 with 1 + αs/π) | measured 83.98 MeV, 167.1 MeV, 2495.5 MeV |
| Γ_W at LO / with QCD, Γ_t at LO | 2.044 / 2.096 GeV, 1.48 GeV | measured 2.085 GeV; table value of Γ_t 1.42 GeV |
| Γ(H → γγ), BR(H → 4ℓ) | 9.3 keV, 1.19 × 10⁻⁴ | table (0.227 % of 4.1 MeV), about 1.2 × 10⁻⁴ |
| σ0(had) at the Z pole, LO / with QCD factor | 39.5 nb / 41.0 nb | LEP deconvoluted pole value 41.54 nb (PDG, 12πΓeeΓhad/mZ²Γ²) |
| A_FB⁰(μ) at the pole | 0.0161 = ¾ A_e A_μ | measured 0.0171 ± 0.0010 |
| the radiative correction at the peak (ISR) | hadronic peak 30.2 nb, μμ 1.47 nb, i.e. the peak is **lowered** to 0.74 of the pole value | the brief expected a higher value with ISR; ISR lowers the peak and raises the cross-section above it |
| R = 2, 10/3, 11/3 plateaus; R(10 GeV) = 3.58 | yes | counting colours |
| CKM unitarity | 1e-10 | |
| W decay distributions | ⟨cosθ⟩ = −1/2 for ℓ⁺ (w.r.t. the u quark), +1/2 for ℓ⁻ | (1 ∓ cosθ)² from V − A |
| W helicity in t → W b | ⟨cosθ*⟩ = −0.15 for ℓ⁺, +0.15 for ℓ⁻ | −F_L/2 with the LO F_L = 0.303 |

Internal consistency only (two independent routes inside this code, or derived relations), **not** comparisons with data:

- Monte Carlo (VEGAS on the full differential cross-section) against the deterministic quadrature, for every process, asserted with pulls under 4.
- Crossing relations between the QCD matrix elements (gg → qq̄ vs qq̄ → gg, qg → qg vs qq̄ → gg, qq → qq vs qq̄ → qq̄) and the tt̄ closed-form σ̂ vs the integral of the differential formula.
- Narrow-width check of gg → H against the luminosity function; p p̄ W⁺/W⁻ ratio equal to 1 (CP).
- PDFs: momentum sum rule within 3 % from 2 GeV to 1 TeV (it is 1.000 to 0.999 by the evolution), ∫(u − ū) = 2, ∫(d − d̄) = 1, gluon momentum fraction 0.471 at Q = 10 GeV (asserted 0.45–0.50).

Leading-order cross-sections that come out (13 TeV): Z → μμ (60–120 GeV) 1.59 nb; W⁺ → μν 9.6 nb, W⁻ → μν 7.2 nb (ratio 1.34); gg → H 14.1 pb; tt̄ 439 pb; 7 TeV Z 0.79 nb; Tevatron p p̄ Z 0.20 nb.
They are "about right for leading order" (the higher-order corrections are 20–25 % for W and Z, a factor 1.9 for tt̄, about 3.4 for gg → H) and **no claim of agreement with any measurement is made.** The reference totals in
the docs of `higgs.ts` and `top.ts` (48.58 pb for gg → H, 831.76 pb for tt̄, both at 13 TeV) are quoted from memory of the LHC Higgs cross-section working group and the Top++ calculation: check them before citing.

Approximate or not modelled: the gg → γγ box normalisation (built from the light-by-light amplitude; not checked against a published number); the PDFs; the minimum-bias constants; no t–t̄ spin correlation; no identical-lepton
interference in H → 4ℓ; the lighter boson of H → VV* is cut at 4 GeV and the heavier at mH/2; Z, W and top widths in propagators are fixed numbers; no electroweak or QCD corrections beyond the optional factors.

## `hep/sm`

```ts
M_Z, GAMMA_Z, M_W, GAMMA_W, M_T, GAMMA_T, M_H, GAMMA_H, V_EW, G_F, ALPHA_0, ALPHA_S_MZ
SIN2W_EFF = 0.23153, SIN2W_MSBAR = 0.23122, SIN2W_ONSHELL                    // the default in the couplings is the effective one
alphaEM(Q): number                   // one loop, every charged fermion with its threshold: 1/137.036 at Q = 0, 1/128.96 at mZ (light quarks have an effective mass, M_LIGHT_EFFECTIVE = 0.08)
deltaAlpha(Q, part: 'all' | 'leptons' | 'hadrons'), vacuumPolarisationFunction(x)
alphaS(Q, loops: 1 | 2 = 2), alphaS1, alphaS2, nfActive(Q), beta0(nf), beta1(nf)   // αs(mZ) = 0.118, nf = 3…6, continuous at mc, mb, mt; frozen below 1 GeV
zCouplings(pdg, sin2w?): { Q, T3, gL, gR, gV, gA }, asymmetryParameter(pdg)
zPartialWidth(pdg, { qcd?, sin2w? }), zWidths(opts), zBranchingFractions(opts), wPartialWidth(a, b, { qcd? }), wTotalWidth({ qcd? }),
topWidth({ qcd?, mb?, mt? }), higgsWidths(mH = 125.2): { partial, total, br }     // LO; bb̄ and cc̄ with the mass run to mH
rRatio(sqrtS, { qcd? })              // photon exchange, N_c = 3, thresholds at 2 m_q
ckmMatrix(), ckmSquared(up, down), ckmAbs(up, down)                            // Wolfenstein λ = 0.22501, A = 0.826, ρ̄ = 0.159, η̄ = 0.348, built unitary
propagator(s, M, Gamma, running?), chi(s, M, Gamma, running = true), breitWignerDensity(s, M, Gamma), breitWignerPdf(m, M, Gamma), breitWignerPeak(M, Gamma, Gee, Gff)
sigmaPointGeV2(s, alpha?), sigmaMuMuQedNb(sqrtS)
```

## Performance (measured, asserted at half the target in the tests)

e⁺e⁻ → μ⁺μ⁻ hard events: about 600 000 per second (target 100 000). pp → Z → μμ hard events: about 27 000 per second (target 5 000). The full chain with shower, hadronisation and decays is dominated by
those stages: about 380 pp → Z → μμ events per second and about 28 000 e⁺e⁻ → μ⁺μ⁻ events per second on the machine used for development.

## Tests

`npx vitest run src/lib/hep/gen src/lib/hep/sm` (about 35 s, 162 tests, deterministic seeds).
