# hep/diagrams: Feynman diagrams as data

Pure TypeScript (no DOM, no randomness). Import in an exercise as `import * as d from 'hep/diagrams'`.

## The model

A `Diagram` is a graph: `initial` and `final` (PDG IDs of the process, antiparticles negative), `nodes` (external legs `in`/`out`
carrying the physical particle, and interaction `vertex`es) and `edges` `{ id, from, to, pdg }`: the particle `pdg` travels from `from` to `to`.
For a fermion that is the arrow. An antifermion moving forward in time is an edge against the flow of time, and `{from: A, to: B, pdg: -11}`
is the same line as `{from: B, to: A, pdg: 11}`. γ, g, Z, H have no direction; W⁺ from A to B is W⁻ from B to A.

All conservation laws are checked in the *all-incoming convention*: the lines meeting at a vertex are listed as particles flowing into it (an
outgoing e⁻ enters as e⁺), so a vertex is allowed only if the labels sum to zero in charge, baryon number and each lepton number, and have one
fermion arrow in and one out. `e⁻ → e⁻ γ` is the triple `(11, -11, 22)`.

## API

| Function | What it does |
|---|---|
| `parseProcess("e+ e- > mu+ mu-")`, `tryParseProcess`, `formatProcess`, `processSymbols` | text form ↔ `{initial, final}`; accepts `e-`, `mu+`, `nu_e~`, `anti-u`, `ubar`, `γ`, `μ⁺`, `W-`, `Z`, `H`, `g`, separators `>`, `->`, `→` |
| `symbolOf(pdg)`, `particleLabel(pdg)`, `asciiName(pdg)` | Unicode symbol (`e⁺`, `ν̄_e`), structured label (base, sub, sup, bar), ASCII name |
| `VERTEX_RULES`, `vertexRule(id)` | the vertex table (below) |
| `matchVertex(labels, ctx)` | the rule for a set of lines, or `null`; `ctx`: `forces`, `ckm: 'auto'|'diagonal'|'full'`, `minYukawaMass` |
| `checkVertex(labels, ctx)` | `{ ok, rule, reasons: [{code, message}], notes }`: why a vertex is forbidden (charge, arrows, lepton flavour/generation, baryon number, colour, photon–neutrino, gluon–lepton, Higgs–neutrino, flavour change, neutral bosons) |
| `emptyDiagram`, `addVertex`, `addEdge`, `removeEdge`, `removeVertex`, `setEdgeParticle`, `reverseEdge`, `buildDiagram(process, [[from, to, pdg]…])` | pure editing functions (a UI can keep an undo stack); `buildDiagram` names nodes `in0 out1 v0` |
| `validateDiagram(d)` | `{ ok, complete, valid, issues, vertices, order, loops, connected }`; every issue names the node or line and says why, in words |
| `diagramOrder(d)`, `orderLabel`, `amplitudeOrderLabel` | order in the couplings: `{ ew, s, total, alpha, alphaS, loops }`; `α²` for e⁺e⁻ → μ⁺μ⁻ |
| `estimateRate(d)`, `rankDiagrams(ds)` | coupling-only size of a diagram (product of squared coupling strengths); ranking |
| `crossing(d, 'in'|'out', index)`, `crossProcess` | move a leg across the arrow and replace it by its antiparticle; the graph is untouched |
| `enumerateTreeDiagrams(initial, final, opts)` | every connected tree diagram, labelled legs, deterministic order (fewer contact vertices first, then s, t, u, then γ before Z) |
| `enumerateOneLoopDiagrams(initial, final, opts)`, `countOneLoopDiagrams` | one-loop diagrams of a small process (see below) |
| `LOOP_INDUCED`, `loopInducedEntry`, `loopInducedDiagrams` | processes with no tree diagram: gg → H, H → gg, H → γγ |
| `canonicalForm(d, {labelledLegs})`, `sameDiagram(a, b)`, `findDiagram(list, d)`, `dedupe` | graph isomorphism respecting particles and arrows (legs labelled by position by default) |
| `symmetryFactor(d)`, `automorphismCount`, `identicalParticleFactor(final)` | 1/\|Aut\| (1 for labelled trees, 1/2 for a gluon bubble), and 1/n! for identical final-state particles |
| `describeDiagram(d)`, `channels(d)` | "s-channel γ", "γ radiated from the final-state μ⁻", "box (loop of e⁻, γ)" … |
| `matchAnswerKey(drawn, key, foundBefore)` | which key diagram a finished drawing is |

Options of the enumerators: `forces` (default `['qed','qcd','weak']`, plus `'higgs'` when the process contains an H; `'fermi'` adds the four-fermion
contact vertex), `maxOrder` (total power of couplings, or `{ ew, s }`), `ckm` (`'auto'` default: W vertices are generation-diagonal on internal lines, but a
W vertex whose two quark lines are both external may be off-diagonal), `minYukawaMass` (GeV, default 0.01: lighter fermions do not couple to H, which
removes e⁺e⁻H), and for loops `loopParticles` and `keepExternalSelfEnergies`.

## Vertex table

Amplitude order: powers of the coupling in the amplitude. A diagram whose vertices have total order n has a rate ∝ α^n (electroweak) or α_s^n (strong), so each cubic vertex contributes α^½.

| Vertex | Force | Coupling | Amplitude order | Conserves flavour | ∝ mass |
|---|---|---|---|---|---|
| f f̄ γ | qed | e Q_f | e | yes | no |
| W⁺ W⁻ γ | qed | e | e | yes | no |
| W⁺ W⁻ γ γ | qed | e² | e² | yes | no |
| q q̄ g | qcd | g_s | g_s | yes | no |
| g g g | qcd | g_s | g_s | yes | no |
| g g g g | qcd | g_s² | g_s² | yes | no |
| f f̄ Z | weak | g/cos θ_W · (g_V − g_A γ⁵) | e | yes | no |
| f f′ W | weak | g/√2 · V_ij | e | no: generation mixing through CKM | no |
| W⁺ W⁻ Z | weak | g cos θ_W | e | yes | no |
| W⁺ W⁻ γ Z | qed + weak | e g cos θ_W | e² | yes | no |
| W⁺ W⁻ Z Z | weak | g² cos² θ_W | e² | yes | no |
| W⁺ W⁻ W⁺ W⁻ | weak | g² | e² | yes | no |
| f f̄ H | higgs | m_f / v (y_f = √2 m_f / v) | e | yes | yes |
| W⁺ W⁻ H | higgs | g m_W | e | yes | yes |
| Z Z H | higgs | g m_Z / cos θ_W | e | yes | yes |
| H H H | higgs | 3 m_H² / v | e | yes | yes |
| H H H H | higgs | 3 m_H² / v² | e² | yes | yes |
| W⁺ W⁻ H H | higgs | g²/2 | e² | yes | no |
| Z Z H H | higgs | g²/(2 cos² θ_W) | e² | yes | no |
| Fermi contact (four charged-current fermions) | fermi | G_F/√2 | e² (effective) | no | no |

Every vertex conserves electric charge. "e" stands for any electroweak coupling (e, g, g′, a Yukawa coupling): they are all proportional to e with
factors of order one, so all count as one power of the electroweak coupling. The absent vertices matter as much: no γγγ, γγZ, γZZ, ZZZ (neutral bosons carry no charge), no
Hγγ or Hgg (massless gauge bosons; these are loop-induced), no flavour-changing Z or photon vertex, no vertex that turns a quark into a lepton.

## Counts verified (tests in `enumerate.test.ts`)

| Process | Tree diagrams |
|---|---|
| e⁺e⁻ → μ⁺μ⁻ | 2 (s-channel γ and Z); 1 with QED alone |
| Bhabha e⁺e⁻ → e⁺e⁻ | 2 (s and t) with QED alone; 4 with the Z as well |
| Møller e⁻e⁻ → e⁻e⁻ | 2 (t and u) with QED alone; 4 with the Z |
| e⁺e⁻ → μ⁺μ⁻γ | 4 with QED alone (photon off e⁻, e⁺, μ⁻ or μ⁺ with one s-channel photon; the radiated photon cannot come off the virtual photon: there is no γγγ vertex); 8 with the Z as well |
| e⁺e⁻ → μ⁺μ⁻γγ (QED) | 20 = 6 (both photons on the e line: 3!) + 6 (both on the μ line) + 8 (one on each: 2 × 2 × 2) |
| γγ → e⁺e⁻, e⁺e⁻ → γγ, Compton | 2 each |
| qq̄ → gg | 3 (s with the triple-gluon vertex, t, u) |
| gg → gg, gg → ggg, gg → gggg, qq̄ → ggg | 4, 25, 220, 16 (the known numbers) |
| e⁺e⁻ → W⁺W⁻ | 3 (s-channel γ, Z; t-channel ν); 2 without the γ |
| e⁺e⁻ → ZH | 1 (Higgs-strahlung); 3 if the e⁺e⁻H Yukawa vertex is kept (`minYukawaMass: 0`) |
| ud̄ → e⁺ν_e; d → u e⁻ ν̄_e; μ⁻ → e⁻ ν̄_e ν_μ | 1 each (W); the muon decay also has 1 Fermi contact diagram with `forces: ['fermi']` |
| e⁺e⁻ → μ⁺μ⁻ at one loop (fermion loops, QED) | 13 = 2 vertex corrections + 2 boxes + 9 vacuum-polarisation loops (e, μ, τ, u, d, s, c, b, t); the W loop in the photon self-energy makes 14 when it is allowed |
| gg → H | no tree diagram; 2 one-loop diagrams with the top quark (two orientations of the arrow), 8 with s, c, b, t |

## Approximations and limits

- Colour is not tracked: a gluon line is a gluon line. Diagram counts are counts of Feynman graphs, not of colour structures.
- The one-loop list omits external-leg self-energies and tadpoles, and has no ghost loops (irrelevant for the QED and electroweak examples).
- Coupling strengths (`couplingStrength`, used by `estimateRate`) are rough magnitudes of the vertex factors (e|Q|, g_s, the Z's vector and axial
  couplings, g|V_ij|/√2, √2 m_f/v); dimensionful Higgs–gauge couplings are replaced by g/2. They rank diagrams of one process; they are not matrix elements.
- CKM magnitudes are rounded PDG values, used only for the ranking estimate.
- Tree-level diagrams of a process all have the same total order n − 2 (n legs); `maxOrder` therefore selects or rejects whole orders, or (with `{ s: 0 }`) removes the strong diagrams.
