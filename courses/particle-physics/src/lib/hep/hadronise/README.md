# `hep/hadronise`: a toy Lund string

Turns the coloured partons of an event into hadrons. Each colour-connected chain of partons becomes a string, every string is
broken iteratively into hadrons in its rest frame (Lund symmetric fragmentation function, Gaussian pT, flavours from a table),
and a final rescaling makes the hadrons of each string system add up exactly to the four-momentum of its partons.

```ts
import { hadronise } from 'hep/hadronise';
hadronise(ev, rng);            // mutates ev: partons become 'intermediate', hadrons (status 'final') are appended
```

## Exported API

| name | what |
|---|---|
| `hadronise(ev, rng, opts?)` | the event-level hadronisation. `HadroniseOptions` = any of the `LundParams` below, plus `remnantEnergy` (0.25 GeV) and `onReport(r)`. |
| `stringTension` | κ = 0.2 GeV² (≈ 1 GeV/fm). |
| `stringBreaking(distanceFm, opts?)` | for the pulling-apart widget: potential energy V = κ r (GeV), pair threshold, expected number of breaks and the probability of breaking (`probability`, and `probabilityStrange`). |
| `lundStringSnapshot(ev)` | the strings of an event hadronised by `hadronise`: for each string its partons and, per segment, the sequence of break points (light-cone and (t, z) coordinates in fm, created pair flavour) and hadron light-cone momenta. Kept per event object (empty for a copy or a worker-serialised event). |
| `simulateString(rng, W, quark?, par?)` | the same snapshot for a stand-alone q q̄ string of energy W, without building an event (for a widget). |
| `fragmentString(rng, W, leftEnd, rightEnd, par?)` | the string breaking itself (hadrons in the string frame, not rescaled). |
| `sampleLundZ(rng, mT², a, b)`, `samplePeterson(rng, ε)` | the fragmentation functions. |
| `hadronFor(content, rng, par)`, `candidates(content)`, `lightestMass(content)` | hadron species from a quark content such as `[2, -1]` (u d̄). |
| `outgoingPartons(ev)`, `buildChains(ev, idx)` | which partons are hadronised and how colour labels connect them. |

## What it acts on (contract with `gen` and `shower`)

Outgoing coloured partons: quarks (u…b) and gluons with `status: 'final'`, or `'hard'` with no daughters that are not incoming. Top quarks are
left alone (decay them first). Colour labels `[colour, anticolour]` define the chains: parton i is followed by the parton whose *anti*colour equals
i's colour. If labels are missing a plausible flow is assigned (see `hep/shower`). After the call the partons are `'intermediate'` (daughters = the
hadrons of their string), the hadrons are `'final'` with the partons of their string as mothers and the first parton's production vertex.
Unstable hadrons (ρ, ω, K*…, π⁰, K_S, Λ …) are left for `decayAll`.

## Algorithm

1. **Strings.** A chain q–g–…–g–q̄ (closed), a ring of gluons (H → gg: opened by splitting one gluon into a collinear q q̄ pair sharing its momentum), or an *open*
   chain whose colour line ends on a parton that is not in the list (see below).
2. **Segments.** A string with gluons is cut into two-ended q q̄ segments: every gluon is split into a collinear q q̄ pair of a random light flavour
   (u : d : s = 1 : 1 : 0.3) that shares its momentum equally between the two adjacent segments. The segments add up to the string momentum exactly and the flavours
   cancel. This is closer to the cluster picture (preconfinement) than to the true Lund kinked string, but keeps the hadron flow along the colour-connected
   dipoles. Segments too light to make a hadron of their flavour (mass < lightest hadron + 0.15 GeV) are merged with a neighbour: the gluon between them is then taken whole.
3. **Breaking a segment**, in its rest frame (quark end along +z, light-cone P⁺ = P⁻ = W, P_T = 0). Repeat while the remaining mass is above `stopMass`:
   pick an end at random; draw a new pair u/d/s with weights 1 : 1 : `probStrange`, or with probability `probDiquark` a diquark–antidiquark pair (not if the end is already a
   diquark, to avoid four-quark hadrons); the pair's transverse momentum k is Gaussian; the hadron made of the end and the pair's partner has
   p_T = k_end − k and takes the light-cone fraction z of the remaining P⁺ (or P⁻ from the other end) with p⁻ = m⊥²/p⁺, where z follows f(z) ∝ (1/z)(1 − z)^a exp(−b m⊥²/z).
   A draw is kept only if the rest of the string can still make at least the lightest hadron (or the lightest two hadrons) of its flavour. The last one or two hadrons are made
   from what remains: two hadrons (with a u/d/s pair inserted, preferring lighter species when the mass is tight) by an isotropic two-body decay of the remnant, else one.
4. **Hadron species** (`flavour.ts`): pseudoscalar or vector mesons 1 : 3 for ud̄ and the neutral light mesons (π⁰, η, η′ / ρ⁰, ω / φ; the η–η′ mixing uses θ_P ≈ −11.5°, approximate), baryons from
   three quarks, octet or decuplet (Δ, Ω⁻ from uuu, ddd, sss) with `decupletFraction` for uud and udd. Resonances get a Breit–Wigner mass (window ±2Γ) from `hep/decay`'s `sampleMass`.
5. **Heavy quarks.** A hadron made from a c or b end takes z from the Peterson function f(z) ∝ 1/(z(1 − 1/z − ε/(1 − z))²) with ε_c = 0.05 and ε_b = 0.005 (typical fitted values from memory; approximate).
   Peterson was chosen over Bowler because it has one parameter per flavour and a closed form; in a bare string (no shower) at 91 GeV the leading c and b hadrons carry on average 0.78 and 0.91 of the quark's energy, against 0.66 for a light quark (real fragmentation functions are softer, about 0.7 for both heavy flavours, and the shower lowers these numbers; the ε values were not refitted).
6. **Final rescaling (exact conservation).** All hadrons of a string system are given the string's four-momentum by `rescaleToTarget`: go to the rest frame of the hadron sum, scale every three-momentum by the same
   factor ξ with Σ√(m² + ξ²p²) = M, boost to the string's frame. The hadron masses are kept. Energy–momentum is then conserved to rounding error (about 1e-14; tested to 1e-9 relative), charge, baryon number and flavour
   are conserved by construction (the tests compare the net number of each quark flavour, and charge, baryon number, strangeness and charm from the particle table, for thousands of random systems). ξ differs from 1 by a fraction of the
   remaining-string mass over W, so the hadron spectra are not visibly changed.
7. **Low-mass systems.** A string that cannot stand alone (fewer than two hadrons, or hadron masses above its mass) is regenerated a few times, then its hadrons are rescaled together with another string (the one that leaves most room):
   `report.merged` counts these. If even that fails (a lone system lighter than its lightest hadron of that flavour: for example a 0.3 GeV uū, or a 9 GeV bb̄) the hadrons are given the energy they need and
   that energy is reported in `report.borrowedEnergy` (total energy rises by that amount, three-momentum is kept). Thousands of such systems are tested for termination and conservation.

## Open colour lines (partons connected to the beams)

In pp events the colour line of an outgoing parton can run to an incoming parton, that is, to the beam remnant, which is not modelled. Such an *open* chain is closed on a massless stand-in
remnant along the beam (quark or antiquark of random light flavour, or a q q̄ pair of the same flavour for a chain of gluons only), carrying `remnantEnergy` (0.25 GeV) each, so that the string has a mass.
Consequences, stated plainly: transverse momentum is conserved exactly, but the hadrons carry `remnantEnergy` more energy (and along the beam, pz) per open end than the partons did, and for a chain
with a net quark number the flavour bookkeeping includes the stand-in (an open quark chain hadronises with an extra antiquark of random flavour). `report.remnants` counts the stand-ins. Closed systems are exact.

## Parameters (defaults)

| parameter | default | source |
|---|---|---|
| `a`, `b` (Lund function) | 0.68, 0.98 GeV⁻² | typical Pythia 8 defaults, from memory, approximate |
| `sigma` (pair pT) | 0.33 GeV | from memory, approximate; the pT² distribution is exp(−pT²/σ²), i.e. σ/√2 per component |
| `probStrange` | 0.3 | older Pythia value as requested, from memory (recent tunes use about 0.22) |
| `probDiquark` | 0.1 | as requested |
| `vectorFraction` | 0.75 | 3 : 1 spin counting |
| `decupletFraction` | 0.4 | a choice, not a fit |
| `stopMass` | 1.0 GeV | from memory of the Pythia default, approximate |
| `epsilonC`, `epsilonB` (Peterson) | 0.05, 0.005 | typical fitted values, from memory, approximate |
| `remnantEnergy` | 0.25 GeV | a choice |

## What the table lacks

Missing hadrons are replaced by the closest one that carries the same flavour, so flavour is always conserved: the **vector K\*, D\*, B\*** are replaced by K, D, B (so vector fractions apply only to ud̄ mesons
and the neutral light mesons, and kaons come out in the pseudoscalar state); **no B_c** (a b c̄ end is split into two hadrons); **no Σ\*, Ξ\*, Σ_c, Ξ_c, Ω_c, Σ_b …** (a c or b quark forms a baryon only with a ud diquark: Λ_c⁺ or
Λ_b; other diquark pairs are redrawn); **no η_c, χ, η_b** (the cc̄ and bb̄ diagonal states are J/ψ and Υ(1S)); η′ has no quark string in the table. Net effect: too few vector mesons
and heavy baryons. Results at 91 GeV with shower and decays: about 16 charged particles per event (LEP measures about 21), K±/π± ≈ 0.12, baryons ≈ 9 % of the hadrons.

## The string picture (widget functions)

`stringBreaking(r)`: V = κ r, with κ = 0.2 GeV² = 1.01 GeV/fm (so 1 fm stores 1 GeV, enough for a pion pair, which is why strings break). A pair can only appear if V exceeds 2 m⊥ (m⊥ = 0.4 GeV for u, d, 0.55 GeV
for s, a typical transverse mass: an estimate) and then tunnels with the Schwinger rate per unit length and time w = (κ/2π) exp(−π m⊥²/κ) (leading term, fermions in 1 + 1 dimensions); pulling the ends apart at the speed of light gives
N(r) = w (r − r₀) r with r₀ = 2 m⊥/κ, and the probability is 1 − e^(−N). It gives 15 % at 2 fm, 57 % at 4 fm and 87 % at 6 fm (for light pairs, pulled apart at the speed of light; a static heavy-quark pair breaks at a shorter distance, which this estimate does not attempt to reproduce). An estimate for illustration, not a tuned quantity.
`lundStringSnapshot`: break k between hadrons k and k + 1 (ordered from the quark end) is at x⁺ = (W − Σ_{j ≤ k} p⁺_j)/κ, x⁻ = Σ_{j ≤ k} p⁻_j/κ, t = (x⁺ + x⁻)/2, z = (x⁺ − x⁻)/2, in fm.

## Known issue in a shared file

`particles`: Λ_b (PDG 5122) has `bottom: 1`, but it contains a b quark, which the same table gives `bottom: −1` (compare B⁰ = d b̄, `bottom: 1`). The tests therefore check flavour conservation from the quark
content and use the table's charge, baryon number, strangeness and charm only.
