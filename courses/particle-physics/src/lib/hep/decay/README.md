# `hep/decay`: particle decays

Decays every unstable particle of a truth event according to the particle table (`hep/particles`: `Decay.br`, `products`, lifetimes, widths), recursively,
with decay points from the lifetime and exact conservation of four-momentum, charge, baryon number and lepton number.

```ts
import { decayAll, decayParticle, sampleMass } from 'hep/decay';
decayAll(ev, rng);                               // default policy
decayAll(ev, rng, { maxCtauMm: Infinity });      // decay even μ, π±, K±, n
decayParticle(ev, index, rng, [x, y, z]);        // decay one particle now, at a chosen point (detector: decay in flight)
```

## Exported API

| name | what |
|---|---|
| `decayAll(ev, rng, opts?)` | `DecayOptions = { maxCtauMm?, only?, partons? }`. |
| `decayParticle(ev, index, rng, at?)` | decay one `'final'` particle whatever the policy says; `at` (mm) overrides the exponential decay point. Returns false if it is stable, unknown, or has no mode open at its mass. Daughters are not decayed further. |
| `decayHeavy(ev, rng)` | decay only t, Z, W, H (recursively) and leave their quarks and gluons as `'final'` partons with colour labels, for `shower` and `hadronise`. |
| `wouldDecay(particle, opts?)` | the policy as a predicate. |
| `properCtauMm(pdg)`, `meanDecayLengthMm(pdg, p4)` | cτ and βγcτ in mm, for the detector model. |
| `sampleMass(pdg, rng, { min?, max?, nWidths? })` | a Breit–Wigner mass for a resonance (nominal for narrow particles). `isResonance(pdg)`, `minMass(pdg)`. |
| `uniformPhaseSpace(rng, total, masses)` | unweighted n-body phase space (GENBOD). |
| `DEFAULT_MAX_PROPER_CTAU_MM` | 100. |

## Policy: what decays

* **Default** (no `maxCtauMm`): a `'final'` particle with at least one decay mode decays if its **proper** decay length cτ is at most 100 mm. That decays π⁰, η, η′, every resonance (ρ, ω, φ, Δ, Σ⁰,
  ψ, Υ …), heavy flavour (D, B, Λ_c, Λ_b, τ), K_S (cτ = 27 mm), Λ (79 mm), Σ± (24 and 44 mm), Ξ (87 and 49 mm), Ω (25 mm), and t, W, Z, H, and **leaves μ, π±, K±, K_L and n** as `'final'`
  (cτ = 659 m, 7.8 m, 3.7 m, 15 m, 2.6 × 10¹⁴ mm). The detector decays those in flight with `decayParticle`, using `meanDecayLengthMm` and `particle(pdg).lifetime`. (The task's "10 mm" and its own list, which includes K_S, Λ
  and Ξ, disagree: the list wins, and 100 mm is the smallest round number that includes them.) Protons, electrons, photons and neutrinos are stable in the table.
* **`maxCtauMm` given**: a particle decays if its mean **lab** decay length βγcτ is at most that many mm, so `maxCtauMm: Infinity` decays everything that has a mode in the table (μ, π±, K±, K_L, n included), and a finite value
  leaves fast long-lived particles alone. Whether a particle decays is decided from the mean length; the actual decay point is then drawn from the exponential law, so a particle can decay beyond `maxCtauMm`.
* Particles that do not decay keep status `'final'` and have no `endVertex`. Particles that decay get status `'decayed'`, `endVertex` = production vertex + (p/m) cτ with cτ drawn from an exponential of mean cτ, and daughters
  (`'final'`, `mothers` = [parent], vertex = the parent's end vertex, same `collision`), which are decayed in turn.
* **Quarks and gluons produced by decays** (t → W b, Z → qq̄, H → bb̄, gg, Υ → ggg) are given colour labels: the b of t → W b inherits the top's colour; q q̄ pairs are colour singlets (`[c,0]`, `[0,c]`); n gluons form a ring.
  Unless `partons: 'leave'`, `decayAll` then runs `shower` (FSR only) and `hadronise` on them and continues decaying the hadrons. So `decayAll` after `hadronise` is all a caller needs; `decayHeavy` before `shower` is the
  physically better order when the hard process leaves t, W, Z or H undecayed.

## Decay dynamics

* The mode is chosen by `br` among the modes open at the parent's mass (sum of the products' lowest masses below it), renormalised: modes are dropped, not suppressed, at threshold. The table's modes are a reduced list and some branching
  fractions do not sum to one (D⁰ sums to 0.969); the renormalisation hides that.
* **Matrix elements are omitted.** Two-body decays are isotropic in the parent's rest frame; three or more bodies are uniform Lorentz-invariant phase space (n-body GENBOD with an analytic weight bound, unweighted by accept–reject, so no
  bias and no running maximum: `uniformPhaseSpace`, tested against the weighted RAMBO `phaseSpace` of the kinematics module). The only special cases: π⁰ → γγ is isotropic (which is what the above gives); τ → ℓνν and
  π ν modes use phase space too (no polarisation, no V − A spectrum); the Dalitz decay π⁰ → γ e⁺e⁻ and the 3- and 4-body modes have flat phase space instead of their real form-factor spectra; the W, Z, H decays are isotropic, **so the Z → ℓℓ and W → ℓν
  angular distributions and spin correlations (H → ZZ* → 4ℓ) are not produced here**: the generator must do them at production.
* **Resonances** (width above 1 MeV: Z, W, t, H, ρ, ω, φ, Δ) are given a Breit–Wigner mass when they are created as *daughters*: for the top's W, for the W and W* of H → WW*, and so on. `sampleMass` draws from the constant-width
  Cauchy distribution truncated to m ± 5Γ and to the available energy (and, if the allowed range lies outside that window, from its tail down to the threshold: the W* of a 125 GeV Higgs has a mass below 45 GeV). The lower limit of a resonance mass is
  the lowest total product mass over the modes with at least 2 % branching fraction, so a ρ is never lighter than 2mπ. A two-body decay with a resonance is further weighted by the decay momentum (accept–reject). A particle that already
  exists in the event (a Z from the generator, a ρ from the hadronisation) decays with the mass of its four-momentum, whatever it is. The hadronisation draws its resonance masses from `sampleMass` (window ±2Γ).
* Decay lengths use the table's lifetimes (`lifetime` = ħ/Γ where only a width is given). There is no time coordinate in the truth record (vertices are 3-vectors in mm).

## Tests

`decay.test.ts`: every mode of every particle conserves charge, baryon and lepton number (table consistency); every particle with decays, at rest and in flight, conserves four-momentum to 1e-9 and the same
quantum numbers through the full recursive chain; the policy; vertices (mean decay length of K_S over 6000 decays to 5 %); π⁰ → γγ fraction and isotropy; the τ and K⁺ branching fractions; GENBOD against RAMBO; the
Breit–Wigner shape; colour assignment for t → W b and Z → qq̄; H → WW*.
