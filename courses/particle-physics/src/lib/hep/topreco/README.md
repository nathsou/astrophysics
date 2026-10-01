# `hep/topreco`: tt̄ → ℓ+jets reconstruction

Chapter 25's module. In tt̄ → (ℓ ν b)(q q′ b̄) the detector sees one charged lepton, missing transverse momentum and at least four jets, two of them
from b quarks. The job is to decide which jet is which. Import as `hep/topreco` (the reader's exercises) or `$lib/hep/topreco` (widgets). Natural units,
GeV; pure functions, no randomness.

```ts
import { assignTopJets, neutrinoPz, selectLeptonJets, reconstructTop, TOP_CHI2 } from 'hep/topreco';

const sel = selectLeptonJets(reco.objects, reco.met);                 // one isolated lepton, ≥ 4 jets, missing pT: or null
const a = assignTopJets(sel.jets, sel.lepton, sel.met, { btagPenalty: 10, maxJets: 6 });
a.mTopHad;  a.mTopLep;  a.chi2;  a.bLep; a.bHad; a.q1; a.q2;          // indices into sel.jets
```

## API

| Export | What it is |
|---|---|
| `TOP_CHI2` | The constants of the reference χ²: `mW` 80.4, `mT` 172.5, `sigmaW` 10, `sigmaT` 20 (GeV) and the b-tag threshold 0.5. |
| `neutrinoPz(lepton, met, mW?)` | The neutrino's longitudinal momentum from m(ℓν) = m_W, a quadratic with two roots: returns `{ pz, complex }`, the root of smaller \|p_z\|, or the real part (the double root) when the discriminant is negative (`complex: true`). The lepton is treated as massless. |
| `assignTopJetsReference(jets, lepton, met, opts?)` | The reference of the hook `reco.assignTopJets`: brute force over every (b_ℓ, b_h, {q, q′}) among the first `maxJets` (default 6) jets, minimising χ² = ((m_qq′ − m_W)/σ_W)² + ((m_qq′b − m_t)/σ_t)² + ((m_ℓνb − m_t)/σ_t)² + `btagPenalty` × (b-tag mismatches). Returns `{ bLep, bHad, q1, q2, chi2, mW, mTopHad, mTopLep, nuPz }` or null for fewer than four jets. q1 < q2. |
| `assignTopJets(...)` | The same through `hook('reco.assignTopJets', reference)`: the reader's function if installed. This is what the widgets call. |
| `assignmentCount(n)` | n (n − 1)(n − 2)(n − 3)/2: 12, 60, 180 for n = 4, 5, 6. |
| `selectLeptonJets(objects, met, opts?)` | Exactly one isolated electron or muon (p_T > 25, \|η\| < 2.5, relative track isolation < 0.15), at least four jets (p_T > 25, \|η\| < 2.5) and missing p_T > 20 GeV, from `RecoObject`s; returns `{ lepton, charge, kind, met, jets: {p, btag}[] }` sorted by jet p_T, or null. |
| `reconstructTop(objects, met, opts?)` | Selection and assignment in one call. |

`TopJet` is `{ p: P4, btag: number }`; a score above 0.5 counts as tagged.

## Hook

| Hook | Reference | Signature |
|---|---|---|
| `reco.assignTopJets` | `assignTopJetsReference` | `(jets: TopJet[], lepton: P4, met: {x, y}, opts?: { btagPenalty?, maxJets? }) => Assignment \| null` |

## What is and is not modelled

- The neutrino's p_z is the smaller-magnitude root of the W-mass quadratic. It is the wrong root in about half of the events (the tests measure the fraction at parton level: between 40 % and 95 %), so the leptonic top mass is less accurate than the hadronic one. Better methods fit both roots, or the full event with constraints.
- σ_W = 10 GeV and σ_t = 20 GeV are round numbers, not fitted resolutions: the jets of the course detector are smeared more than that (the three-jet mass of correct assignments has a 16 %–84 % range of about 147–204 GeV). They set the relative weight of the three terms.
- No t–t̄ spin correlation, no jet-energy corrections, no treatment of a missing or merged jet, no kinematic fit of the jet momenta, no combination of the lepton charge with the b-tag to resolve ambiguity. The χ² uses the W and top masses as inputs, which biases a measurement of the top mass (the best assignment is the one nearest 172.5): it finds the right assignment, it does not measure the mass.

## The sample behind Chapter 25's figure

`src/lib/sims/part6/topSample.ts` (made by `makeTopSample.ts`; 4 seeds × 350 generated events through `hep/gen` `pp->ttbar->leptonjets` at 13 TeV with shower and hadronisation, the `onion` detector,
`hep/reco`) holds the 591 events that pass the selection (42 % of the generated l+jets events), with for each jet the truth role (b of the leptonic top, b of the hadronic top, quark of the W) by ΔR < 0.4
matching to the generator's partons. In 29 % of the selected events all four quark jets are among the selected jets; the jet multiplicity is high (7.3 jets above 25 GeV on average), which is the toy parton shower's doing.
With six jets the χ² finds the correct assignment in about 17 % of the events where it exists, and in about 35 % with a b-tag penalty of 5 or more.

## Tests

`npx vitest run src/lib/hep/topreco` (about 2 s, fixed seeds): `neutrinoPz` reproduces m(ℓν) = m_W; one of its roots is the true p_z in 40–95 % of parton-level events; a negative discriminant gives the real part; the assignment counts 12, 60, 180; null with fewer than four jets;
the reported χ² equals a brute-force evaluation of the formula, and is its minimum; with exact four-vectors the true assignment is found in more than 70 % of events; a large penalty puts the tagged jets in the b roles; `maxJets` and the hook are honoured; the selection.
