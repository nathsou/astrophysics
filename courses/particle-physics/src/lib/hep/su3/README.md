# `hep/su3`: flavour SU(3) as a pattern (Chapters 12 and 13)

Pure TypeScript, no DOM. Exposed to the reader's exercises as `hep/su3`.

```ts
import { irrep, decomposeProduct, formatDecomposition, decupletSpacing } from 'hep/su3';

irrep(3, 0).weights;                                       // the ten states of the decuplet, as { i3x2, y3, mult }
formatDecomposition(decomposeProduct([[1,0],[1,0],[1,0]])); // "10 ⊕ 8 ⊕ 8 ⊕ 1"
decupletSpacing().omegaFromLastSpacing;                     // 1.6799 GeV
```

- `irrep(p, q)`: the representation with Dynkin labels (p, q): (1,0) = 3, (0,1) = 3̄, (1,1) = 8, (3,0) = 10. States are the
  Gelfand–Tsetlin patterns with top row (p+q, q, 0), so the multiplicities and the isospin content are exact. Weights are integers:
  `i3x2` = 2·I3, `y3` = 3·Y. Q = I3 + Y/2.
- `productWeights`, `decompose`, `decomposeProduct`: products by adding weights, decomposition by repeatedly removing the representation
  of the highest weight. `hasColourSinglet`, `flavourMultiplets`.
- `baryonMultiplet('octet' | 'decuplet')`: the diagram with the table's baryons placed on it. The table has Δ and Ω⁻ but not the Σ*(1385)
  and Ξ*(1530): `DECUPLET_MASSES` supplies their masses (the neutral members, rounded; typed from memory of the PDG listing, to be checked).
- `decupletSpacing`, `gellMannOkuboBaryons`, `gellMannOkuboMesons`, `omegaStrongDecayThreshold`, `unitarityLimit`, `gellMannNishijima`.
- Quark model (`quark.ts`): `parseContent`, `contentNumbers`, `hadronsWithContent`, colour neutrality, magnetic moments of the octet.

## Conventions and a warning

Quark content strings are those of `hep/particles`: `"ud~"` is u d̄ (a trailing `~` marks the antiquark). The particle table's own
derivation of antiparticles (`particle(-211).quarks`) does not follow this convention (it gives `"~u~d~"`), so `hadronsWithContent` works from the
table's base entries and flips the content itself.

Tests: `npx vitest run src/lib/hep/su3`. They check the dimensions of every (p, q) up to 5, the decompositions 3⊗3̄, 3⊗3, 3⊗3⊗3, 8⊗8,
the Gell-Mann–Nishijima relation for every hadron of the table, and the numbers quoted in the chapters.
