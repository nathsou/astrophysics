# `hep/shower`: parton shower

A toy parton shower for the course: a pT-ordered final-state shower built on the Sudakov veto algorithm, simplified
initial-state radiation, and the analytic ingredients (splitting functions, Sudakov form factor) that the chapter
widgets plot. Everything is seeded (`Rng`), allocation-light, and free of DOM/Node APIs.

```ts
import { shower, showerHistory, splitting, sudakov } from 'hep/shower';
shower(ev, rng, { fsr: true, isr: true, startScale: 91.2, cutoff: 1 });   // mutates ev in place
```

## Exported API

| name | what |
|---|---|
| `shower(ev, rng, opts?)` | ISR (if `opts.isr !== false`) then FSR (if `opts.fsr !== false`), in place. |
| `ShowerOptions` | `{ fsr?, isr?, startScale?, cutoff?, alphaSFixed?, nf?, noAngularOrdering? }` (see below). |
| `showerFsr`, `showerIsr` | the two halves, callable separately. |
| `showerHistory(ev)` | list of branchings `{ parent, daughters, z, pT, kind, isr }` for drawing the tree. |
| `isrRecords(ev)` | the raw ISR records (kept per event object). |
| `splitting.qq / .gg / .gq` | P_qq, P_gg, P_gq (z); plus `splitting.integralQq / integralGg / integralGq` (closed forms). `CF`, `CA`, `TR`. |
| `sudakov(t0, t1, { parton, E, alphaS, nf })` | analytic no-emission probability between pT² = t0 and t1. `emissionRate(t, …)` is its integrand. |
| `nextEmission(isGluon, E, tmax, tmin, rng, cfg, thetaMax?)` | one step of the veto algorithm: the next branching `{ t, z, kind, flavour }` or `null`. |
| `alphaSShower(t)`, `alphaSOver(t)`, `overestimateFactor()` | the coupling the shower uses, its analytic overestimate and the factor K between them. |
| `rescaleToTarget(p4s, masses, target)` | the exact-conservation rescaling (shared with the hadronisation). |

## What the shower acts on (contract with `gen`)

* **Outgoing partons** are the quarks (u…b) and gluons with `status: 'final'`, or `status: 'hard'` with no daughters that are
  not incoming partons. The top quark is never showered: decay it first (`decayHeavy` in `hep/decay`). Partons with
  `colour` labels `[colour, anticolour]` (positive integers, 0 = none) are connected into colour chains. If any parton lacks labels,
  a plausible colour flow is assigned (quarks paired with antiquarks, gluons in rapidity order) and written into the event.
* **Incoming partons** (for ISR) are particles with `status: 'hard'` whose mothers are all `'beam'` particles, collinear with the
  beam, one moving to +z and one to −z. `ev.sqrtS` must be the beam-beam energy. The hard system is every other particle that is not a beam
  particle (and belongs to collision 0).
* After the call, partons that branched are `'intermediate'` with two daughters (momentum = sum of the daughters, so the record is a
  consistent tree); the leaves are `'final'` partons with colour labels; ISR gluons are `'final'` with the incoming parton as mother.

## Final-state radiation

* **Systems.** Each closed colour chain (a singlet such as Z → qq̄, or a gluon ring such as H → gg) is showered on its own, in its
  own rest frame. All open chains (partons whose colour lines run to the incoming partons) are showered together as one system.
  A system with no mass (a lone parton) is not showered.
* **Evolution variable** t = pT², the transverse momentum of the emission relative to the parent direction, with z the energy fraction of
  the first daughter in the system's rest frame. Kinematic range z ∈ [pT/E, 1 − pT/E].
* **Splittings.** q → q g with P_qq = C_F(1 + z²)/(1 − z); g → g g with P_gg = C_A[z/(1 − z) + (1 − z)/z + z(1 − z)], counted over the full
  z range with no extra ½ (which gives the standard soft limit (αs/π) C_A dω/ω); g → q q̄ with T_R[z² + (1 − z)²], summed over the
  flavours u, d, s, c, b whose mass is below pT (nf = 5 asymptotically; set `nf` to fix the number, as the course text does).
* **Veto algorithm.** The emission density is overestimated by K · αs_o(t) (analytic one-loop, nf = 5, Λ from αs(mZ) = 0.118) times a
  z-integral of a simple majorant over the widest z range; trial scales come from the analytic inverse of the overestimated Sudakov;
  each trial is accepted with probability (true density)/(overestimate), which accounts for the coupling, the splitting
  function, the z range, the flavour thresholds and angular ordering. This is exact, and the test suite checks the first-emission
  pT² spectrum against the analytic Sudakov with a χ² test for quarks and gluons, fixed and running coupling.
* **Coupling.** `hep/sm`'s one-loop αs (nf thresholds at mc and mb, frozen below 1 GeV), tabulated on a log grid (`alphaSShower`). The
  overestimate factor K (≈ 1.5) covers the nf = 3 region below mc. `alphaSFixed` replaces it by a constant.
* **Starting scale.** `startScale` Q (default: the system's invariant mass) limits the first emission to pT ≤ Q/2, and never more than half
  the radiator's energy; daughters are ordered below the pT of the branching that made them. Cutoff: emissions stop below `cutoff`
  (default 1 GeV, minimum 0.5).
* **Angular ordering.** An emission from a daughter must have an opening angle pT/(z(1 − z)E) smaller than the opening angle of the
  branching that produced it (colour coherence in the small-angle approximation). Without it the cascade radiates too much at wide angles:
  the energy of a 100 GeV quark inside R = 0.4 drops from about 92 % to about 89.5 % of the quark energy (measured with a cone around the original axis).
* **Colour flow.** q[c,0] → q[n,0] g[c,n]; q̄[0,a] → q̄[0,n] g[n,a]; g[c,a] → g[c,n] g[n,a] (either way round, at random) or
  q[c,0] q̄[0,a]; `n` is a new label. A g → q q̄ splitting cuts a colour chain into two.
* **Recoil: exact rescaling.** The cascade leaves massless partons (u, d, s, g; c and b get their table masses) whose energies add up
  exactly but whose momenta do not. The leaves are boosted to the lab frame and `rescaleToTarget` makes them add up to the system's original
  four-momentum: go to the rest frame of their sum, scale all three-momenta by one factor ξ solving Σ√(m² + ξ²p²) = M_target, boost to the
  target's frame. Four-momentum is conserved to rounding (tested to 1e-9 relative; it is about 1e-14). The price: the recoil is spread over all
  partons of the system, not absorbed by a chosen spectator, and the root partons' momenta change to the sum of their descendants.

## Initial-state radiation (simplified)

Backward evolution of the two incoming partons with the same veto machinery, emitting gluons only (q → q g with P_qq, g → g g with 2C_A[…], the
standard DGLAP normalisation for backward evolution). The emission probability includes a toy parton-density ratio
((1 − x/z)/(1 − x))^β with β = 4 for quarks and 5 for gluons (shape f ∝ x⁻¹(1 − x)^β; no real PDF is used, since those live in `gen`), a
low-pT regularisation αs(pT² + pT0²) and a damping (pT²/(pT² + pT0²))² with pT0 = 2 GeV (value from memory of typical generator settings,
approximate), and the dipole rapidity limit 1 − z ≥ pT²/ŝ.

* **Recoil and conservation.** With light-cone components v± = E ± pz, an emission from leg a with fraction z sets A⁺ → A⁺/z for that leg; the gluon
  gets k⁺ = A⁺(1 − z)/z, k⁻ = pT²/k⁺; the hard system keeps its invariant mass m and its P⁺, takes P_T → P_T − kT, and P⁻ = (m² + P_T²)/P⁺, which
  fixes the other incoming parton's B⁻. At the end the hard system (every non-beam, non-incoming particle of collision 0) is moved by the Lorentz
  transformation that maps its original four-momentum onto the new one (same mass), the incoming partons are replaced by the new collinear
  momenta, and the gluons are appended. So Σ(incoming) = Σ(final) exactly (tested to 1e-8 or better). **The proton remnants are not modelled:** they
  are assumed to supply or absorb the longitudinal momentum that the incoming partons gain (the partons' x changes), and x ≤ 1 is enforced.
* **Tuning: pT ≤ Q/6.** The first ISR emission is limited to pT ≤ Q/6 (Q = hard system mass or `startScale`). With no matrix-element correction, starting at Q/2
  over-populates the hard tail (mean Z pT 17 GeV); Q/6 gives a mean pT of a Z made by qq̄ at √s = 13 TeV of about 8.5 GeV (the test demands 5–10 GeV;
  the measured value at the LHC is of the order of 10 GeV, and its hard tail is missing here). gg → H gets harder ISR than qq̄ → Z. This number is a
  tuning of the toy.
* **Colour.** The ISR gluon takes colour lines `[n, c]`, `[a, n]` or one of the two gluon options so that it connects to the outgoing
  partons of the hard process through the same labels the hard process used. Its other colour line runs to the proton remnant: in a hadronised
  event it is an *open* line, closed by the hadronisation with a stand-in remnant (see `hep/hadronise`).
* **Not done:** g → q q̄ and q → g q̄ backward conversions, ISR for non-coloured incoming particles (e⁺e⁻ events are left untouched), multiple
  parton interactions, and any matrix-element correction. ISR gluons can be showered by the FSR if they end up in a massive open system.

## Simplifications, stated plainly

Toy, not a generator: one-loop coupling; massless kinematics in the cascade (masses only enter the final rescaling); no quantum interference
beyond the angular ordering; no spin correlations; no mass-dependent (dead-cone) radiation from c and b; a global rescaling instead of
local recoil; ISR with no real PDFs and no matrix-element corrections. Parameter values that are quoted from memory (pT0, the
β of the PDF toy) are labelled as such. Speed: a 100 GeV qq̄ dijet event takes well under 0.1 ms in the shower, and the whole shower + hadronisation + decay
chain runs at well above 1000 events/s per core on a quiet machine (the test asserts 500).
