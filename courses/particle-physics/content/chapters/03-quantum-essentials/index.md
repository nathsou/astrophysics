---
number: 3
title: Quantum essentials
summary: Spin and the two families of particles, amplitudes that add before they are squared, the exponential law of decay, the link between a short life and a wide line, and the two numbers, a cross-section and a luminosity, that turn a theory into a count rate.
duration: About 2½ hours
prerequisites: [relativity-for-particles]
---

:::note
**Read this chapter in three sessions.** Session 1: quantum states. Session 2: unstable particles. Session 3: event rates. Each session has a stopping point; the section menu remembers where you paused.
:::


Two muons are created in the same instant. One of them decays after 0.3 microseconds and the other after 7. There is nothing to tell them apart: they are identical, their properties are the same to every digit, and no measurement made on either of them beforehand would have let you predict which would go first. Only the average is fixed. Over many muons it is 2.197 microseconds, a number known to about one part in a million.:cite[pdg2024]

This is not a failure of the instruments. It is how the world works at this scale, and almost everything a collider measures is a consequence of it. The spikes in Figure 2.1 have widths because their particles live for a fixed average time and not a fixed time. The number of Z bosons a collider makes in a day is an average, and the number you actually count fluctuates around it. Each decay picks its products at random, with fixed odds. This chapter collects the parts of quantum mechanics that the rest of the course leans on, in the order in which the course needs them:

1. **Spin**, the small, whole-number-of-states property that every particle carries, and the division of all particles into fermions and bosons that follows from it.
2. **Amplitudes**, the complex numbers that quantum mechanics adds before it squares.
3. **Decay**: the exponential law, the lifetime, the width, the Breit–Wigner shape of a resonance and the branching ratios.
4. **Two-body decays**, and your first piece of generator code.
5. **Cross-sections and luminosity**: how many events a collider will make, and how much that number can be trusted.

A primer on quantum mechanics is in [Appendix B](/appendix/physics/), and the [primer in the astrophysics course](/astrophysics/ch/primer-quantum/) covers the same ground with different examples. Nothing below assumes more than the idea that a particle has a wave-like description.


:::note
**Session 1: quantum states.** Distinguish spin, particle statistics and amplitudes; stop after Uncertainty. Explain why amplitudes must be added before probabilities.
:::

## Spin

Classical angular momentum belongs to something that turns: a planet, a wheel, a gyroscope. A particle in orbit around a nucleus has it too, and quantum mechanics says that its value along any chosen axis comes in whole multiples of ħ (the reduced Planck constant of Chapter 1). Particles also carry a second kind of angular momentum that no orbit accounts for. It is called :term[**spin**]{id=spin}, and it is a property of the particle in the way its mass is: an electron has it when it is alone in empty space.

The rules are few. A particle has a fixed **spin quantum number** *s*, which is 0, ½, 1, 3/2 and so on. If you measure the component of its spin along any axis you like, the answer is one of 2*s* + 1 values, −*s*, −*s* + 1, …, +*s*, in units of ħ. An electron has *s* = ½, so the answer is +½ or −½, called "up" and "down", and nothing in between.

:::history{year=1922 title="Silver atoms split into two" people="Otto Stern, Walther Gerlach" source="Sources: Gerlach and Stern (1922); Uhlenbeck and Goudsmit (1925)."}
In 1922, at Frankfurt, Otto Stern and Walther Gerlach passed a narrow beam of silver atoms from a hot oven through a magnetic field that was stronger on one side than on the other. Such a field pushes a small magnet sideways by an amount that depends on how the magnet is oriented. If the atoms' magnets had pointed in random directions, the beam should have spread into a band. On the detector plate the beam instead appeared as two separate traces.:cite[gerlach1922]

The result was first read as "space quantisation" of the atom's orbital angular momentum, an idea from the older quantum theory of Bohr and Sommerfeld. But a silver atom in its ground state has no orbital angular momentum to quantise. After the electron's spin was proposed in 1925, the two traces were understood as the two spin states of the atom's single outer electron.:cite[uhlenbeck1925] Stern was awarded the 1943 Nobel Prize in Physics for work that included this method.:cite[nobel1943]
:::

Figure 3.1 lets you rerun the logic of the experiment. It is a simulation of the rules, not a reconstruction of Stern and Gerlach's apparatus.

::spin-cartoon{n="3.1" caption="Atoms with spin s sent through a magnet whose field varies with position. A classical little magnet would be deflected anywhere, but a quantum spin lands in one of 2s + 1 beams. The second half repeats the measurement along an axis tilted by θ: for spin ½ the chance of 'up' is cos²(θ/2), so a measurement along one axis does not leave a definite value along another. A seeded simulation of the textbook rules."}

The second half of the figure has a consequence that classical intuition does not offer. An electron found "up" along *z* is found "up" along *x* only half the time, and if you then measure along *x* and go back to *z*, the answer along *z* is again random: the measurement along *x* has erased what you knew. Spin has a definite value along one axis at a time.

:::history{year=1925 title="The electron turns out to have an inner angular momentum" people="George Uhlenbeck, Samuel Goudsmit" source="Sources: Uhlenbeck and Goudsmit (1925)."}
By 1925 the structure of atomic spectra, in particular the way spectral lines split in a magnetic field, could be described only by adding an unexplained "two-valuedness" to the electron. George Uhlenbeck and Samuel Goudsmit, then young physicists at Leiden, proposed that the electron has a spin angular momentum of ħ/2 and a magnetic moment attached to it. Their note appeared in *Naturwissenschaften* in November 1925, with an English version in *Nature* in 1926.:cite[uhlenbeck1925]

The idea that a point-like electron could have an angular momentum looked strange, and it still resists a mechanical picture: spin is best treated as a quantum number with its own rules, not as a ball turning on its axis. In 1928 Dirac's relativistic equation for the electron gave it spin ½ without being asked to (Chapter 9).
:::

### Who has which spin

The particle table the course uses records the spin of every particle. The pattern is simple enough to memorise:

| Spin | Particles | Examples from the table |
|---|---|---|
| ½ | all quarks and leptons (and their antiparticles); the proton and neutron | e, μ, τ, ν, u, d, top, p, n, Λ |
| 1 | the force carriers of the Standard Model, except gravity; vector mesons | γ, g, W, Z; ρ, ω, φ, J/ψ, Υ |
| 0 | the Higgs boson; the lightest mesons | H; π, K, η |
| 3/2 | some excited baryons | Δ(1232), Ω⁻ |

The rows separate matter from forces in a rough way: the particles that make up matter have spin ½ and those that carry forces have spin 1. The Higgs boson, with spin 0, is the odd one out. (Chapter 30 describes how its spin was measured.) The hadrons in the table are composite, and their spins are built from the spins of their quarks and the orbital motion between them; Chapter 13 shows how.

Spin also decides which directions a decay prefers. A decaying particle of spin 0 has nothing in it that could point in one direction, so its products come out with no preferred direction: the decay is :term[**isotropic**]{id=isotropic} in the parent's rest frame. The same holds for any parent whose spin orientation is random, because a rotation of the whole experiment cannot change the result. Only a parent with a definite spin orientation, such as a Z boson made by colliding a quark and an antiquark (Chapter 23), can have a lopsided decay. The library's two-body decay, which you write below, is isotropic, and that is exact for the spin-0 parents and a simplification for the rest.

## Fermions and bosons

Particles of the same kind cannot be told apart, not even in principle: there is no way to paint a number on an electron. This has a precise consequence when two identical particles are described together. Suppose one of them is in a state *a* and the other in a state *b*. The two ways of assigning them give the same physical situation, so the description of the pair can change by at most a sign when the labels 1 and 2 are swapped. Both signs occur in nature, and the sign is tied to the spin:

:::equation{#exchange caption="The state of two identical particles, one in state a and one in state b. The upper sign is for bosons (integer spin), the lower sign for fermions (half-integer spin)."}
$$\term{psi}{\psi_{\pm}(1,2)} = \frac{1}{\sqrt{2}}\Big[\term{ab}{a(1)\,b(2)} \;\pm\; \term{ba}{b(1)\,a(2)}\Big]$$

```terms
psi:
  label: 'ψ±(1,2), the two-particle state'
  what: |
    The amplitude description of two identical particles, labelled 1 and 2, with one in state a and the other in state b.
  why: |
    Because the particles are identical, swapping the labels cannot change any measurable quantity, so ψ can only be multiplied by +1 or −1 under the swap. The upper sign (+) gives a symmetric state, the lower (−) an antisymmetric one.
  effect: |
    Bosons (spin 0, 1, …) use +; fermions (spin ½, 3/2, …) use −. That the sign follows the spin is the spin–statistics theorem.
ab:
  label: 'a(1) b(2)'
  what: |
    Particle 1 in state a and particle 2 in state b.
  why: |
    This is one of the two ways to assign the particles to the two states.
  effect: |
    Alone it would say which particle is where; the other term restores the symmetry.
ba:
  label: 'b(1) a(2)'
  what: |
    Particle 1 in state b and particle 2 in state a, the swapped assignment.
  why: |
    For identical particles the two assignments are indistinguishable alternatives, so their amplitudes are added (or subtracted).
  effect: |
    If a and b are the same state, the two terms are equal, and with the minus sign they cancel: the amplitude is zero.
```
:::

Put *a* = *b* in the lower sign and the state vanishes. **Two identical fermions cannot be in the same state.** This is :term[**Pauli's exclusion principle**]{id=exclusion-principle}. For bosons the plus sign makes the state stronger when the two share a state, so they can, and do, pile into one: this is what a laser beam is.

:::history{year=1925 title="No two electrons in the same state" people="Wolfgang Pauli" source="Sources: Pauli (1925); Pauli (1940)."}
Wolfgang Pauli submitted to the *Zeitschrift für Physik* in January 1925 a paper on the closing of the electron shells in atoms. To explain why the shells hold exactly 2, 8, 18 electrons and so on, and why the periodic table has the structure it has, he proposed that no two electrons in an atom can share the same set of quantum numbers. Four numbers were needed, and the fourth, which could take only two values, had no interpretation: the electron's spin was proposed later in the same year.:cite[pauli1925,uhlenbeck1925]

In 1940 Pauli showed that the connection between spin and statistics is not an extra assumption: in a relativistic quantum theory, particles of half-integer spin must be fermions and those of integer spin must be bosons.:cite[pauli1940] He received the 1945 Nobel Prize in Physics for the exclusion principle.:cite[nobel1945]
:::

The exclusion principle is why matter takes up room. Electrons in an atom cannot all sit in the lowest state, so they fill shells, and the chemistry of each element is the chemistry of its outermost shell. It is also why a white dwarf star, and a neutron star, does not collapse under its own weight: the crowd of electrons, or neutrons, pushes back because no two can occupy the same state (see the [neutron stars chapter](/astrophysics/ch/neutron-stars/) of the astrophysics course).

In particle physics it sets a puzzle. The Δ⁺⁺ baryon has spin 3/2, and the particle table gives its quark content as uuu: three identical spin-½ fermions, all apparently in the same state. Chapter 13 shows how the puzzle led to a new property of quarks, colour.

```quiz
q: 'Which of these can have two identical particles in exactly the same quantum state?'
options:
  - text: Two electrons
    why: 'Electrons have spin ½, so they are fermions. The antisymmetric state vanishes when both are in the same state.'
  - text: Two photons
    correct: true
    why: 'Photons have spin 1, so they are bosons, and the symmetric state is reinforced when both are in the same state. A laser is a beam of photons in one state.'
  - text: Two protons
    why: 'Protons have spin ½: fermions. (Protons in a nucleus fill levels, as electrons fill atomic shells.)'
  - text: Two neutrinos
    why: 'Neutrinos have spin ½ and are fermions, like every lepton.'
```

## Amplitudes, not probabilities

Every statement about what quantum particles do is a statement about :term[**amplitudes**]{id=amplitude}: complex numbers, each with a size and a phase, and so each drawable as an arrow in a plane (a *phasor*). The probability of an outcome is the squared length of its amplitude. That alone would be a detail of bookkeeping if it were not for one rule:

> If an outcome can happen in two ways, and nothing records which way it did, the two amplitudes are **added**, and the sum is squared. If the way is recorded, the two probabilities are added.

:::equation{#interference caption="The probability of an outcome that can happen by two paths that are not distinguished. The last term is interference."}
$$\term{P}{P} = |\term{A1}{A_1} + \term{A2}{A_2}|^2 = |A_1|^2 + |A_2|^2 + \underbrace{2\,|A_1||A_2|\cos\term{delta}{\delta}}_{\text{interference}}$$

```terms
P:
  label: 'P, the probability (or rate)'
  what: |
    The relative chance of the outcome, for instance that a particle reaches a given point on a screen, or that a collision produces a given final state.
  why: |
    It is the squared length of the total amplitude, which is the sum of the amplitudes of the alternatives.
  effect: |
    With the path recorded it would be |A₁|² + |A₂|², and would show no pattern.
A1:
  label: 'A₁, the amplitude of path 1'
  what: |
    A complex number: its length says how strongly path 1 contributes and its direction (its phase) says where in its cycle the wave is on arrival.
  why: |
    The phase advances with the length of the path divided by the wavelength, so two paths of different lengths arrive with different phases.
  effect: |
    Drawn as an arrow, it is one side of the triangle in Figure 3.2.
A2:
  label: 'A₂, the amplitude of path 2'
  what: |
    The same for the second path.
  why: |
    As for A₁; the two are added as arrows, head to tail.
  effect: |
    If A₂ points opposite to A₁ and has the same length, the total is zero: a dark fringe.
delta:
  label: 'δ, the phase difference'
  what: |
    The angle between the two arrows. For two slits it is 2π × (path difference)/(wavelength).
  why: |
    It decides whether the two amplitudes reinforce (δ = 0) or cancel (δ = π).
  effect: |
    As the point on the screen moves, δ changes, and the probability oscillates between (|A₁| + |A₂|)² and (|A₁| − |A₂|)².
```
:::

```predict
q: 'A particle source is in front of a screen with two slits. With only slit 2 open, there is a point X on a detector behind it where particles do arrive. You now open slit 1 as well. Assume nothing records which slit each particle takes. What happens to the number of particles reaching X?'
options:
  - text: It increases, because there are now two routes.
    why: 'This is the answer if probabilities added. They do not, unless the path is recorded. X can lie on a dark fringe.'
  - text: It stays the same, because each particle goes through one slit or the other.
    why: 'A particle that could have gone through either slit, with nothing recording which, is not described by "one or the other". Its amplitudes add.'
  - text: It can decrease, even to zero.
    correct: true
    why: 'At a dark fringe the arrows for the two paths are opposite and cancel. Opening a second route removes the particles from that point. Figure 3.2 shows it, and shows that switching on a which-path record brings them back.'
```

::phasor-slits{n="3.2" caption="Two paths to one point on a screen. Each path contributes an arrow (a phasor): the blue one from slit 1, the purple one from slit 2. Move the point on the screen and the purple arrow turns relative to the blue one. Placed head to tail, the two arrows reach the sum (amber), and the intensity is the square of the sum's length. Record which path was taken and the fringes vanish. A calculation with the far-field formula."}

This is the rule behind most of the quantum phenomena that particle physics uses, and it returns in three places in the course:

- A **resonance** such as the Z is an amplitude with a phase that swings through half a turn as the energy crosses the mass. It is described below with a phasor of its own (Figure 3.4, left).
- In the reaction e⁺e⁻ → μ⁺μ⁻ a photon and a Z boson can each be the intermediate step. The two amplitudes are added, and the cross-section has an interference term, which Chapters 16 and 23 measure.
- The difference between matter and antimatter in the decays of kaons and B mesons (Chapter 24) is an interference between two amplitudes whose phases differ.

## Uncertainty

A wave has no position until something localises it. To confine a wave to a region Δ*x* you need to superpose waves with a spread of wavelengths, hence of momenta, at least of order 1/Δ*x*. Quantitatively:

:::equation{#uncertainty caption="Heisenberg's position–momentum uncertainty relation. The product of the spreads of a particle's position and momentum cannot be made smaller than ħ/2."}
$$\term{dx}{\Delta x}\;\term{dp}{\Delta p} \;\ge\; \frac{\term{hbar}{\hbar}}{2}$$

```terms
dx:
  label: 'Δx, the spread in position'
  what: |
    The width of the range of positions over which the particle's wave is spread, measured as a standard deviation.
  why: |
    A wave confined to a narrow region is a sum of many wavelengths.
  effect: |
    To look at a proton, 10⁻¹⁵ m across, you need a probe whose position is known to better than this.
dp:
  label: 'Δp, the spread in momentum'
  what: |
    The width of the range of momenta in the wave, as a standard deviation.
  why: |
    Momentum is wavelength turned upside down (p = h/λ). A wave packet that is short in space is broad in wavelength.
  effect: |
    For a fast particle Δp ≈ ΔE/c, so a small Δx demands a large energy.
hbar:
  label: 'ħ, the reduced Planck constant'
  what: |
    h/2π = 6.582 × 10⁻²⁵ GeV·s = 0.1973 GeV·fm.
  why: |
    It sets the scale below which a quantum description is needed.
  effect: |
    In natural units it is 1 (Chapter 1).
```
:::

This is the exact form of Chapter 1's rule of thumb. To resolve a length Δ*x* a probe needs momentum of at least ħ/2Δ*x*, and for a fast particle, energy of order ħ*c*/Δ*x*: a hundred times smaller needs a hundred times more energy. The factor of two and the factor of 2π are conventions about how "spread" is defined, and the rule of thumb is good to that factor.

There is a second, looser relation between energy and time. It cannot be derived in the same way, because time is not something a particle has a spread in. The precise form applies to unstable states and is derived below. It says that a state that lasts for a time τ before decaying has an energy that is uncertain by about ħ/τ.


:::note
**Session 2: unstable particles.** Connect lifetime, width and branching ratios. Before changing a lifetime, predict the width change. The decay implementation is optional.
:::

## Decay is random

An unstable particle has no memory. A muon that has lived for a microsecond is as likely to decay in the next nanosecond as one that was created a moment ago. Whatever the particle is, the observation, repeated over a thousand kinds of particles, is that the probability of decaying in a short interval d*t* is proportional to d*t* and to nothing else:

$$\text{probability of decaying in } \mathrm{d}t \;=\; \frac{\mathrm{d}t}{\tau}.$$

The constant τ has the dimension of time. If *N* identical particles are left at time *t*, then in the next d*t* the number that decay is *N* d*t*/τ, so d*N* = −*N* d*t*/τ, and the solution is the exponential.

:::equation{#decay-law caption="The exponential law of decay: the number of particles left after a time t."}
$$\term{N}{N(t)} = \term{N0}{N_0}\; e^{-t/\term{tau}{\tau}}$$

```terms
N:
  label: 'N(t), the number left'
  what: |
    How many of the original particles have not yet decayed at time t.
  why: |
    Each particle has the same constant chance per unit time of decaying, so the loss rate is proportional to the number left.
  effect: |
    On a logarithmic axis it is a straight line, with slope −1/τ.
N0:
  label: 'N₀, the number at t = 0'
  what: |
    The starting number of particles.
  why: |
    It sets the scale; the shape of the curve does not depend on it.
  effect: |
    Double N₀ and the decay rate doubles at every moment.
tau:
  label: 'τ, the mean lifetime'
  what: |
    The average time a particle lives before decaying. It is also the time after which a fraction 1/e = 37 % are left.
  why: |
    It is the reciprocal of the decay probability per unit time. It is a property of the particle type, given in the particle table.
  effect: |
    The half-life, the time for half to decay, is τ ln 2 = 0.693 τ.
```
:::

Three facts follow, each worth having in your head.

- After one lifetime 37 % are left, after two 13.5 %, after three 5 %. The half-life is 0.693 τ, which is why the two are so often confused.
- The law is **memoryless**. Of the particles that survive to time *t*, the fraction that survive a further time *s* is e<sup>−*s*/τ</sup>, whatever *t* was.
- In flight, time runs slowly for the particle (Chapter 2). A particle with momentum *p* and mass *m* has a lab lifetime γτ and, travelling at nearly the speed of light, goes a mean distance βγ*c*τ. A muon with 1 GeV of momentum has βγ = *p*/*m* = 9.5 and *c*τ = 659 m, so it flies 6.2 km on average before decaying. That is why muons made high in the atmosphere reach the ground (Chapter 10), and why a muon crosses a whole detector.

```predict
q: 'A sample holds 1,000 muons at t = 0. The mean lifetime is τ. About how many are left after a time 2τ?'
options:
  - text: None, since 2τ is twice the lifetime.
    why: 'τ is an average, not a cut-off. Some muons live many times τ: after 5τ about 7 of the 1,000 are still there.'
  - text: About 250, which is half of half.
    why: 'That would be the answer for two half-lives (2 × 0.693 τ = 1.39 τ). A lifetime is longer than a half-life.'
  - text: About 135.
    correct: true
    why: 'e⁻² = 0.135. After one lifetime 37 % are left, and the same fraction of those survive the second.'
  - text: About 500.
    why: 'Half are left after a half-life, 0.693 τ, which is earlier than τ.'
```

The figure below runs the law. Each square is a particle with its own decay time, drawn from the exponential law with a seeded random number generator. Decay times are drawn by the inverse-transform method described in the box on sampling, below. One slider changes the lifetime, and the width Γ in the readout follows it: the next section explains why.

::decay-clock{n="3.3" caption="Decay clock. A few hundred identical particles, each decaying at a random time. The presets use the real lifetimes and branching ratios of the particle table: the muon takes microseconds, the Z 10⁻²⁵ s. Only the number of lifetimes matters to the picture: in units of τ, every preset looks the same. The grid shows which particles have decayed and into what; the curve is the number left; the lower panel shows the same lifetime as a width. Optional Geiger clicks, off by default, give one click per decay (at most four per frame), so the irregular rhythm of a Poisson process can be heard. Simulation."}

Two things to try. Set the count to 50 and press *Run* several times with new seeds: the curve never follows the exponential exactly, and the estimate of τ wobbles by τ/√*k* after *k* decays. Then set it to 3,000: the curve and the exponential become hard to tell apart. Measuring a lifetime to 1 % needs about 10,000 decays.

```fermi
id: potassium-40
title: Decays of potassium in your body
prompt: 'A 70 kg person contains about 140 g of potassium. Natural potassium (mean atomic mass 39.1 g/mol) is 0.0117 % potassium-40, with a half-life of 1.25 × 10⁹ years (1 year = 3.16 × 10⁷ s). About how many ⁴⁰K nuclei decay in the body each second?'
answer: 4400
unit: per second
factor: 3
hints:
  - Count the ⁴⁰K atoms first, with Avogadro's number 6.02 × 10²³ per mole.
  - The decay rate is N/τ, and τ = half-life / ln 2, in seconds.
explain: 'N = (140/39.1) × 6.02 × 10²³ × 1.17 × 10⁻⁴ = 2.5 × 10²⁰. τ = 1.25 × 10⁹ × 3.16 × 10⁷ / 0.693 = 5.7 × 10¹⁶ s. Rate = N/τ ≈ 4.4 × 10³ s⁻¹. Each nucleus has a probability of about 10⁻¹⁷ of decaying in a second, and 10²⁰ nuclei multiply it up to thousands: a small probability and a large number is the pattern of every rate calculation in this chapter.'
```

## Lifetime and width

The exponential law has a consequence for energy. Write the amplitude of a stable particle at rest as e<sup>−*iMt*</sup> (natural units, *M* the mass): a phase that turns at a rate given by the energy. For a particle that decays, the amplitude must shrink too, so that the probability, which is its square, falls as e<sup>−*t*/τ</sup>. The amplitude is then e<sup>−*iMt*</sup> e<sup>−*t*/2τ</sup>. A wave that dies away in a finite time is not a pure frequency; it is a superposition of frequencies, and the Fourier transform of a decaying exponential is a Lorentzian (the Cauchy distribution of probability). The details are in the next box. The result is the :term[**Breit–Wigner**]{id=breit-wigner} formula.

:::deeper[Where the Breit–Wigner shape comes from]
Take the amplitude ψ(*t*) = e<sup>−*iMt*</sup> e<sup>−Γ*t*/2</sup> for *t* ≥ 0 and zero before, with Γ = 1/τ. Its probability |ψ|² = e<sup>−Γ*t*</sup> decays with the mean lifetime τ. To ask how much of each energy *E* is present, take the Fourier transform,

$$A(E) = \int_0^\infty \psi(t)\,e^{iEt}\,\mathrm{d}t = \int_0^\infty e^{\,i(E-M)t - \Gamma t/2}\,\mathrm{d}t = \frac{1}{\Gamma/2 - i(E-M)} = \frac{i}{E - M + i\Gamma/2}.$$

The probability of finding the energy *E* is the squared modulus,

$$|A(E)|^2 = \frac{1}{(E-M)^2 + \Gamma^2/4}.$$

This is a bell-shaped curve centred on *M*, with a height 4/Γ² at the peak. It falls to half its peak value when (*E* − *M*)² = Γ²/4, that is, at *E* = *M* ± Γ/2, so its full width at half maximum is Γ. The relation Γ = 1/τ was an input, and it survives as the width of the line: in SI units, **Γ τ = ħ**.

The amplitude itself, *i*/(*E* − *M* + *i*Γ/2) (Figure 3.4 draws 1/(*E* − *M* + *i*Γ/2), which differs by a constant phase that does not matter), is a complex number. As *E* sweeps from far below *M* to far above it, its tip goes once round a circle, and its phase changes by half a turn. The left panel of Figure 3.4 draws it. That phase swing is how a resonance interferes with whatever else can produce the same final state.

Normalised to unit area, the distribution is (Γ/2π)/((*E* − *M*)² + Γ²/4). Its tails fall as 1/(*E* − *M*)², slowly enough that the mean and variance are infinite; the width is defined by the half-maximum, not by a standard deviation.
:::

:::equation{#breit-wigner caption="The Breit–Wigner distribution of the mass (or energy) of an unstable particle, and its link to the lifetime."}
$$\frac{\mathrm{d}\term{P2}{P}}{\mathrm{d}\term{m2}{m}} = \frac{1}{2\pi}\,\frac{\term{Gam}{\Gamma}}{(m-\term{M2}{M})^2 + \Gamma^2/4}, \qquad \Gamma\,\term{tau2}{\tau} = \hbar$$

```terms
P2:
  label: 'dP/dm, the distribution of the mass'
  what: |
    The probability per unit mass that a particle made in a collision has an invariant mass m (the mass reconstructed from its decay products).
  why: |
    An unstable particle has no single mass; its amplitude is a superposition of energies in the ratio given by the Fourier transform of its decay.
  effect: |
    Normalised to 1 when integrated over m. Its peak value is 2/(πΓ), so a narrower line is a taller one.
m2:
  label: 'm, the mass'
  what: |
    The invariant mass of the decay products in one event (Chapter 2).
  why: |
    It varies from event to event because the parent's mass is not sharp.
  effect: |
    Histograms of m show the line shape directly, blurred by the detector.
Gam:
  label: 'Γ, the width'
  what: |
    The full width of the line at half its maximum height, measured in GeV. Also the total decay rate in natural units.
  why: |
    It is 1/τ: a shorter life is a broader line.
  effect: |
    The Z has Γ = 2.50 GeV, the J/ψ 0.093 MeV, a factor of 27,000 smaller.
M2:
  label: 'M, the mass of the particle'
  what: |
    The position of the peak, which is the value listed as the particle's mass.
  why: |
    It is the energy of the particle at rest, at the centre of the energy distribution.
  effect: |
    Moving M moves the peak without changing its shape.
tau2:
  label: 'τ, the mean lifetime'
  what: |
    The mean time the particle lives before decaying, in its own rest frame.
  why: |
    Γτ = ħ is an exact property of the exponential decay law and its Fourier transform.
  effect: |
    With Γ in GeV, τ = 6.582 × 10⁻²⁵ s / Γ. Z: 2.64 × 10⁻²⁵ s. J/ψ: 7.1 × 10⁻²¹ s.
```
:::

This is what makes the two halves of the chapter one subject. The lifetime is what you see in time, the width is what you see in energy, and they are one number: **Γ = ħ/τ**. A particle that lives 10⁻²⁵ s has a width of order a GeV. In Figure 3.3 the slider moves both at once.

The table shows the range. Masses, widths and lifetimes are from the particle table, rounded from the PDG.:cite[pdg2024] The *c*τ column is how far light travels in one lifetime; a particle flying at high speed goes further by the factor βγ. A particle that decays within micrometres of where it was made cannot be seen in flight, and only its decay products are detected.

| Particle | Mass | Width Γ | Lifetime τ | *c*τ | Γ / *M* |
|---|---|---|---|---|---|
| μ⁻ | 105.7 MeV | 3.0 × 10⁻¹⁰ eV | 2.197 µs | 659 m | 2.8 × 10⁻¹⁸ |
| π⁺ | 139.6 MeV | 2.5 × 10⁻⁸ eV | 26.0 ns | 7.8 m | 1.8 × 10⁻¹⁶ |
| K<sub>S</sub> | 497.6 MeV | 7.4 × 10⁻⁶ eV | 89.5 ps | 26.8 mm | 1.5 × 10⁻¹⁴ |
| π⁰ | 135.0 MeV | 7.8 eV | 84.3 as | 25 nm | 5.8 × 10⁻⁸ |
| J/ψ | 3.097 GeV | 92.6 keV | 7.1 × 10⁻²¹ s | 2.1 pm | 3.0 × 10⁻⁵ |
| Υ(1S) | 9.460 GeV | 54.0 keV | 1.2 × 10⁻²⁰ s | 3.7 pm | 5.7 × 10⁻⁶ |
| H | 125.2 GeV | 4.1 MeV | 1.6 × 10⁻²² s | 48 fm | 3.3 × 10⁻⁵ |
| ρ⁰ | 775.3 MeV | 147 MeV | 4.5 × 10⁻²⁴ s | 1.3 fm | 0.19 |
| W | 80.37 GeV | 2.085 GeV | 3.2 × 10⁻²⁵ s | 0.095 fm | 2.6 × 10⁻² |
| Z | 91.19 GeV | 2.495 GeV | 2.6 × 10⁻²⁵ s | 0.079 fm | 2.7 × 10⁻² |
| top | 172.6 GeV | 1.42 GeV | 4.6 × 10⁻²⁵ s | 0.14 fm | 8.2 × 10⁻³ |

The lifetime tells you which force does the decaying. The ρ⁰, with *c*τ = 1.3 fm, lives about as long as light takes to cross a proton: it falls apart through the strong force as fast as anything can. The π⁰ decays into two photons by the electromagnetic force, 10⁷ times more slowly. The charged pion, the muon and the K<sub>S</sub> decay through the weak force, slower again by a factor of 10⁶ to 10¹⁰ (Chapter 22). The Z and W carry the weak force, and decay fast because they are so heavy. Particles that live longer than about 10⁻¹⁰ s are the ones a detector sees as tracks (the particle table flags them as `stable`), and Chapters 5 to 8 are about them. The ρ⁰, J/ψ, Υ, H, W, Z and top are seen only through their decay products, for instance as peaks in an invariant-mass histogram, as in Figure 2.1.

```numeric
id: jpsi-lifetime
title: The lifetime of the J/ψ
prompt: 'The J/ψ has a width of Γ = 92.6 keV = 9.26 × 10⁻⁵ GeV. What is its mean lifetime τ = ħ/Γ in seconds? (ħ = 6.582 × 10⁻²⁵ GeV·s.)'
answer: 7.108e-21
unit: s
tolerance: 0.01
hints:
  - Convert the width to GeV first, then divide ħ by it.
explain: 'τ = 6.582 × 10⁻²⁵ GeV·s / 9.26 × 10⁻⁵ GeV = 7.11 × 10⁻²¹ s. That is 27,000 times longer than the Z boson, whose width is 27,000 times larger. A narrow line and a long life are one fact.'
```

```numeric
id: z-flight
title: How far does the Z go?
prompt: 'Use *c*τ = ħ*c*/Γ with ħ*c* = 0.1973 GeV·fm and Γ = 2.4955 GeV. What distance does light cover in one Z lifetime, in femtometres? (For comparison, a proton is about 1 fm across.)'
answer: 0.07907
unit: fm
tolerance: 0.01
hints:
  - Divide 0.1973 GeV·fm by 2.4955 GeV.
explain: 'cτ = 0.1973 / 2.4955 = 0.0791 fm, one twelfth of a proton radius. A Z made in the middle of a detector decays before it has left the collision region by any distance a detector could resolve, however fast it is going (it would need βγ in the millions), which is why it is seen only as a peak in an invariant mass.'
```

### What the detector does to the line

A detector measures the momenta of the muons with a finite precision, so that every event's invariant mass is off by a random error. The recorded distribution is the Breit–Wigner convolved with the distribution of the errors, which is roughly a Gaussian of width σ. Two things follow. If the natural width is larger than the resolution, the recorded line is nearly the Breit–Wigner. If it is smaller, the recorded line is nearly a Gaussian of width σ (with full width at half maximum 2.355 σ), and the natural width is invisible.

Figure 3.4 shows all of this in three ways. *Theory* draws the line, the Gaussian and their convolution, and shows the complex amplitude as an arrow on its circle. *Particle gun* is a small generator: for each of 20,000 events it draws the parent's mass from the Breit–Wigner, decays the parent into two particles with `twoBodyDecay`, smears the momenta, and computes the pair mass with `pairMass`, so the functions you write below can be dropped in. *Real data* overlays the CMS dimuon sample of Chapter 2 and fits the resolution.

::breit-wigner-lab{n="3.4" caption="The width of a line and the resolution of a detector. Theory: natural line (dashed), detector resolution, and what is recorded (solid). Particle gun: a simulation of decays with the library's two-body decay. Real data: the 100,000 CMS muon pairs of Figure 2.1, zoomed to the J/ψ or the Z, with a Breit–Wigner convolved with a Gaussian and scaled to the histogram. In the real-data fit, the width Γ is set to the table value and only the resolution σ, the peak position and two normalisations are fitted."}

The real data say how big the effect is. A least-squares fit of the Breit–Wigner convolved with a Gaussian to the J/ψ region of the shipped sample gives a resolution σ of about 31 MeV, which makes the recorded full width 74 MeV, compared with the natural width of 0.093 MeV. The recorded J/ψ peak of Figure 2.1 is about 800 times wider than the particle. For the Z the fit gives σ of about 1.4 GeV, and a recorded full width of about 4.9 GeV, against a natural 2.5 GeV: here the two effects are comparable. The fitted peak positions, 3.093 GeV and 90.7 GeV, lie a little below the table masses, 3.097 and 91.19 GeV. (Muons can radiate photons, which carry away energy and make the reconstructed mass too low, and the simple shape does not model this; the quality of the fit, χ² per degree of freedom much larger than 1, says the same.) These numbers are this sample's and this fit's: a different experiment, selection or fit would give different ones.

So how is a width of 93 keV measured, if the peak is 71 MeV wide? Not from the peak's width. The resolution moves events sideways along the mass axis but does not create or destroy them, so **the area** under the peak survives. In a resonance formed in a collision the area is proportional to a product of partial widths divided by the total width, and with the branching ratios it yields Γ. Chapter 23 measures the Z's width differently, at LEP, by setting the beam energy in fine steps across the peak: there the energy is fixed by the machine, whose spread is much smaller than the Z's width, and the resolution of a detector does not enter.

## Branching ratios

A particle can often decay in more than one way, and each way, or **channel**, has its own rate. The rates add, since they are independent chances per unit time. The total rate is the total width and the fraction of decays that go to channel *f* is its :term[**branching ratio**]{id=branching-ratio}:

:::equation{#branching caption="Partial widths add to the total width, and the branching ratio of a channel is its share."}
$$\term{Gtot}{\Gamma} = \sum_f \term{Gf}{\Gamma_f}, \qquad \mathrm{BR}(f) = \frac{\Gamma_f}{\Gamma}$$

```terms
Gtot:
  label: 'Γ, the total width'
  what: |
    The sum of the decay rates of all channels; also the full width of the line and ħ/τ.
  why: |
    Each channel is an independent way to decay, and the chances per unit time of independent events add.
  effect: |
    Opening a new channel raises Γ and so shortens the lifetime. Chapter 23 uses this to count the neutrino types from the width of the Z.
Gf:
  label: 'Γf, a partial width'
  what: |
    The rate, in GeV, at which the particle decays to the specific final state f.
  why: |
    It is computed from the theory of the force responsible for that decay.
  effect: |
    Not a width of a line: the line has a single width Γ. Γf can be much smaller than Γ.
```
:::

For the Z, the particle table gives (leading figures):

| Decay | Branching ratio |
|---|---|
| e⁺e⁻, μ⁺μ⁻, τ⁺τ⁻ (each) | 3.4 % |
| ν ν̄, three neutrino types together | 20.0 % |
| quark–antiquark pairs (hadrons) | about 70 % |

That is why the muons in the peak at 91 GeV of Figure 2.1 are a small fraction of the Z bosons produced: only one in thirty falls into the μ⁺μ⁻ channel, and only those are in that histogram. In the decay clock, each decay draws its channel from these branching ratios with a random number, and the bars in the lower panel show how the counts approach the ratios as more decays are seen.

The J/ψ is a different case: its electron and muon channels have branching ratios of 5.97 % and 5.96 % (equal, to the accuracy of the table), and most of its decays, 88 %, are to hadrons (the table lists them as three pions). The muon pair is easy to see, though rare: about 6 of every 100 J/ψ mesons produced end up in Figure 2.1.

```quiz
q: 'The Z has a width of 2.4955 GeV and a branching ratio of 3.366 % to muon pairs. What is the partial width Γ(Z → μ⁺μ⁻)?'
options:
  - text: 2.4955 GeV
    why: 'That is the total width. Each channel has only a share of it.'
  - text: 84 MeV
    correct: true
    why: 'Γ_f = BR × Γ = 0.03366 × 2.4955 GeV = 0.0840 GeV = 84 MeV. The partial widths of the e, μ and τ channels are nearly equal, which is a test of lepton universality (Chapter 23).'
  - text: 0.84 MeV
    why: 'A factor of 100 too small: 3.366 % is 0.03366, not 0.0003366.'
  - text: 3.366 GeV
    why: 'The branching ratio is a fraction: multiply it by the total width.'
```

## What comes out of a decay

Suppose a parent with four-momentum *P* decays into two particles of masses *m*₁ and *m*₂. In the parent's rest frame the situation is completely fixed except for one thing: the direction. Energy and momentum conservation fix the size of the momentum of each (the formula of Chapter 2),

$$|\vec p^{\,*}| = \frac{\sqrt{\left(M^2-(m_1+m_2)^2\right)\left(M^2-(m_1-m_2)^2\right)}}{2M},$$

and the two daughters leave back to back. For a parent with random spin orientation, the direction is uniform on the sphere. To get the daughters in the lab, where the parent is moving, you boost them with the parent's velocity. That is an algorithm, and it is one of the two pieces of a generator in its first version (the other is drawing the lifetime: the exponential above).

### Write it yourself

Write the function that decays a parent into two bodies. Given a random number generator `r`, the parent's four-momentum and the two daughter masses, return the two daughters' four-momenta in the lab frame. The library has a function for every step, in `hep/kinematics`: `twoBodyMomentum`, `fromMass`, `boostVector` and `boost`. Your function joins the pipeline as the decay step of the particle gun: the gun of Figure 3.4 uses it when *use my code* is ticked.

```code
id: two-body-decay
optional: true
title: Decay a particle into two
hook: kinematics.twoBodyDecay
prompt: |
  Implement `twoBodyDecay(r, parent, m1, m2)`:

  1. Find the daughters' momentum $k$ in the parent's rest frame from its mass $M$ (`mass(parent)`) and `twoBodyMomentum`.
  2. Choose a direction uniformly on the sphere: $\cos\theta$ uniform in $[-1, 1]$ (not $\theta$ uniform: that would crowd the poles), and $\varphi$ uniform in $[0, 2\pi)$. Use `r()` for the uniform numbers in $[0, 1)$.
  3. Build the two daughters back to back in the rest frame with `fromMass`.
  4. Boost both into the lab with the parent's velocity.

  The function must conserve four-momentum exactly, give each daughter its own mass and be isotropic in the parent's rest frame, whether or not the parent moves.
starter: |
  import type { P4, Rng } from 'hep';
  import { mass, twoBodyMomentum, fromMass, boost, boostVector } from 'hep/kinematics';

  export function twoBodyDecay(r: Rng, parent: P4, m1: number, m2: number): [P4, P4] {
    const M = mass(parent);
    const k = twoBodyMomentum(M, m1, m2);
    // TODO: a random direction (ux, uy, uz), then the two daughters in the rest frame, then boost them.
    const d1 = fromMass(m1, 0, 0, k);
    const d2 = fromMass(m2, 0, 0, -k);
    return [d1, d2];
  }
tests: |
  import { test, expect } from '@pp/test';
  import { twoBodyDecay } from 'solution';
  import { rng } from 'hep';
  import { mass, sum, fromMass, toRestFrame, pmag, twoBodyMomentum } from 'hep/kinematics';

  const parents = [
    fromMass(91.1880, 0, 0, 0),
    fromMass(91.1880, 30, -20, 120),
    fromMass(3.0969, 1, 2, 0.5),
    fromMass(0.1349768, 4, 0, -2),
  ];
  const masses: [number, number][] = [[0.1056583755, 0.1056583755], [0.1056583755, 0.1056583755], [0.000511, 0.000511], [0, 0]];

  test('energy and momentum are conserved, in the lab and whatever the parent does', () => {
    const r = rng(1);
    parents.forEach((P, i) => {
      for (let n = 0; n < 50; n++) {
        const [a, b] = twoBodyDecay(r, P, masses[i]![0], masses[i]![1]);
        const s = sum([a, b]);
        const scale = Math.max(1, P.E);
        expect(Math.abs(s.E - P.E) / scale).toBeLessThan(1e-9);
        expect(Math.abs(s.px - P.px) / scale).toBeLessThan(1e-9);
        expect(Math.abs(s.py - P.py) / scale).toBeLessThan(1e-9);
        expect(Math.abs(s.pz - P.pz) / scale).toBeLessThan(1e-9);
      }
    });
  });

  test('each daughter has its own mass', () => {
    const r = rng(2);
    const [a, b] = twoBodyDecay(r, parents[1]!, 0.1056583755, 0.2);
    expect(mass(a)).toBeCloseTo(0.1056583755, 6);
    expect(mass(b)).toBeCloseTo(0.2, 6);
  });

  test('in the parent rest frame the daughters have the two-body momentum and are back to back', () => {
    const r = rng(3);
    const M = 91.188;
    const k = twoBodyMomentum(M, 0.1056583755, 0.1056583755);
    for (const P of [parents[0]!, parents[1]!]) {
      for (let n = 0; n < 20; n++) {
        const [a, b] = twoBodyDecay(r, P, 0.1056583755, 0.1056583755);
        const a0 = toRestFrame(a, P), b0 = toRestFrame(b, P);
        expect(pmag(a0)).toBeCloseTo(k, 6);
        expect(a0.px + b0.px).toBeCloseTo(0, 6);
        expect(a0.py + b0.py).toBeCloseTo(0, 6);
        expect(a0.pz + b0.pz).toBeCloseTo(0, 6);
      }
    }
  });

  test('the decay is isotropic in the rest frame: cos θ is uniform, the moments are right', () => {
    // A parent at rest, and a moving parent looked at in its own rest frame, must agree (boost invariance).
    for (const P of [parents[0]!, parents[1]!]) {
      const r = rng(4);
      const N = 40000;
      const bins = new Array(10).fill(0);
      let c2 = 0, cx = 0, cy = 0, cz = 0, phiSin = 0, phiCos = 0;
      for (let n = 0; n < N; n++) {
        const [a] = twoBodyDecay(r, P, 0.1056583755, 0.1056583755);
        const a0 = toRestFrame(a, P);
        const p = pmag(a0);
        const ux = a0.px / p, uy = a0.py / p, uz = a0.pz / p;
        bins[Math.min(9, Math.floor(((uz + 1) / 2) * 10))]++;
        c2 += uz * uz; cx += ux; cy += uy; cz += uz;
        const ph = Math.atan2(uy, ux);
        phiSin += Math.sin(ph); phiCos += Math.cos(ph);
      }
      // χ² of the ten bins of cos θ against a flat distribution (9 degrees of freedom): below the 0.001 point (27.9)
      const e = N / 10;
      const chi2 = bins.reduce((s, o) => s + (o - e) ** 2 / e, 0);
      expect(chi2).toBeLessThan(27.9);
      // ⟨cos²θ⟩ = 1/3 for a uniform sphere (θ uniform would give 1/2); ⟨u⟩ = 0 in each direction
      expect(Math.abs(c2 / N - 1 / 3)).toBeLessThan(0.01);
      expect(Math.abs(cx / N)).toBeLessThan(0.02);
      expect(Math.abs(cy / N)).toBeLessThan(0.02);
      expect(Math.abs(cz / N)).toBeLessThan(0.02);
      // φ is uniform: no net sine or cosine
      expect(Math.abs(phiSin / N)).toBeLessThan(0.02);
      expect(Math.abs(phiCos / N)).toBeLessThan(0.02);
    }
  });

  test('the direction is random: two calls differ, and the same seed repeats', () => {
    const a = twoBodyDecay(rng(5), parents[0]!, 0.1, 0.1);
    const b = twoBodyDecay(rng(5), parents[0]!, 0.1, 0.1);
    const c = twoBodyDecay(rng(6), parents[0]!, 0.1, 0.1);
    expect(a[0]).toEqual(b[0]);
    expect(a[0].px).not.toBeCloseTo(c[0].px, 6);
  });

  test('at threshold the daughters are at rest in the parent frame', () => {
    const P = fromMass(0.4, 0.5, 0, 0);
    const [a, b] = twoBodyDecay(rng(7), P, 0.2, 0.2);
    expect(pmag(toRestFrame(a, P))).toBeLessThan(1e-6);
    expect(pmag(toRestFrame(b, P))).toBeLessThan(1e-6);
  });
solution: |
  import type { P4, Rng } from 'hep';
  import { mass, twoBodyMomentum, fromMass, boost, boostVector } from 'hep/kinematics';

  export function twoBodyDecay(r: Rng, parent: P4, m1: number, m2: number): [P4, P4] {
    const M = mass(parent);
    const k = twoBodyMomentum(M, m1, m2);
    // a direction uniform on the sphere: cos θ uniform in [-1, 1], φ uniform in [0, 2π)
    const cosT = 2 * r() - 1;
    const sinT = Math.sqrt(1 - cosT * cosT);
    const phi = 2 * Math.PI * r();
    const ux = sinT * Math.cos(phi), uy = sinT * Math.sin(phi), uz = cosT;
    // back to back in the parent's rest frame
    const d1 = fromMass(m1, k * ux, k * uy, k * uz);
    const d2 = fromMass(m2, -k * ux, -k * uy, -k * uz);
    // boost into the lab with the parent's velocity
    const [bx, by, bz] = boostVector(parent);
    return [boost(d1, bx, by, bz), boost(d2, bx, by, bz)];
  }
hints:
  - 'Sampling cos θ uniformly gives equal areas on the sphere: the area element is sin θ dθ dφ = −d(cos θ) dφ.'
  - 'The boost that takes the rest frame into the lab is the parent''s own velocity, `boostVector(parent)` = p/E. `boost(a, bx, by, bz)` applies it.'
  - 'Give d2 the opposite momentum to d1, not the opposite direction with a different size: the two share the same k.'
```

:::programmer
Sampling an isotropic direction looks simple and has a standard mistake. Uniform in θ and φ is the natural first guess and is wrong: it crowds points near the poles, because circles of latitude near the poles are short. The correct recipe samples the variable in which the distribution is flat, cos θ, and the pattern returns in every generator: *find the variable in which the density is uniform, sample it, and transform*. The exercise's test catches the mistake by comparing ⟨cos²θ⟩ with 1/3 (θ uniform would give 1/2).
:::

:::hood[Inverse transform, two-body phase space and RAMBO]
Every random number in the course comes from a seeded generator, `rng(seed)`, which returns uniform numbers in [0, 1). Everything else is a transformation of those. The decay time of the clock above is the simplest case of **:term[inverse-transform sampling]{id=inverse-transform}**: if *u* is uniform and *F*(*t*) = 1 − e<sup>−*t*/τ</sup> is the cumulative distribution of the decay time, then *t* = *F*<sup>−1</sup>(*u*) = −τ ln(1 − *u*) has the distribution *F*. In the library (`hep/random`):

```ts
export function exponential(r: Rng, mean = 1): number {
  return -mean * Math.log(1 - r());
}
```

The argument of the logarithm is 1 − `r()` and not `r()` because `r()` can return exactly 0 and the logarithm of 0 is −∞; 1 − `r()` lies in (0, 1]. The Breit–Wigner mass of the particle gun is the same trick with the inverse of the arctangent, since the cumulative distribution of a Breit–Wigner is ½ + arctan(2(*m* − *M*)/Γ)/π.

The two-body decay of `hep/kinematics` is the exercise above, with `isotropic` giving the direction:

```ts
export function twoBodyDecay(r: Rng, parent: P4, m1: number, m2: number): [P4, P4] {
  const M = mass(parent);
  const k = twoBodyMomentum(M, m1, m2);
  const [ux, uy, uz] = isotropic(r);
  const d1 = fromMass(m1, k * ux, k * uy, k * uz);
  const d2 = fromMass(m2, -k * ux, -k * uy, -k * uz);
  const b = boostVector(parent);
  return [boost(d1, b[0], b[1], b[2]), boost(d2, b[0], b[1], b[2])];
}
```

For two bodies the set of allowed final states (the :term[**phase space**]{id=phase-space}) is just a sphere of directions, and uniform on the sphere is the right distribution when nothing else matters. For three or more bodies the allowed momenta form a bigger set with a complicated shape. The library offers two ways to sample it. `phaseSpace` uses **RAMBO** (Kleiss, Stirling and Ellis): it draws *n* massless four-momenta with isotropic directions and energies from the density *q*e<sup>−*q*</sup>, which in code is `-Math.log(r() * r())`, then boosts and rescales them to the required total mass; for massive particles a correction step and a weight follow. `uniformPhaseSpace` in `hep/decay` (GENBOD, James) builds the decay as a chain of two-body decays and keeps events by accept–reject, so that all events have weight one. Both are tested against each other. The same idea, sample what is easy and correct by a weight, is the subject of Chapter 4's under-the-hood box.
:::


:::note
**Session 3: event rates.** Use rate = cross section × luminosity, check units, then distinguish an expected count from one fluctuating observation.
:::

## Cross-sections and luminosity

How many Z bosons does a collider make? The answer is a product of two numbers, one from the theory of the collision and one from the machine.

A :term[**cross-section**]{id=cross-section} σ is the area that a single target presents to a beam, defined so that the probability that one beam particle interacts with one target is σ divided by the area of the beam. For a target much thicker than one layer, suppose the beam crosses a slab with *n* target nuclei per unit volume and thickness ℓ, and the beam area is *A*. The number of target nuclei in the beam is *n*ℓ*A*, each covering an area σ, so the interacting fraction is *n*ℓσ. The rate is then the beam's particles per second times *n*ℓσ. The factor outside σ depends only on the apparatus. It is the :term[**luminosity**]{id=luminosity}: *L* = (particles per second in the beam) × *n*ℓ, the number of collisions per second that a cross-section of one unit of area would make. For two colliding beams it comes from the beam sizes and intensities (Chapter 21), but the meaning is the same.

:::equation{#rate caption="Rate of events of a given kind: the cross-section of the process times the luminosity of the machine. Integrated over the running time, the number of events."}
$$\term{R}{R} = \term{sigma}{\sigma}\,\term{L}{L}, \qquad \term{N2}{N} = \sigma\int L\,\mathrm{d}t$$

```terms
R:
  label: 'R, the rate of events'
  what: |
    The number of events of the process of interest per second.
  why: |
    It is the number of collisions per second that a unit cross-section would give (L), times the cross-section.
  effect: |
    Double the luminosity or the cross-section and the rate doubles.
sigma:
  label: 'σ, the cross-section'
  what: |
    An area that measures how likely a process is, given a collision. It depends on the physics (the process and the collision energy) and not on the machine.
  why: |
    It is the quantity the theory predicts, in barns (10⁻²⁸ m²), usually pb or fb at the LHC.
  effect: |
    Z → μμ at 13 TeV: about 1.6 nb in this course's leading-order generator. Any proton–proton collision: about 80 mb, 50 million times more.
L:
  label: 'L, the instantaneous luminosity'
  what: |
    A property of the machine: the collisions per second per unit cross-section, in cm⁻² s⁻¹. The LHC's design value is 10³⁴ cm⁻² s⁻¹.
  why: |
    It depends on how many particles are in the beams and how tightly they are squeezed where they cross.
  effect: |
    At 10³⁴ cm⁻² s⁻¹, each picobarn of cross-section gives 0.01 events per second.
N2:
  label: 'N, the number of events'
  what: |
    How many events of the process occur in the running time. The average; the number actually seen fluctuates about it.
  why: |
    It is the rate accumulated over time, ∫L dt, the integrated luminosity, times σ.
  effect: |
    Integrated luminosity is quoted in inverse femtobarns: 1 fb⁻¹ gives one event for each femtobarn of cross-section.
```
:::

Here are the units worth memorising. One picobarn is 10⁻³⁶ cm², so a luminosity of 10³⁴ cm⁻² s⁻¹ is 0.01 pb⁻¹ per second, or 0.864 fb⁻¹ per day. A process with σ = 1 pb then occurs 0.01 times per second and 864 times per day. Figure 3.5 does this sum for five processes. The W, Z and top-pair cross-sections in it are the leading-order values that `hep/gen` computes in this course; they are not measurements, and a real calculation at higher order differs from them by tens of per cent. The inelastic cross-section, about 80 mb, is a rounded public value, and the 50 pb for the Higgs is the figure quoted in Chapter 0.

```numeric
id: zmumu-rate
title: Z → μμ events per second
prompt: 'The course generator computes σ(pp → Z → μ⁺μ⁻), for pair masses from 60 to 120 GeV, at 13 TeV and leading order as 1,587 pb. At a luminosity of 2 × 10³⁴ cm⁻² s⁻¹ (1 pb = 10⁻³⁶ cm²), how many such events are produced per second?'
answer: 31.74
unit: Hz
tolerance: 0.02
hints:
  - 'Convert the cross-section to cm²: 1587 pb = 1587 × 10⁻³⁶ cm².'
  - 'Rate = σ L.'
explain: 'R = 1587 × 10⁻³⁶ cm² × 2 × 10³⁴ cm⁻² s⁻¹ = 31.7 s⁻¹. About thirty muon pairs from Z bosons per second in a real machine is too few for a human to watch and far too many to record them all by hand, which is one reason the trigger exists (Chapter 27). The real rate is different because this is a leading-order calculation with simplified parton distributions, and because only a fraction of these events fall in a detector''s acceptance.'
```

```fermi
id: higgs-per-second
title: A Higgs boson every second?
prompt: 'The total cross-section for producing a Higgs boson in a proton–proton collision at 13 TeV is about 50 pb (Chapter 0). The LHC was designed for a luminosity of 10³⁴ cm⁻² s⁻¹. About how many Higgs bosons would be produced per second in a detector at that luminosity?'
answer: 0.5
unit: per second
factor: 3
hints:
  - '10³⁴ cm⁻² s⁻¹ is 0.01 pb⁻¹ per second.'
explain: 'R = 50 pb × 0.01 pb⁻¹ s⁻¹ = 0.5 s⁻¹: one Higgs boson every couple of seconds (at twice the design luminosity it is about one a second). Almost none of them can be told from the ordinary collisions that surround them, since a Higgs boson appears once in about two billion collisions (Chapter 0). Production is the easy half of the problem.'
```

### Poisson counting

The expected number of events, *N*, is an average. What you count in a run is an integer that fluctuates. The reason is the same as for decay: each of the many possible collisions has a tiny probability of producing the event of interest, and they are independent. The number of events in a fixed time then follows the :term[**Poisson distribution**]{id=poisson-distribution}.

:::equation{#poisson caption="The probability of counting exactly n events when μ are expected on average. The mean is μ and the standard deviation is √μ."}
$$P(\term{n}{n};\term{mu}{\mu}) = \frac{\mu^{n}\,e^{-\mu}}{n!}$$

```terms
n:
  label: 'n, the count'
  what: |
    The number of events actually observed, a non-negative integer.
  why: |
    Events are discrete, so the observed quantity is an integer even though the expectation is not.
  effect: |
    For μ much less than 1, n = 0 is by far the most likely outcome.
mu:
  label: 'μ, the expected count'
  what: |
    The average number of events over many repetitions of the same experiment; here μ = σ ∫L dt.
  why: |
    It is fixed by the physics and the machine. The fluctuations are fixed by μ as well.
  effect: |
    The standard deviation of n is √μ, so the relative uncertainty is 1/√μ: 10 % at μ = 100, 1 % at 10,000.
```
:::

The square root is the rule of thumb to keep: **a count of *n* has an uncertainty of about √*n***. It is why a bin of Figure 2.1 with 100 entries is uncertain by 10 %, and why the statistical precision of any measurement improves only as the square root of the data. Chapter 28 builds the whole statistics of discovery on the Poisson distribution.

::rate-counts{n="3.5" caption="Rate = σ L. Choose a process, a luminosity and a running time; the widget gives the rate and the expected count μ = σ L t, then repeats the experiment 2,000 times with a seeded random number generator. The histogram of counts is centred on μ, has a spread of √μ and follows the Poisson distribution (curve). For μ below 1 a count of zero is the most likely outcome."}

:::real{parts="a Geiger counter, potassium chloride salt substitute, a stopwatch or logging software"}
**Lab: are the clicks Poisson?** Count the decays of ⁴⁰K with a Geiger counter and check that the counts fluctuate the way Figure 3.5 says. Put the counter next to a bag of potassium chloride salt substitute (the product sold as a low-sodium salt), which is a weak, exempt source: a kilogram of it gives a rate of the order of ten to a hundred times the room background, so the counter's own background must be measured first, with no salt. Record the number of clicks in each of 100 consecutive intervals of, say, 10 seconds. Compute the mean μ and the variance of the 100 counts: for a Poisson process they are equal. Plot the histogram and compare it with *P*(*n*; μ). Appendix G gives the kit list and the safety notes: use only everyday, exempt materials, never bought or old radioactive sources, and keep the salt in its bag.
:::

:::experiments[In the experiments]
Lifetimes of hadrons with charm or bottom quarks (picoseconds) are measured by reconstructing how far from the collision point they decay, which Chapter 24 describes; the LHCb experiment is built for it. Widths too large for that, such as the Z's, come from the shape of the invariant-mass line (Chapter 23), fitted with a Breit–Wigner convolved with the detector response: ROOT, the data-analysis framework developed at CERN (Chapter 27), and its fitting package RooFit provide both `RooBreitWigner` and its convolution with a Gaussian, `RooVoigtian`. **Pythia**, a general-purpose event generator (a program that simulates what comes out of a collision), draws the lifetime, the decay channel and, for broad resonances, the mass from the same three ingredients as the decay clock: an exponential, a table of branching ratios and a Breit–Wigner. `hep/decay` does the same with the particle table. Luminosity is measured with dedicated detectors and by a method named after Simon van der Meer (Chapter 21).
:::

## What comes next

You now have the vocabulary of the rest of the course: particles have spin, and fall into fermions and bosons; quantum outcomes come from adding amplitudes; unstable particles have a lifetime, and a width that is the same number; every decay chooses its channel; and the number of events is a cross-section times a luminosity, with a √*N* uncertainty. You have also written the decay step of a generator, which can now make events for a detector to see.

[Chapter 4](/chapters/scattering-is-seeing/) asks what a cross-section tells you about the thing you fire at. It starts from the experiment of Geiger and Marsden, in which alpha particles bounced off a gold foil, derives how the count rate must depend on the angle if the charge of an atom sits in a point, and follows the same idea from alpha particles to the electrons that measured the size of the proton.

## Further reading

- David Griffiths, *Introduction to Elementary Particles*, for spin, identical particles and cross-sections at the level of this chapter (:cite[griffiths2008]).
- Richard Feynman, *The Feynman Lectures on Physics*, volume III, chapters 1 to 4, for amplitudes, the two-slit experiment and identical particles (:cite[feynman-lectures3]).
- The Particle Data Group's *Review of Particle Physics*: the tables of lifetimes and branching ratios, and its reviews of kinematics and of statistics (:cite[pdg2024]).
- Glen Cowan, *Statistical Data Analysis*, for the Poisson distribution and the use of counts (:cite[cowan1998]).
