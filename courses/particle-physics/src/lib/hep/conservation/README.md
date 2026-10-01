# `hep/conservation`: the ledger and the reaction checker (Chapter 11)

Pure TypeScript, no DOM. Exposed to the reader's exercises as `hep/conservation`.

```ts
import { checkReaction, parseReaction } from 'hep/conservation';

checkReaction([2212], [-11, 22]);
// { allowed: false, violated: ['baryon', 'lepton-e'], details: { interaction: 'forbidden', … } }

const { initial, final } = parseReaction('K- + p -> Omega- + K+ + K0');   // PDG IDs
checkReaction(initial, final).allowed;                                     // true
```

## What it checks

Sums over the particle table (`hep/particles`) of charge, baryon number, the three lepton-flavour numbers, strangeness, charm and bottom
(bottom in the PDG sign: the b quark counts −1), and, when there is a single initial particle, the mass threshold (energy).

- `allowed`: no law of the ledger is broken. This is the function the reader writes in Chapter 11 (hook `conservation.checkReaction`); the
  reader's version needs only `{ allowed, violated }`.
- `details.interaction`: the weakest-coupled force that can do it. `'strong'` (hadrons only, every law holds); `'electromagnetic'` (a photon or
  a charged lepton takes part, every law holds); `'weak'` (a neutrino takes part, or strangeness, charm or bottom change by at most one unit);
  `'forbidden'` (an exact law is broken, or a flavour changes by two units: a single weak vertex cannot do that).
- `details.laws`: every law with its initial and final totals; `details.explanation`: sentences for the judge widget;
  `details.q`, `details.thresholdSqrtS`: Q-value of a decay, smallest √s of a reaction.
- `LEDGER`: the table of laws × forces shown in the chapter.

## What it does not check

Spin and angular momentum (for any reaction that conserves B and L the fermion-number parity takes care of itself), parity, charge
conjugation, isospin and G-parity, colour, and the detailed dynamics. Allowed is necessary, never sufficient: the tests include
π⁰ → γγγ, which passes every law here and is forbidden by C.

`parseReaction` accepts the table's ASCII names (`mu-`, `anti-nu_e`, `Omega-`), typeset symbols (`π⁻`, `γ`), and `pbar`, `nubar_mu`, `K0bar`,
`e+e-` (glued), `2γ`. Write ` -> ` with spaces when a name ends in `-`.

Tests: `npx vitest run src/lib/hep/conservation`. They include a sweep of every decay in the particle table.
