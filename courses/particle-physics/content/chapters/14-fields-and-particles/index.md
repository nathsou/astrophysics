---
number: 14
title: Fields and particles
summary: A field is a row of coupled oscillators, a particle is a quantum of one of its waves, mass is a term in its equation, and a force is the field's response to a disturbance. Nothing in the chapter is built in except the oscillators.
duration: About 2½ hours
prerequisites: [quarks]
---

Every electron in the universe has the same mass and the same charge. Not nearly the same: no measurement has found a difference between two electrons. A factory cannot do this. Two screws made on the same machine differ in the fifth decimal place, and the machine wears. If electrons were manufactured objects, something would have to manufacture them with a precision that nothing else in nature shows. The physics of the twentieth century answered by denying the premise: an electron is not an object. It is a wave of a field that fills all space, in the same sense that a ripple is not an object but a state of the water, and every electron is a ripple in the same field, which is why they are the same.

This chapter builds that idea from a chain of masses and springs, which is the only apparatus it needs. The figure below is a row of 256 oscillators, each tied to its two neighbours. Launch a packet, and watch what it does.

::field-lattice{n="14.1" caption="A scalar field as a chain (or sheet) of coupled oscillators, integrated on the computer with the leapfrog method. Launch a wave packet and it moves along the chain at a steady speed: with the mass term at zero, at the wave speed c whatever its momentum. Raise the mass term and a packet with small momentum slows down, and the measured speed follows v = p/E. Under the picture, the Dispersion tab measures ω(k) from a simulation and compares it with E² = p² + m². Everything here is the classical field: no quantum mechanics has been put in yet."}

Nothing in that simulation contains a particle. The only rule is that each oscillator is pulled by its neighbours. Yet a localised bump travels without spreading much, carries energy and momentum, and with a mass term obeys the relativistic relations of Chapter 2. Two packets pass through each other (or, with the interaction switched on, scatter). If you were given only the pictures and asked what was moving, *a particle* would be the natural answer. The rest of this chapter makes that impression precise, then adds the one thing the classical picture lacks: the quantum.

## A field is a lot of oscillators

A **field** is a quantity with a value at every point of space, and possibly a direction or several components. The temperature in a room is a field, and so is the wind. A scalar field φ(*x*, *t*) has one number at each point. The oscillator chain is a field on a line, discretised: the number φ<sub>*i*</sub>(*t*) is the displacement of the *i*-th mass from rest.

The equation of motion of one oscillator follows from Newton's law with two forces on it: each neighbour pulls it toward itself with a spring force proportional to the difference in displacements, and, for the mass term, a third spring ties it to the floor.

:::equation{#lattice-eom caption="The chain of coupled oscillators: each mass is pulled toward its two neighbours and, through the mass term, toward its own rest position."}
$$\term{acc}{\ddot\phi_i} = \term{c}{c}^2\,\frac{\phi_{i+1} - 2\phi_i + \phi_{i-1}}{\term{a}{a}^2} - \term{m}{m}^2\,\phi_i$$

```terms
acc:
  label: 'φ̈ᵢ, the acceleration of oscillator i'
  what: The second time derivative of the displacement of the i-th mass.
  why: Newton's second law, with every mass set to one. The right-hand side is the force.
  effect: Where the field is curved (a crest or a trough) the acceleration is large, so crests and troughs do not stay put.
c:
  label: 'c, the wave speed'
  what: Set by the stiffness of the springs between neighbours, in units where the masses are one. In natural units it is the speed of light, c = 1.
  why: It is the speed at which a disturbance travels along the chain when there is no mass term.
  effect: Stiffer springs, faster waves.
a:
  label: 'a, the lattice spacing'
  what: The distance between neighbouring oscillators.
  why: It turns the difference between neighbours into a gradient. When a is much smaller than the wavelength, the chain behaves as a smooth field and the graininess is invisible.
  effect: The lattice is an approximation to the smooth field, and a finer lattice is a better one. The limit a → 0 is the continuum field of the textbooks.
m:
  label: 'm, the mass term'
  what: The strength of the spring that ties every oscillator to its own rest position.
  why: Without it, shifting the whole chain by a constant costs nothing, and a very long wave has almost no restoring force, so its frequency goes to zero. With it, even an infinitely long wave oscillates at frequency m.
  effect: At m = 0 the waves are massless and travel at c. The larger m is, the higher the lowest frequency and the slower a slowly moving packet goes.
```
:::

When the spacing *a* shrinks to zero the equation becomes $\partial_t^2\phi = c^2\partial_x^2\phi - m^2\phi$, the **Klein–Gordon equation**, which is the equation of a free scalar field in relativity (in natural units, $(\partial_t^2 - \nabla^2 + m^2)\phi = 0$). The simulation is a numerical solution of it, with the small, deliberate difference that space is a lattice.

The mass term deserves a remark, because Chapter 26 returns to it. A chain with *m* = 0 has a symmetry: adding the same constant to every φ<sub>*i*</sub> changes no force, since only differences between neighbours appear. The mass term breaks that symmetry, and in doing so gives every wave a minimum frequency. This is a first glimpse of a pattern that recurs: a mass is a cost of departing from a preferred value.

## Waves, energy and the dispersion relation

The equation is linear (for now), so its solutions are sums of plane waves $\phi_i = A\cos(k x_i - \omega t)$ with wave number $k$ and frequency ω. Substitute one into the equation of motion. The second time derivative gives $-\omega^2$. The difference between neighbours gives $2\cos(ka) - 2 = -4\sin^2(ka/2)$. So the wave solves the equation if and only if

:::equation{#dispersion caption="The dispersion relation of the lattice field. In the continuum limit it is E² = p² + m², the relativistic mass shell."}
$$\term{w}{\omega}^2 = \term{m2}{m}^2 + \frac{4\,c^2}{a^2}\,\sin^2\!\left(\frac{\term{k}{k}\,a}{2}\right) \;\;\xrightarrow{\;a\to 0\;}\;\; \omega^2 = m^2 + c^2k^2$$

```terms
w:
  label: 'ω, the angular frequency'
  what: How many radians per unit time the wave oscillates at a fixed point.
  why: In quantum mechanics the energy of a quantum of this wave is E = ħω (next section). Frequency is energy.
  effect: A wave of larger frequency has quanta of larger energy.
m2:
  label: 'm, the mass term'
  what: The same tying-to-the-floor strength as in the equation of motion.
  why: It sets the frequency of the longest waves, at k = 0, to ω = m.
  effect: Sets the rest energy of the quanta: E = m when p = 0.
k:
  label: 'k, the wave number'
  what: Radians per unit length, 2π divided by the wavelength.
  why: In quantum mechanics the momentum of a quantum is p = ħk (de Broglie). Wave number is momentum.
  effect: Short waves (large k) have large momentum. For ka near π the lattice bends the curve below the continuum one, because waves shorter than a few spacings cannot be represented well.
```
:::

Put *E* = ħω and *p* = ħ*k* (Chapter 3) and choose ħ = *c* = 1. The limit is $E^2 = p^2 + m^2$: the relation of Chapter 2 between the energy, momentum and mass of a particle. The lattice did not know about relativity; it got there because a wave equation with the same second derivative in space and time is relativistic. The mass of the particle is the lowest frequency of the field.

How fast does a packet move? A packet is a superposition of waves with a narrow spread of *k*, and it travels at the **group velocity** $v = d\omega/dk$. Differentiating $\omega^2 = k^2 + m^2$ gives $2\omega\,d\omega = 2k\,dk$, so

$$v = \frac{d\omega}{dk} = \frac{k}{\omega} = \frac{p}{E}.$$

That is the velocity of a relativistic particle of momentum *p* and energy *E* (Chapter 2). Nobody put it in. The crests inside the packet move faster: their **phase velocity** ω/*k* = *E*/*p* exceeds *c* whenever *m* > 0. This does not contradict relativity, because the crests carry no energy; the packet does.

```predict
q: 'In Figure 14.1, switch the mass term on (m around 0.5) and launch a packet with a small momentum, p = 0.3. What do you expect it to do, compared with a packet of the same momentum at m = 0?'
options:
  - text: It still moves at the wave speed c, because the springs between neighbours have not changed.
    why: 'The neighbour springs are unchanged, but the mass term changes the dispersion relation: ω² = m² + k², and the group velocity is k/ω, not 1. Only when m = 0 is it exactly c.'
  - text: It moves more slowly, at about p/E = 0.3/√(0.3² + 0.5²) ≈ 0.51 of c.
    correct: true
    why: 'The group velocity is dω/dk = k/ω = p/E. A packet with momentum small against its mass is slow, exactly like a massive particle with p ≪ m. Launch it and compare the measured speed, in the Packet tab, with this number. A packet with p much larger than m goes back to moving at very nearly c.'
  - text: It does not move at all, because the mass term anchors every oscillator.
    why: 'Each oscillator is anchored to its own rest position, but the coupling between neighbours still carries a disturbance along. The packet moves, more slowly, at p/E. It stops only in the limit p → 0.'
```

## Quanta: one oscillator, one energy ladder

So far everything is classical. The quantum step is small to state and large in its effects. A **normal mode** of the field (a plane wave with wave number *k*) behaves as a single harmonic oscillator of frequency ω<sub>*k*</sub>, independent of the others. The field is a collection of independent oscillators, one for each *k*. Quantum mechanics gives a harmonic oscillator of frequency ω a ladder of energy levels (the astrophysics course's [quantum primer](/astrophysics/ch/primer-quantum/) derives the ladder):

:::equation{#ladder caption="The energy levels of one mode, evenly spaced by ħω. A step up the ladder adds one quantum."}
$$\term{En}{E_n} = \left(\term{n}{n} + \tfrac12\right)\term{hw}{\hbar\omega}, \qquad \hat a^\dagger|n\rangle = \sqrt{n+1}\,|n+1\rangle, \qquad \hat a\,|n\rangle = \sqrt{n}\,|n-1\rangle$$

```terms
En:
  label: 'Eₙ, the energy of the mode'
  what: The energy stored in one normal mode when it holds n quanta.
  why: The levels are evenly spaced, so the energy is the ground-state energy plus n equal steps.
  effect: Adding a quantum always costs the same energy, ħω. That is why the quanta of a mode are identical.
n:
  label: 'n, the number of quanta'
  what: A whole number, 0, 1, 2, …, counting how many quanta of this mode are present.
  why: It is the occupation number. The mode is a particle counter.
  effect: n = 0 is the vacuum of this mode. n = 1 is one particle with momentum ħk and energy ħω.
hw:
  label: 'ħω, one quantum'
  what: The spacing between adjacent levels, the energy of one quantum of the mode.
  why: E = ħω for a quantum of frequency ω: Planck's and Einstein's relation for light, applied to every field.
  effect: A mode of higher frequency has more energetic quanta. For the lattice, ω is given by the dispersion relation.
```
:::

The operators **a**† and **a** (*creation* and *annihilation*) move the state up and down the ladder; $\hat a^\dagger|n\rangle = \sqrt{n+1}\,|n+1\rangle$ says that adding a quantum to a mode that already holds *n* has an amplitude that grows as √(*n* + 1). Every interpretation of the word *particle* in field theory reduces to this ladder:

- **A particle is one rung.** A quantum of the mode with wave number *k* has momentum ħ*k* and energy ħω<sub>*k*</sub>, so it obeys the dispersion relation, and, by the argument above, *E*² = *p*² + *m*².
- **Identical particles are a property of the ladder.** Two quanta in one mode differ in nothing, because the state is described only by how many there are. There is no label to attach. The rungs are equally spaced and every field of the same kind has the same ladder, so the quanta of the electron field everywhere are the same.
- **Particles can be created and destroyed**, by operators that take the state up or down the ladder. The number of quanta is not conserved unless the equations conserve it. A field is the natural language for processes in which particles appear (an electron–positron pair from a photon, Chapter 9) and disappear.
- **The vacuum is not empty.** The lowest rung, *n* = 0, has energy ½ħω, not zero. Summed over all modes of a field the vacuum energy is infinite on paper, and only *differences* of energy are observable in every experiment of this course. (Gravity is sensitive to total energy, which makes this sum a real puzzle outside our scope.)

For a field with *spin* a mode is additionally labelled by the polarisation, and quanta of fields of half-integer spin obey the exclusion principle instead of being stackable: no two in the same state, which is Pauli's rule of Chapter 3. The spin-½ case uses a different algebra (anticommutators, not commutators) and is not derived here.

::quanta-ladder{n="14.2" caption="One mode in two kinds of quantum state. With exactly n quanta (left), the average field is zero at all times: no wave, but the noise in the field grows with n. In a coherent state (right), the field oscillates like a classical wave of amplitude √(2n̄/ω), while the noise stays fixed at its vacuum value, so a wave with many quanta is a clean classical wave: its amplitude stands 2√n̄ noise widths above zero. The number of quanta is uncertain by √n̄, which is about 10 % at n̄ = 100 and one part in 10⁶ for a typical radio transmitter."}

The right-hand panel is the bridge to classical physics. A radio station or a laser produces a state with an enormous number of quanta in one mode, with a relative uncertainty in the number of quanta of only 1/√*n̄*. The field oscillates as a classical wave. Maxwell's equations are the classical limit of the equations of a field whose quanta are photons; the quantum of the electromagnetic field is the photon because the field equation has this ladder structure.

:::history{year=1927 title="Dirac quantises the electromagnetic field" people="Paul Dirac" source="Source: P. A. M. Dirac, Proc. R. Soc. Lond. A 114 (1927) 243."}
Quantum mechanics in 1926 could describe an atom, but it described light classically: a wave that an atom could absorb. It could not say why an excited atom alone in empty space emits light. Einstein had introduced the probability of spontaneous emission in 1916–17 as a number to be fitted;:cite[p4-einstein1917] nothing in the new mechanics explained it.

In 1927 Paul Dirac resolved the radiation field into its normal modes and treated each as a harmonic oscillator, then applied the quantum rules to the oscillators. The state of the radiation field was specified by the number of quanta in each mode. The coupling of the atom to the field became a term that changes these numbers, and so an atom can emit a quantum into a mode that held none: spontaneous emission follows. Dirac obtained Einstein's coefficients for spontaneous and stimulated emission and their relation, and showed that the quantised oscillators are equivalent to an assembly of light-quanta obeying Bose–Einstein statistics.:cite[p4-dirac1927]

It is usually counted as the beginning of quantum field theory. The idea of the chapter is already there: the particle, here the photon, is what the oscillator ladder calls a quantum, and emission and absorption are the creation and annihilation of quanta.
:::

## Interaction: how quanta are made and destroyed

A free field, whose equation is linear, has modes that do not influence each other. The packets in the flagship pass through one another unchanged, and the bars in its Normal modes tab stay put. Real particles interact, and in the field picture that means the equation of motion is not linear. The simulation lets you add the simplest nonlinear term, a force $-\lambda\phi^3$ on each oscillator. Switch it on and two packets that meet no longer pass through each other unchanged: they scatter, the energy spreads among modes, and a packet leaves behind waves of other wave numbers.

In the quantum theory an interaction term is a product of field operators, each of which is a sum of creation and annihilation operators. A term with three fields can annihilate one quantum and create two. It is the origin of every decay and scattering in this course. The electromagnetic interaction is a term of the form (the electron field) × (the electron field) × (the photon field) that annihilates an electron and creates an electron and a photon: *e*⁻ → *e*⁻γ, which is the vertex of Chapter 15. Two rules restrict which terms are allowed. The energy and momentum of the whole system are conserved, which is automatic when the terms are built from fields at one point. And symmetries forbid terms that would break them: the conservation of electric charge is the statement that every term is invariant under a change of the phase of the electron field, which Chapter 17 follows to its consequences.

That is all the classical picture needs. What remains is to ask what one particle does to another *without* being created: how a static charge produces a force on a distant one.

## Exchange and the Yukawa potential

Hold one source at rest in the field and ask what the field does around it. A source is a place where the field is pushed: a term *g*φ(0) in the energy. The field settles into a static profile, which satisfies the Klein–Gordon equation with a point source. In three dimensions, with time derivatives set to zero,

$$(-\nabla^2 + m^2)\,\phi(\vec r) = g\,\delta^3(\vec r).$$

This is a linear equation, so take its Fourier transform, to momentum space, where $-\nabla^2$ becomes $q^2$, the square of the momentum $\vec q$ flowing into the source:

$$\tilde\phi(q) = \frac{g}{q^2 + m^2}.$$

The factor 1/(*q*² + *m*²) is the **propagator** of the field (in its static form). It is the response of the field to a disturbance carrying momentum *q*. A second source at distance *r* has energy $g\,\phi(r)$ in the profile of the first: the energy of interaction is, with the sign that makes scalar exchange attractive,

:::equation{#yukawa caption="The potential energy of two static sources that exchange a particle of mass m: the Fourier transform of the propagator. Yukawa's potential."}
$$\term{V}{V}(\term{r}{r}) = -\frac{\term{g}{g}^2}{4\pi}\,\frac{e^{-\term{mr}{m}\,r}}{r} = -\frac{g^2}{4\pi}\,\frac{e^{-r/\term{R}{R}}}{r}, \qquad R = \frac{\hbar c}{mc^2}$$

```terms
V:
  label: 'V(r), the potential energy'
  what: The energy of the pair of sources when they are a distance r apart. The force is minus its slope.
  why: It is what the exchange of the field's quanta amounts to when the sources are at rest. It is found by solving the static field equation, and equals the Fourier transform of 1/(q² + m²).
  effect: Negative means attractive. It falls faster than 1/r because of the exponential.
r:
  label: 'r, the distance between the sources'
  what: Their separation, in any consistent units.
  why: Sets how far the field of one source has spread by the time it reaches the other.
  effect: At r much less than R the potential is indistinguishable from the Coulomb 1/r. At several R it is gone.
g:
  label: 'g, the coupling of the sources to the field'
  what: The strength with which a source pushes on the field, which is also the strength with which the field pushes on it. g²/4π plays the role of the fine-structure constant α.
  why: Each source couples once, so the energy of interaction goes as g × g.
  effect: Double the coupling and the potential is four times larger.
mr:
  label: 'm, the mass of the exchanged quantum'
  what: The mass term of the field that mediates the force.
  why: It enters the propagator as m² and so sets how fast the potential decays.
  effect: At m = 0 the exponential is 1 and V is the Coulomb 1/r: the photon. A heavy mediator gives a short-range force.
R:
  label: 'R, the range'
  what: The distance over which the potential falls by a factor e, ħc/mc². In natural units, R = 1/m.
  why: It is the Compton wavelength of the exchanged particle. The field cannot be pushed out farther than its own wavelength can reach.
  effect: For the pion, 1.41 fm. For the W boson, 2.5 × 10⁻³ fm. For the photon, infinite.
```
:::

The derivation, which uses only the integral of a Fourier transform, is in the box below. The consequence is the physics of the chapter: **the mass of the exchanged field sets the range of the force**. A massless field (the photon) gives the long-range 1/*r* of electricity. A massive one gives a force that dies exponentially beyond *R* = ħ*c*/*mc*². The pion, with a mass of 139.6 MeV, gives *R* = 197.3 MeV·fm / 139.6 MeV = 1.41 fm, which is about the range of the nuclear force between protons and neutrons. The W boson, at 80.4 GeV, gives *R* = 2.5 × 10⁻³ fm, which is why the weak force seems to act only on contact: its range is thousands of times smaller than a nucleus (about 10 fm across).

:::deeper[The Fourier transform behind Yukawa's potential]
We need $G(r) = \int \frac{d^3q}{(2\pi)^3}\,\frac{e^{i\vec q\cdot\vec r}}{q^2+m^2}$. Do the angular integral first: for a function of $|q|$ alone, $\int d\Omega\, e^{i\vec q\cdot\vec r} = 4\pi\,\sin(qr)/(qr)$, so

$$G(r) = \frac{1}{2\pi^2 r}\int_0^\infty \frac{q\,\sin(qr)}{q^2+m^2}\,dq = \frac{1}{4\pi^2 r}\,\mathrm{Im}\int_{-\infty}^{\infty}\frac{q\,e^{iqr}}{q^2+m^2}\,dq.$$

Close the contour in the upper half-plane. The only pole there is at *q* = *im*, with residue $\tfrac12 e^{-mr}$, and $2\pi i \times \tfrac12 e^{-mr} = i\pi e^{-mr}$. The imaginary part is $\pi e^{-mr}$, so $G(r) = e^{-mr}/(4\pi r)$. For *m* = 0 this is the Coulomb potential 1/(4π*r*) of a point charge. The integral converges only conditionally at large *q*; the course's test suite checks the result against a numerical evaluation with a convergence factor.
:::

### What a virtual particle is, and what it is not

The propagator 1/(*q*² + *m*²) is the object that physicists call a **virtual particle**. The phrase is a source of a great deal of confusion, so here is what it does and does not mean.

What it is: in the perturbation theory of Chapter 15, where the response of the field to an interaction is expanded in a series, each term contains a factor like this propagator for every internal line. The factor is large when the energy and momentum flowing through the line nearly satisfy the mass-shell relation $E^2 = p^2 + m^2$, and moderate or small when they are far from it. A line for which they do not satisfy it is called **off shell**, or virtual. For the static potential above the exchanged momentum is entirely spatial, *E* = 0, so *E*² − *p*² = −*q*² is *negative*: nothing could be on shell.

What it is not:

- **Not a particle that briefly exists and could be detected.** A detector registers only quanta that arrive in the final state, on shell. No experiment measures a virtual particle; it is part of the calculation that connects initial and final states.
- **Not a violation of energy conservation.** The often-quoted story is that the exchanged particle "borrows" an energy Δ*E* for a time Δ*t* ≈ ħ/Δ*E*, so that a particle of mass *m* can travel at most *c*Δ*t* ≈ ħ/*mc*. That was the heuristic of Yukawa's 1935 paper (the source of the range argument) and it gives the right range.:cite[p4-yukawa1935] But energy is exactly conserved in every term of the calculation, and in the static case there is no time-dependent exchange at all: the potential is a property of the field's static profile. Treat the story as a mnemonic, not as a mechanism.
- **Not a separate kind of object.** "Virtual" describes a *line in a diagram*, not a class of particle. The same propagator describes the Z boson that decays (its line is nearly on shell, at *s* ≈ *M*<sub>Z</sub>², where 1/(*s* − *M*²) is almost singular and the Breit–Wigner peak of Chapter 3 appears) and the photon that carries a static force (far off shell). There is a continuum between them.
- **Not in the calculation because of the diagram.** Diagrams are a bookkeeping device for a series of terms; they are introduced properly in Chapter 15. A lattice simulation of a field has no diagrams at all and describes the same forces.

::propagator{n="14.3" caption="The propagator 1/(q² + m²) and the potential it gives, for a chosen mediator mass. Start with the electron (range 386 fm, essentially Coulomb in the nucleus) and compare the pion, the ρ meson and the W. The second tab runs Yukawa's argument backwards: from a range to a mass. In 1935 the range of the nuclear force was known only roughly, and the mass was not measured; the pion was found in 1947 (Chapter 10)."}

```fermi
id: fields-weak-range
title: The mass of the carrier of the weak force
prompt: 'The weak force, which turns a neutron into a proton in beta decay, acts over a distance of about 10⁻¹⁸ m, a thousandth of the radius of a proton. Using the range of exchange R = ħc/mc² and ħc = 197 MeV·fm, estimate the mass, in GeV, of the particle that carries it.'
answer: 197
unit: GeV
factor: 3
hints:
  - 1 fm = 10⁻¹⁵ m, so 10⁻¹⁸ m = 10⁻³ fm.
  - m = ħc/R, with ħc in MeV·fm and R in fm gives MeV.
explain: "m = ħc / R = 197 MeV·fm / 10⁻³ fm = 1.97 × 10⁵ MeV ≈ 200 GeV. The particles that carry the weak force are the W boson (80.4 GeV) and the Z boson (91.2 GeV), within a factor of 2.5 of this crude estimate (Chapter 23). The same steps in 1935 gave the pion mass from the range of the nuclear force: 197 MeV·fm / 1.4 fm ≈ 140 MeV."
```

```numeric
id: fields-muon-range
title: The range of a muon-mass mediator
prompt: 'A hypothetical force is carried by a particle with the mass of the muon, 105.66 MeV. What is its range R = ħc/mc² in femtometres? (ħc = 197.327 MeV·fm.)'
answer: 1.8676
unit: fm
tolerance: 0.01
hints:
  - Divide ħc by the mass in MeV.
explain: "197.327 / 105.658 = 1.867 fm. A force with this range would be felt across a nucleus, which is why the muon, when it was found in the 1930s, was at first mistaken for Yukawa's particle (Chapter 10): the mass was about right. It turned out that the muon does not interact strongly."
```

## Fields in code

:::programmer
A lattice field is a **stencil computation**: each cell's new value depends on its neighbours', the same pattern as a blur, a cellular automaton or a finite-difference solver for heat or waves. The update in the figure is that stencil with a second time derivative, stepped by the leapfrog scheme below. The normal modes are the Fourier modes because the coupling matrix of a periodic chain is a **circulant** matrix, diagonalised by the discrete Fourier transform. A physicist says "go to momentum space"; an engineer says "run an FFT", and they mean the same computation. The Dispersion tab does exactly that: it records φ(*x*, *t*) from random noise and takes a two-dimensional FFT, whose bright ridge is ω(*k*).
:::

:::hood[The leapfrog and why it keeps the energy]
The update in the library, in `hep/fields/lattice.ts`, is the kick–drift–kick form of the leapfrog (velocity Verlet). π is the velocity φ̇ and *f* the force:

```ts
step(): void {
  const { n, dt } = this.p;
  const h = dt / 2;
  const { phi, pi, f } = this;
  for (let i = 0; i < n; i++) {
    pi[i] = pi[i]! + h * f[i]!;      // half kick
    phi[i] = phi[i]! + dt * pi[i]!;  // drift
  }
  this.updateForce();
  for (let i = 0; i < n; i++) pi[i] = pi[i]! + h * f[i]!; // second half kick
}
```

and the force is the right-hand side of the equation of motion, `k*(r - 2*x + l) - m2*x - lambda*x*x*x`, with periodic neighbours. Three properties matter. The scheme is **symplectic**: it conserves the phase-space volume, as the true dynamics does, and therefore conserves a nearby "shadow" energy exactly. The energy in the readout wobbles at order Δ*t*² and never drifts, which a simple Euler step would not do (its error grows with time). The scheme is **time-reversible**. And it has a **stability limit** of Δ*t*²(4*c*²/*a*² + *m*²) < 4: a larger step gives waves that grow without bound, because the discrete oscillator has a highest frequency it can follow. The time step also changes the dispersion relation slightly, to $\sin(\omega\,\Delta t/2) = \tfrac{\Delta t}{2}\sqrt{m^2 + (4c^2/a^2)\sin^2(ka/2)}$, which is the thin black curve in the Dispersion tab of Figure 14.1.
:::

:::experiments
The field-on-a-lattice idea is not only a teaching device. **Lattice QCD** (Chapter 18) puts the quark and gluon fields on a four-dimensional space-time lattice and computes the masses of hadrons, the strong coupling and parts of the muon's magnetic moment, on the largest supercomputers, with exactly the integrate-on-a-grid, extrapolate-to-zero-spacing programme of this chapter. The generators used by the experiments go the other way: they do not simulate the field but use the propagator as a factor in a cross-section. The course's `hep/sm` module has the propagator of a massive particle with a width, `propagator(s, M, Γ)`, the Breit–Wigner form of the factor 1/(*s* − *M*²) that the Z boson's line contributes (Chapter 23), and the generators that the experiments use (Pythia, MadGraph) contain the same factor.
:::

## Reading the flagship again

Go back to Figure 14.1 with these tools, and check each claim of the chapter against it.

1. **A particle is a wave packet.** Launch a packet and read its measured speed in the Packet tab. It follows *p*/*E*.
2. **The mass is the lowest frequency.** In the Dispersion tab at *m* = 0.5, the measured ridge starts at ω = 0.5, not at zero.
3. **The quanta of a free field do not interact.** At λ = 0, send two packets through each other. They pass. In the Normal modes tab the energies in the bars do not move.
4. **An interaction exchanges energy between modes**, and the packets scatter. Set λ to 2 and launch two packets. This is the classical counterpart of what Chapter 15's diagrams describe quantum mechanically.
5. **The 2D sheet** shows the same thing in two dimensions: a pluck at the middle makes a ring that spreads outwards at the wave speed.

## What comes next

The chapter gave the picture: particles as quanta of fields, forces as the response of a field to a source, and the range of a force as the mass of the field that carries it. It did not give a way to *compute* a scattering, where particles arrive, interact and leave. [Chapter 15](/chapters/feynman-diagrams/) supplies one: Feynman's diagrams, in which each internal line is a propagator of the kind found here and each vertex is an interaction term. Chapter 16 then uses them to compute the first cross-section of the course, e⁺e⁻ → μ⁺μ⁻.

## Further reading

- Dirac's 1927 paper, cited in the history card above, for the original argument (:cite[p4-dirac1927]).
- Yukawa's 1935 paper for the original range argument (:cite[p4-yukawa1935]); Chapter 10 tells how the pion was found.
- The Particle Data Group's review for the masses used here (:cite[pdg2024]).
- For a full quantum-field-theory treatment with the same scalar field and its propagator: M. E. Peskin and D. V. Schroeder, *An Introduction to Quantum Field Theory* (1995), chapter 2 (:cite[p4-peskin1995]).
