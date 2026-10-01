---
number: 11
title: Conservation laws
summary: Charge, baryon number, lepton number and strangeness, the quantities that no reaction changes or that only the weak force changes. A ledger that tells you in advance which reactions can happen, and a judge that applies it to any reaction you type.
duration: About 2½ hours
prerequisites: [antimatter, cosmic-rays-pions-muons]
---

In 1947, in a cloud chamber at Manchester, two photographs showed something that the physicists who took them did not recognise. In one, a track forked in empty gas: two charged tracks, opening like a V, starting from a point where nothing visible had arrived. In the other, a charged track bent sharply, with a change of ionisation at the kink. In both cases an invisible or a charged particle had decayed into lighter things, and from the geometry the new particles weighed about a thousand electron masses, between the electron and the proton.:cite[rochester1947]

The photographs were the first of a family of **V particles**, later named kaons and hyperons. They were more than a surprise. They were a puzzle about time. Strong interactions are fast: a pion hitting a proton makes the V particles in about $10^{-23}$ seconds, the time light takes to cross a nucleus. But once made, they live for $10^{-10}$ seconds, ten trillion times longer, long enough to cross a cloud chamber. A particle that is made by the strong force should, one would think, be able to decay by the strong force, just as fast. These did not.

```fermi
id: lambda-slow
title: How slow is a slow decay?
prompt: The Δ(1232) baryon has a width of 0.117 GeV and decays strongly. The Λ baryon, with a mass of 1.116 GeV, decays to a proton and a pion, and its lifetime is 2.63 × 10⁻¹⁰ s. About how many times longer does the Λ live than the Δ? (Use τ = ħ/Γ with ħ = 6.582 × 10⁻²⁵ GeV·s.)
answer: 4.7e13
factor: 3
hints:
  - The Δ's lifetime follows from its width, τ = ħ/Γ.
explain: "τ(Δ) = 6.582 × 10⁻²⁵ GeV·s / 0.117 GeV = 5.6 × 10⁻²⁴ s. The Λ lives 2.63 × 10⁻¹⁰ s, which is 4.7 × 10¹³ times longer. Both have similar masses and both decay to a nucleon and a pion. Whatever makes the Λ slow is not a lack of energy: it must be that the strong force is somehow not allowed to do this decay."
```

The explanation, found in 1952 to 1955, is a conservation law, and this chapter is about the whole family. A **conservation law** says that the total of some quantity is the same before and after every reaction. You know two already: energy and momentum, which Chapter 2 used for every decay. Particle physics adds quantities that are not energy or momentum: each particle carries a charge of the new kind, the charges add up like numbers, and the sum does not change. Collecting them is useful because they are the *selection rules* of the subject: they tell you, without any calculation of probabilities, which reactions are impossible. Everything else is a question of rates.

## The laws, one at a time

### Electric charge

The total electric charge never changes. A neutron (charge 0) decays to a proton (+1) and an electron (−1). A photon (0) makes an electron and a positron (Chapter 9), whose charges cancel. An electron cannot decay at all, because there is nothing lighter that carries a charge of −1: it is the lightest charged particle, and the law that protects it is charge conservation. Searches for the decay $e^- \to \nu\gamma$ (which would conserve everything but charge) give a lifetime of more than $10^{28}$ years.:cite[pdg2024] Charge conservation is the one that is understood most deeply: it is the consequence of a symmetry, the freedom to rotate the phase of the electron's wave function independently at each point (Chapter 17).

### Baryon number

Take the proton, the neutron, the Λ, the Δ, and every particle with three quarks in it: give each of them a **baryon number** $B = +1$, and give their antiparticles $B = -1$. Mesons, leptons and photons have $B = 0$. In every reaction ever observed the total baryon number is unchanged. The reaction $p\,p \to p\,p\,\bar p$ does not conserve it, since it takes $B = 2$ to $B = 1$; Chapter 9 explained why the antiproton needs $p\,p \to p\,p\,p\,\bar p$ instead, with $B = 2$ on both sides.

Baryon number explains the stability of the proton. The proton is the lightest baryon, so a decay to anything lighter must turn a baryon into non-baryons, which the law forbids. The proton has not been seen to decay: in the most sensitive searches, the decay $p \to e^+\pi^0$ has a lifetime of more than $10^{34}$ years, some $10^{24}$ times the age of the universe.:cite[pdg2024] Baryon number is not tied to a symmetry as charge is, and theories that go beyond the Standard Model tend to break it a little. Whether it is exact is an open question, taken up in Chapter 32.

### Lepton numbers

Give the electron and its neutrino $L_e = +1$, the muon and its neutrino $L_\mu = +1$, the tau and its neutrino $L_\tau = +1$, and the antiparticles the opposite sign. Everything else is 0. Beta decay of the neutron then needs an *anti*-neutrino: $n \to p\,e^-\,\bar\nu_e$ has $L_e = 0$ before and $+1 - 1 = 0$ after. That is how the antineutrino of beta decay fits the ledger (Chapter 22 tells the story of the neutrino). The muon's decay is $\mu^- \to e^-\,\bar\nu_e\,\nu_\mu$: the muon's number passes to its neutrino, and the electron's number is balanced by its antineutrino. Each of the three numbers separately is conserved, as far as any experiment with charged leptons has seen.

The decay $\mu^- \to e^-\gamma$ conserves charge, and the *total* lepton number is $+1$ on both sides. It is nevertheless forbidden, because the muon number goes from 1 to 0 and the electron number from 0 to 1. The MEG experiment at the Paul Scherrer Institute in Switzerland looked for it among $7.5\times10^{14}$ muon decays and found none, putting the branching fraction below $4.2\times10^{-13}$.:cite[meg2016] Neutrino oscillations, reported in 1998, show that the *neutrino* flavours do change (Chapter 31), so lepton flavour is not the exact law that charge is. For charged-lepton reactions it holds to the sensitivity of every experiment.

### Strangeness

Charge, baryon number and lepton numbers are not enough to explain the V particles. A kaon or a Λ is made in a strong reaction and yet decays slowly. In 1953 Murray Gell-Mann, and independently Tadao Nakano and Kazuhiko Nishijima, proposed that these particles carry a further quantity, and that it is conserved in the strong interactions, which make the particles, and not in the weak interaction, which makes them decay.:cite[gellmann1953,nakano1953] Gell-Mann called it **strangeness**, $S$.

Assign $S = 0$ to the nucleon, the pion, the photon and the leptons, and let the $\Lambda$ have $S = -1$, the $K^+$ and $K^0$ have $S = +1$ (and the $K^-$, $\bar K^0$, $S = -1$), the $\Xi$ have $S = -2$, and the $\Omega^-$ have $S = -3$. These assignments are not arbitrary: they are what makes strong reactions consistent. Consider $\pi^- p \to K^0 \Lambda$. Before the reaction $S = 0$. After it, $S = (+1) + (-1) = 0$: the reaction is allowed. The reaction $\pi^- p \to K^0 n$, with only one strange particle, would have $S = +1$ after, and does not happen at the strong rate. Strange particles are therefore always produced **in pairs** (or with a partner of the opposite strangeness): Abraham Pais had proposed this "associated production" in 1952 as a pattern in the data, before the quantum number existed.:cite[pais1952]

Once made, a $\Lambda$ cannot decay by the strong force: its decay products ($p\,\pi^-$) have $S = 0$, and the law forbids it. Only the weak force, which does not conserve strangeness, can do it, and the weak force is $10^{13}$ times slower, so the Λ lives $2.6\times10^{-10}$ s.

::bubble-chamber{n="11.1" preset="v0" caption="A re-simulated bubble-chamber event: a π⁻ enters from the left and hits a proton, making a Λ and a K⁰ together (associated production, strangeness 0 before and after). Both are neutral and leave no track. Each lives long enough to travel a few centimetres and then decays into two charged particles, leaving a V. The Λ gives p π⁻, and the K⁰ gives π⁺π⁻. A simulation of the topology of such events, not a photograph."}

:::history{year=1947 title="Two photographs that do not fit" people="George Rochester, Clifford Butler" source="Source: Rochester and Butler (1947)."}
George Rochester and Clifford Butler worked in Patrick Blackett's laboratory at Manchester, with a cloud chamber between the poles of a large electromagnet and a thick bar of lead across it, photographing cosmic rays. The first unusual picture was taken in October 1946: a neutral particle that decayed into two charged ones, just below the plate, as a forked track. The second, in May 1947, showed a charged particle that changed direction and ionisation at a point in the gas, as if it had decayed into a lighter charged particle and something invisible. They published both in *Nature* in December 1947, with the conclusion that new unstable particles of a mass of about a thousand electron masses existed.:cite[rochester1947] The pictures were called V particles, after the shape of the forked track.
:::

:::history{year=1953 title="A new number for the new particles" people="Murray Gell-Mann, Tadao Nakano, Kazuhiko Nishijima" source="Sources: Gell-Mann (1953); Nakano and Nishijima (1953); Nishijima (1955)."}
In 1953, in a two-page note in the *Physical Review*, Gell-Mann proposed a scheme in which the new particles were assigned a new additive quantum number that is conserved by the strong interaction and violated by the weak one, and he applied it to the particles known at the time.:cite[gellmann1953] Nakano and Nishijima, in Japan, proposed a similar scheme in the same year in *Progress of Theoretical Physics*, and Nishijima developed it in 1955.:cite[nakano1953,nishijima1955] The relation between charge, isospin, baryon number and the new quantity is named after Gell-Mann and Nishijima (Chapter 12). Strange particles had been seen for six years by then, and the quantum number brought order to all of them.
:::

## Using the ledger: what must be missing

The most practical use of the laws is to fill in what you cannot see. Suppose a bubble-chamber photograph shows a $K^-$ hitting a proton, and a $\Xi^-$ coming out, with one other particle that left no track. The ledger says what the unseen one carried. Before: charge $-1+1 = 0$, baryon number $+1$, strangeness $-1$. After, the $\Xi^-$ has charge $-1$, $B = +1$ and $S = -2$. The missing particle must therefore have charge $+1$, baryon number 0 and strangeness $+1$, and the only particle in the table that fits is the $K^+$: the reaction is $K^-p\to\Xi^-K^+$, and indeed it is. The same reasoning, with lepton number in place of strangeness, is how the antineutrino in neutron decay was inferred: charge and baryon number balanced without it and lepton number did not.

Strangeness also sorts the particles by *how* they decay. The table has the strange particles with their lifetimes, and they fall into two groups:

| Particle | $S$ | Mean life (s) | Decays by |
|---|---|---|---|
| $K^+$ | +1 | $1.24\times10^{-8}$ | weak force |
| $\Lambda$ | −1 | $2.63\times10^{-10}$ | weak force |
| $\Sigma^+$ | −1 | $8.02\times10^{-11}$ | weak force |
| $\Sigma^0$ | −1 | $7.4\times10^{-20}$ | electromagnetic force ($\Sigma^0\to\Lambda\gamma$) |
| $\Xi^0$, $\Xi^-$ | −2 | $2.90\times10^{-10}$, $1.64\times10^{-10}$ | weak force |
| $\Omega^-$ | −3 | $8.21\times10^{-11}$ | weak force |

Every strange particle in the table but one lives between $10^{-11}$ and $10^{-7}$ seconds (the long-lived neutral kaon, $K_L$, reaches $5\times10^{-8}$ s). The exception, the $\Sigma^0$, proves the rule. Its decay to a $\Lambda$ and a photon *conserves* strangeness (both sides have $S = -1$), so no weak interaction is needed, and it takes place by the electromagnetic force in $10^{-19}$ s, nine orders of magnitude faster than its charged siblings, which cannot take that route: a $\Lambda$ and a photon together are neutral. The $\Delta$ resonances of Chapter 12, with $S = 0$, decay in $10^{-23}$ s by the strong force. The three time scales, strong ($10^{-23}$ s), electromagnetic ($10^{-19}$–$10^{-16}$ s) and weak ($10^{-13}$ s and longer), are the three forces' signatures, and a lifetime in the table tells you which force is at work as clearly as a quantum number does.

All of these laws are connected to symmetries, and the connection is the theorem of Emmy Noether that Chapter 17 explains: for every continuous symmetry of the laws of physics there is a conserved quantity. Energy and momentum come from the symmetry of the laws under shifts in time and in space, and electric charge from a symmetry of the phase of the wave function. For baryon number, lepton numbers and strangeness the symmetries are weaker ones, which only some of the forces respect, and that is why they sit lower in the ledger below.

## Exact laws and approximate ones

The laws differ in how far they hold, and the difference is the most useful thing to know about them.

| Law | Strong force | Electromagnetic force | Weak force | Status |
|---|---|---|---|---|
| Energy and momentum | holds | holds | holds | Exact (Chapter 17) |
| Electric charge | holds | holds | holds | Exact |
| Baryon number | holds | holds | holds | No violation seen; tested by proton-decay searches (Chapter 32) |
| Lepton numbers | holds | holds | holds | Exact for charged leptons; neutrino flavours oscillate (Chapter 31) |
| Strangeness, charm, bottom | holds | holds | **changes by one unit** | Approximate |
| Isospin | holds (nearly) | broken a little | broken | Approximate (Chapter 12) |
| Parity P and charge conjugation C | holds | holds | **violated** | Struck through in Chapter 22 |
| CP | holds | holds | violated, a little | Struck through in Chapter 24 |

Two things about this table are worth stopping at. First, the rows on strangeness, charm and bottom are the **flavour** numbers (the number of strange, charm and bottom quarks, minus the antiquarks, Chapter 13). The weak force can change them, by one unit at a time: a reaction that needs $\Delta S = 2$ must happen twice over and is far slower. Second, the table is a *ledger* in the book-keeping sense, and later chapters strike through its entries one by one: parity (Chapter 22), CP (Chapter 24) and lepton flavour (Chapter 31). What stays in the ledger until the end of the book is energy and momentum, electric charge and colour (Chapter 18).

:::key[A necessary condition]
The ledger tells you what is **forbidden**. It cannot tell you what is **seen**. A reaction that passes every law may be absent for another reason: the energy is not enough, or the probability is too small to measure, or a law that is not in the ledger forbids it. The neutral pion does not decay to three photons, though every law of this chapter permits it, because of a symmetry (charge conjugation) that the ledger does not list. A reaction that fails the ledger is never seen. "Allowed" means "not forbidden by these laws", and nothing more.
:::

## The reaction judge

Type a reaction into the widget below: any combination of the particles in the course's table, written with an arrow. It adds up each law's quantity on both sides, using the particle table, and tells you what holds, what does not, and which force (if any) could do it. The judge says explicitly each time that an allowed reaction has not thereby been observed.

::reaction-judge{n="11.2" caption="The reaction judge. Every law of the ledger is checked against the quantum numbers in the particle table; the verdict names the law that forbids a reaction, or the force that can do it. The presets include the reaction that made the first Ω⁻, the decay that the MEG experiment searched for, and π⁰ → γγγ, which the ledger allows and nature does not."}

Try a few before reading on.

- `K- + p -> Omega- + K+ + K0` conserves everything, and in 1964 it was the reaction that produced the Ω⁻ (Chapter 12).
- `pi- + p -> K0 + n` is judged weak-only: strangeness goes from 0 to +1, which only a weak interaction can do. The strong force makes strange particles in pairs, and that is associated production's rule in one line. Try `pi- + p -> K0 + K0 + n`, with two units of strangeness from nothing: forbidden altogether.
- `p -> e+ + gamma` fails on two laws at once, baryon number and electron-lepton number, while conserving $B - L$. A theory in which this decay happens would have to break both.
- `e- -> nu_e + gamma` fails on charge, and so does `p + p -> p + p + pi+`.

```predict
q: 'The Ξ⁻ baryon (strangeness −2) decays to a Λ and a π⁻, and the Λ (strangeness −1) decays to a proton and a π⁻. Could the Ξ⁻ decay in one step to a neutron and a π⁻, which are both strangeness 0?'
options:
  - text: Yes, it has more energy than the Λ's decay, so it can.
    why: 'The energy is available, and so the decay is not forbidden on energy grounds. But it is the strangeness that matters, not the energy. The weak force changes strangeness by one unit at a time.'
  - text: Not at the rate of the Λ route, because it needs strangeness to change by two units in a single weak step.
    correct: true
    why: 'S = −2 before and 0 after: ΔS = 2. A single weak interaction changes S by at most one unit, so Ξ⁻ → n π⁻ would take two weak interactions and is not seen. The Ξ⁻ goes to Λ π⁻ (ΔS = 1) and then the Λ goes to p π⁻ (ΔS = 1), a cascade, from which the name "cascade particle" comes.'
  - text: No, because baryon number is not conserved.
    why: 'Baryon number is +1 before and +1 after (the neutron is a baryon). It is strangeness that fails.'
```

```reaction
id: judge-ten
title: Judge these reactions
prompt: |
  For each reaction, decide whether it is **allowed** (some force could do it) or **forbidden** (a law of the ledger breaks, or a flavour changes by two units at once). If it is allowed, say which force would do it: the strong force for hadrons only, the electromagnetic force when a photon or a charged lepton takes part, the weak force when a neutrino takes part or a flavour changes by one unit. If it is forbidden, name a law that it breaks. The reaction judge above can check your answers, but try them by hand first.
hints:
  - Add up the charge, the baryon number, the lepton numbers and the strangeness on each side. A neutrino or antineutrino carries a lepton number.
  - A reaction with a neutrino in it is weak; one with a photon but no neutrino is electromagnetic.
reactions:
  - { text: 'K- + p -> Omega- + K+ + K0', answer: allowed, force: strong }
  - { text: 'pi- + p -> K0 + K0 + n', answer: forbidden, law: strangeness }
  - { text: 'p + p -> p + p + pi+', answer: forbidden, law: charge }
  - { text: 'n -> p + e- + anti-nu_e', answer: allowed, force: weak }
  - { text: 'mu- -> e- + gamma', answer: forbidden, law: lepton-mu }
  - { text: 'pi0 -> gamma + gamma', answer: allowed, force: electromagnetic }
  - { text: 'Lambda -> p + pi-', answer: allowed, force: weak }
  - { text: 'p -> e+ + gamma', answer: forbidden, law: baryon }
  - { text: 'Xi- -> n + pi-', answer: forbidden, law: strangeness }
  - { text: 'e+ + e- -> mu+ + mu-', answer: allowed, force: electromagnetic }
explain: "The judge's rule is the one that physicists used by hand for the strange particles: sum the quantum numbers and compare. Note how few laws do all the work: charge and baryon number for the proton's stability, the lepton numbers for the neutrino, strangeness for the slow decay of the V particles."
```

```numeric
id: neutron-q
title: The energy of neutron decay
prompt: The neutron (0.939565 GeV) decays to a proton (0.938272 GeV), an electron (0.000511 GeV) and an antineutrino (massless in the table). How much energy, in MeV, is released?
answer: 0.782
unit: MeV
tolerance: 0.003
hints:
  - The energy released is the neutron's mass minus the sum of the masses of the products.
explain: "m(n) − m(p) − m(e) = 0.9395654 − 0.9382721 − 0.0005110 GeV = 0.000782 GeV = 0.782 MeV. It is shared among the electron, the antineutrino and the recoiling proton, which is why the electron's spectrum is continuous (Chapter 22). The ledger allows the decay; the energy accounts for the fact that it is open."
```

## Build it yourself: the conservation checker

The judge's core is a function of two lists of particle numbers. The library's `quantumNumbers` already adds up the charge, baryon number, lepton numbers and strangeness of a list of particles, and `particle(id)` gives the quantum numbers of a single one. Write the function that compares two sides, and the reaction judge will use yours when it is installed.

```code
id: conservation-checker
title: The conservation checker
hook: conservation.checkReaction
prompt: |
  Implement `checkReaction(initial, final)`. Both arguments are lists of PDG particle numbers (negative for antiparticles). Return `{ allowed, violated, details }`: `violated` is the list of the laws whose totals differ between the two sides, among `'charge'`, `'baryon'`, `'lepton-e'`, `'lepton-mu'`, `'lepton-tau'` and `'strangeness'` (in this order), and `allowed` is true exactly when that list is empty. `details` may hold anything you like, for example the totals.
  The function `quantumNumbers(ids)` from `hep/particles` returns the total `charge3` (three times the charge), `baryon3` (three times the baryon number), `lepton: [Le, Lmu, Ltau]` and `strangeness`.
starter: |
  import { quantumNumbers } from 'hep/particles';

  export function checkReaction(initial: number[], final: number[]): { allowed: boolean; violated: string[]; details: unknown } {
    const a = quantumNumbers(initial);
    const b = quantumNumbers(final);
    // Compare a and b law by law, and collect the names of the laws that differ.
    return { allowed: true, violated: [], details: {} };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { checkReaction } from 'solution';

  const P = 2212, N = 2112, PBAR = -2212, E = 11, POS = -11, MU = 13, GAMMA = 22;
  const NUE = 12, NUMU = 14, PI0 = 111, PIP = 211, PIM = -211, K0 = 311, KP = 321, KM = -321, LAMBDA = 3122, OMEGA = 3334;

  test('allowed reactions have nothing violated', () => {
    for (const [a, b] of [
      [[P, P], [P, P, P, PBAR]],
      [[KM, P], [OMEGA, KP, K0]],
      [[N], [P, E, -NUE]],
      [[PIM, P], [K0, LAMBDA]],
      [[PIP], [-MU, NUMU]],
      [[POS, E], [GAMMA, GAMMA]],
      [[PI0], [GAMMA, GAMMA, GAMMA]],
    ] as number[][][]) {
      const r = checkReaction(a!, b!);
      expect(r.violated).toEqual([]);
      expect(r.allowed).toBe(true);
    }
  });

  test('charge', () => {
    expect(checkReaction([E], [NUE, GAMMA]).violated).toEqual(['charge']);
    expect(checkReaction([P, P], [P, P, PIP]).violated).toEqual(['charge']);
  });

  test('baryon number', () => {
    expect(checkReaction([P, P], [P, P, N]).violated).toEqual(['baryon']);
    expect(checkReaction([P], [POS, GAMMA]).violated).toEqual(['baryon', 'lepton-e']);
  });

  test('lepton numbers, each separately', () => {
    expect(checkReaction([N], [P, E]).violated).toEqual(['lepton-e']);
    expect(checkReaction([MU], [E, GAMMA]).violated).toEqual(['lepton-e', 'lepton-mu']);
    expect(checkReaction([PIP], [-MU, NUE]).violated).toEqual(['lepton-e', 'lepton-mu']);
  });

  test('strangeness', () => {
    expect(checkReaction([LAMBDA], [P, PIM]).violated).toEqual(['strangeness']);
    expect(checkReaction([PIM, P], [KP, PIM, N]).violated).toEqual(['strangeness']);
    expect(checkReaction([PIM, P], [K0, N]).violated).toEqual(['strangeness']);
  });

  test('allowed is true exactly when nothing is violated, and the inputs are not changed', () => {
    const a = [P, P], b = [P, P, N];
    const r = checkReaction(a, b);
    expect(r.allowed).toBe(r.violated.length === 0);
    expect(a).toEqual([P, P]);
    expect(b).toEqual([P, P, N]);
  });
solution: |
  import { quantumNumbers } from 'hep/particles';

  export function checkReaction(initial: number[], final: number[]): { allowed: boolean; violated: string[]; details: unknown } {
    const a = quantumNumbers(initial);
    const b = quantumNumbers(final);
    const totals: [string, number, number][] = [
      ['charge', a.charge3, b.charge3],
      ['baryon', a.baryon3, b.baryon3],
      ['lepton-e', a.lepton[0], b.lepton[0]],
      ['lepton-mu', a.lepton[1], b.lepton[1]],
      ['lepton-tau', a.lepton[2], b.lepton[2]],
      ['strangeness', a.strangeness, b.strangeness],
    ];
    const violated = totals.filter(([, x, y]) => x !== y).map(([name]) => name);
    return { allowed: violated.length === 0, violated, details: Object.fromEntries(totals.map(([name, x, y]) => [name, { initial: x, final: y }])) };
  }
hints:
  - 'Each law is an equality of a number from `a` and a number from `b`. Make a list of [name, before, after] triples and filter the ones that differ.'
  - 'The lepton number is an array of three: `a.lepton[0]` is the electron-lepton number.'
```

The library's own reference, `checkReaction` in `hep/conservation`, does the same and a little more: it also checks charm and bottom number, the energy of a decay, and says which force can do the reaction. The judge's table of totals comes from it.

:::programmer
A conservation law is an **invariant** of the system's transition function, and checking a reaction against the ledger is checking a precondition on a state transition. The quantum numbers form a vector in $\mathbb{Z}^k$, a reaction is allowed when the sum over the inputs equals the sum over the outputs, and the particle table is a map from names to such vectors. This is the same shape as a double-entry ledger, or a checksum, and it has the same limits as a **type check**: passing it means that the program is not obviously wrong, and does not mean that it does what you intended. A reaction that passes the ledger can still never occur, as a program that compiles can still not run.
:::

:::hood[The reaction judge: quantum-number tables and why "allowed" is not "observed"]
The judge is table lookups and sums. The particle table stores every additive quantum number as an integer (charge and baryon number in thirds, so that nothing is a floating-point number), and the checker adds the integers of each side:

```ts
// src/lib/hep/conservation/index.ts
function totals(ids: readonly number[]) {
  const q = quantumNumbers(ids);          // sums over particle(id): charge3, baryon3, lepton[3], strangeness, charm, bottom
  return {
    charge: q.charge3 / 3,
    baryon: q.baryon3 / 3,
    'lepton-e': q.lepton[0],
    'lepton-mu': q.lepton[1],
    'lepton-tau': q.lepton[2],
    strangeness: q.strangeness,
    charm: q.charm,
    bottom: q.bottom,
  } as Record<string, number>;
}
```

A law is violated when the two totals differ by more than $10^{-9}$ (they are integers or thirds). A parser turns the text of a reaction into particle numbers, accepting the table's names, the typeset symbols and a few spellings. The classification of the force is a short rule on top: any exact law broken means forbidden; strangeness, charm or bottom changed by one unit, or a neutrino present, means weak; a photon or charged lepton, electromagnetic; otherwise strong. The tests sweep every decay in the particle table and check that none breaks an exact law. They also include the neutral pion's decay to three photons, which passes: the ledger is a list of necessary conditions. Nothing in the code can say whether a reaction that passes it happens.
:::

:::experiments
Every event generator applies this kind of check to its own output: a generated event whose charge, baryon number or lepton numbers do not balance indicates a bug, and the generators in use at CERN (Pythia, Herwig, Sherpa) test it. The experiments identify each particle with a **PDG Monte Carlo number**, the same integer code used in this course's table, which makes the check a sum over integers in every software framework. The searches for forbidden reactions are among the most sensitive in the field: MEG (above) looked for $\mu\to e\gamma$ in muon decays at the Paul Scherrer Institute,:cite[meg2016] and the proton-decay searches use huge tanks of water, such as the 50,000 tonnes of Super-Kamiokande in a mine in Japan, watched by photomultipliers for the Cherenkov rings of a positron and a pion from a single proton.:cite[pdg2024]
:::

## What comes next

The ledger organises the strange particles into families: those with strangeness 0, −1, −2, −3. [Chapter 12](/chapters/the-eightfold-way/) arranges them on a plane by strangeness and charge, and finds that they form patterns that have the shapes of a hexagon and a triangle, with one corner missing.

## Further reading

- Gell-Mann's two-page note (:cite[gellmann1953]) and Pais's earlier one on associated production (:cite[pais1952]) are the origin of strangeness.
- Rochester and Butler's *Nature* paper (:cite[rochester1947]) is the discovery of the V particles.
- The Particle Data Group's *Review of Particle Physics* (:cite[pdg2024]) lists the lifetimes and the limits on the decays that the ledger forbids.
