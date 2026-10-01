---
number: 9
title: Antimatter
summary: A photograph taken in 1932, an equation written in 1928, and what happened when they were put side by side. Then the machines that make the thing the photograph showed, and the hospital scanner that uses it.
duration: About 2½ hours
prerequisites: [relativity-for-particles, tracks]
---

In the summer of 1932, at the California Institute of Technology, Carl Anderson was photographing cosmic rays. His apparatus was a cloud chamber (Chapter 5) between the poles of a large electromagnet, with a plate of lead 6 millimetres thick across the middle of the chamber. A charged particle that crosses a cloud chamber leaves a line of droplets; the magnet bends the line; and the lead takes some of the particle's energy, so that the curve changes where the particle passes through the plate. Anderson had taken more than a thousand pictures of cosmic-ray tracks. One of them is about to be put in front of you, and what it shows is a particle that nobody was looking for.:cite[chambers-anderson1933]

The field in the picture points out of the page, and its strength was about 1.5 tesla (15,000 gauss). The chamber was vertical, the plate horizontal. The particle entered from one side of the plate and left by the other. You have the tools to work out what it was, and you have all the information that Anderson had. Before you use the widget, commit to one thing.

```predict
q: 'A charged particle crosses the lead plate and leaves it with less momentum than it had. The magnetic field is the same above and below. On which side of the plate is its track more strongly curved (a smaller radius of curvature)?'
options:
  - text: On the side it reached first, before the plate, because it was moving fastest there.
    why: 'A faster particle is stiffer and bends less. The radius of curvature is R = p/(0.3 B) for a particle of unit charge, so the radius grows with momentum.'
  - text: On the side it reached after the plate, because it then has less momentum.
    correct: true
    why: 'R = p/(0.3 B) in metres, for p in GeV/c and B in tesla. Less momentum, smaller radius, tighter curve. So the more tightly curved side is where the particle ended up, which tells you which way it was going without any clock.'
  - text: The curvature is the same on both sides, because the field is the same.
    why: 'The field decides the direction of the bend, not its size. The radius also depends on the particle''s momentum, and the plate takes some of that away.'
```

Take the picture below as a measurement problem. Select the track (click it, or use the list under the picture), and the widget measures its radius of curvature on each side of the plate and its ionisation for you. Nothing is labelled. It then asks five questions in the order in which you would answer them: which way the particle went, what sign its charge had, whether it was light or heavy, and what it was. The photograph is a re-simulation with the apparatus and the momenta that Anderson reported, not the original plate, and each “another exposure” is a new simulated event from the same apparatus, which you can also try.

::cloud-chamber{preset="anderson" n="9.1" caption="Anderson's photograph, re-simulated with his field (1.5 T out of the page), his 6 mm lead plate and the momenta he reported. Select the track, read off the radii above and below the plate, and answer the five questions. The widget reveals what the particle was only after you have committed to all five."}

## Reading the picture

Everything you needed was in the geometry. Work through it in the order the widget did.

**Which way did it move?** The plate can only take energy away. So the particle is more strongly bent on the side it went *to*, and that side is the one with the smaller radius. The track above the plate is bent with a radius of about 5 cm, and below the plate with a radius of about 14 cm. The particle moved upwards. This is the ordinary method for the direction of a track in a detector that has a plate, and Anderson introduced the plate for exactly that reason: a chamber without one cannot tell a particle going up from one going down.

**What sign was its charge?** A charge $q$ moving with velocity $\vec v$ in a magnetic field $\vec B$ feels the force $q\,\vec v\times\vec B$. With the field out of the page and the velocity upwards, a positive charge is pushed to the right and a negative one to the left. Going up, the track curves to the right: a **positive** charge. (Had it been moving down, the same curve would mean a negative charge. The direction of motion and the sign of the charge cannot be separated in a picture of one track without a plate, which is why the plate mattered.)

**How much momentum?** For a particle with one unit of charge, the radius, the field and the momentum (perpendicular to the field, which is all of it here) are related by

:::equation{#radius caption="Radius of curvature of a charged particle in a magnetic field."}
$$\term{p}{p} = 0.2998\;\term{B}{B}\,\term{R}{R}\qquad(p\text{ in GeV}/c,\; B\text{ in T},\; R\text{ in m})$$

```terms
p:
  label: 'p, the momentum'
  what: The momentum of the particle perpendicular to the field, in GeV/c. Here the whole of it, since the particle moves in the plane of the picture.
  why: The magnetic force is perpendicular to the velocity and does no work, so it bends the path without changing the speed. A heavier momentum is harder to bend.
  effect: Double the momentum and the circle's radius doubles.
B:
  label: 'B, the magnetic field'
  what: The strength of the field in tesla. Anderson's was about 1.5 T, 15,000 gauss.
  why: The force grows in proportion to the field.
  effect: Double the field and the radius halves.
R:
  label: 'R, the radius of curvature'
  what: The radius of the circle the track follows, in metres.
  why: It is the quantity you measure on the picture. The momentum follows from it.
  effect: A radius of 14 cm in 1.5 T means p = 0.2998 × 1.5 × 0.14 = 0.063 GeV/c.
```
:::

The radii above and below the plate give 0.023 GeV/c and 0.063 GeV/c, or 23 and 63 MeV/c, the numbers that Anderson reported. The particle had lost about two thirds of its momentum in the plate.

**Was it heavy or light?** Here the droplets help. The ionisation a particle leaves, per millimetre of its track, depends on its speed and not directly on its mass: a slow particle ionises more (Chapter 6). A proton with a momentum of 63 MeV/c is slow, with a kinetic energy of 2.1 MeV, and it would ionise about a hundred times the minimum. After the plate, at 23 MeV/c, it would be at 0.28 MeV and would ionise about four hundred times the minimum. But the simulated track, like Anderson's, has a thin, light line of droplets, with an ionisation only a little above the minimum: that is the signature of a particle moving at nearly the speed of light at those momenta, which can only be a particle that is light.

The argument from range, which Anderson also made, is shorter. A proton with a momentum of 23 MeV/c has a range in air of about 4 mm, by the course's energy-loss model (`csdaRange` in `hep/chamber`). The track above the plate is several centimetres long. The particle was not a proton. That leaves two light candidates: the electron, which is negative, and something with the electron's lightness and a positive charge. The direction of motion and the curvature say positive.:cite[chambers-anderson1933] The equation of the next section says that the mass is exactly the electron's.

The particle is a **positron**: a particle with the mass of the electron and a positive charge. It is the first antiparticle ever seen.

:::history{year=1932 title="The photograph with the plate" people="Carl D. Anderson, Seth Neddermeyer" source="Sources: Anderson (1932, 1933); Blackett and Occhialini (1933)."}
Anderson was a young researcher at Caltech, working under Robert Millikan, who wanted to know the nature of the cosmic rays. In August 1932 he took a photograph of a track that crossed the 6 mm lead plate and was bent more strongly above the plate than below it. He reported it in *Science* in September 1932 and in detail in the *Physical Review* in March 1933, where he says that of 1,300 photographs, 15 showed a positive particle that could not be as heavy as a proton.:cite[anderson1932,chambers-anderson1933] The 1933 paper is where the name "positron" appears, in a title that reads *The positive electron*.

In England, Patrick Blackett and Giuseppe Occhialini had built a cloud chamber that was triggered by two Geiger counters placed above and below it: the particles themselves took the photograph, instead of it being taken at random. They found showers of electrons and positrons in the same pictures, produced together, and gave the new particle a second, independent confirmation.:cite[blackett1933] Anderson received the Nobel Prize in Physics in 1936, shared with Victor Hess (Chapter 10).
:::

## The equation that said too much

Anderson had not been looking for the positron, and had not been told to. Four years earlier, the positron had been written into an equation, and the man who wrote it had not known it was there.

The story starts with a sentence of Chapter 2, $E^2 = p^2 + m^2$, taken as an equation for a quantum particle. Quantum mechanics says that a state evolves in time according to the **Schrödinger equation**, $i\hbar\,\partial\psi/\partial t = H\psi$, which is first order in the time derivative, where $H$ is an operator that represents the energy. For a slow particle $H = p^2/2m$ works. For a fast one, Einstein's energy $E = \pm\sqrt{p^2 + m^2}$ has a square root of an operator in it, which is not a well-defined thing. The obvious fix, squaring the equation, gives $E^2 = p^2 + m^2$ as an equation with a second derivative in time. This is the Klein–Gordon equation. It works for spin-0 particles, but it had an apparent disease in 1928: it gave negative probabilities, which no one then knew how to interpret. Paul Dirac wanted an equation that was first order in time and compatible with relativity, and a first-order equation needs a square-root-free energy.

### Taking the square root of a sum of squares

Dirac's idea was to find a $H$ that is *linear* in the momentum and in the mass, and whose square is nevertheless the right thing:

:::equation{#dirac-h caption="Dirac's requirement: an energy operator linear in the momentum whose square is the relativistic energy."}
$$\term{H}{H} = \term{alpha}{\vec\alpha}\cdot\vec p + \term{beta}{\beta}\,\term{m}{m}\qquad\text{with}\qquad H^2 = p^2 + m^2$$

```terms
H:
  label: 'H, the energy operator'
  what: The operator whose eigenvalues are the allowed energies. It acts on a wave function with several components.
  why: Quantum mechanics asks for an equation of the form iħ∂ψ/∂t = Hψ, first order in time, so that the state at one moment fixes the state at the next.
  effect: Squaring it must give the relativistic E² = p² + m², the requirement that decides everything below.
alpha:
  label: 'α, three numbers that are not numbers'
  what: Three objects, α₁, α₂, α₃, multiplying the three components of the momentum.
  why: For H² to contain no cross-terms like p_x p_y, the α's must anticommute with each other: α₁α₂ = −α₂α₁. Ordinary numbers do not do that.
  effect: Each α squares to 1, so that the p_x² terms come out with coefficient 1.
beta:
  label: 'β, the coefficient of the mass'
  what: A fourth object that multiplies the mass.
  why: It too must anticommute with each α (so there is no term linear in m p) and square to 1 (so that the m² term has coefficient 1).
  effect: At rest, where p = 0, H is just β m.
m:
  label: 'm, the mass'
  what: The mass of the particle, in GeV.
  why: It sets the energy at rest.
  effect: The gap between the two energy branches, below, is 2m.
```
:::

Expand $H^2$ and demand that it equal $p^2 + m^2$ for every momentum. The terms in $p_x p_y$ and $m\,p_x$ must vanish, and the squared terms must have coefficient 1. That gives a list of conditions on the four objects: each squares to 1, and any two of them anticommute. **No four ordinary numbers satisfy them**, because numbers commute. Dirac noticed that *matrices* can. The smallest matrices with the property are $4\times4$: the three Pauli matrices $\sigma_1, \sigma_2, \sigma_3$ ([Appendix A](/appendix/maths/)), each $2\times2$, anticommute with each other, but there is no fourth $2\times2$ matrix that anticommutes with all three, so a fourth needs room. In blocks of $2\times2$:

$$\beta = \begin{pmatrix} 1 & 0\\ 0 & -1\end{pmatrix},\qquad \alpha_i = \begin{pmatrix} 0 & \sigma_i\\ \sigma_i & 0\end{pmatrix},\qquad i = 1,2,3.$$

You can check it in one line: the square of $\alpha_i$ is $\begin{pmatrix}\sigma_i^2 & 0\\ 0 & \sigma_i^2\end{pmatrix}$, which is the identity because $\sigma_i^2 = 1$; and $\alpha_i$ anticommutes with $\beta$ because the off-diagonal blocks change sign when $\beta$ multiplies from the left rather than from the right. The library's tests do the full check numerically, all the anticommutators and $H^2 = (p^2 + m^2)\mathbb 1$, for any momentum and mass (`src/lib/sims/part3/dirac.ts`).

The wave function $\psi$ that this $H$ acts on has therefore **four components**: a *spinor*, two numbers for each of the two blocks. This is where the spin of the electron comes from. Dirac did not put it in: two of the four components are the two spin states, and he found that the equation gives the electron a magnetic moment with $g = 2$, which was the measured value, unexplained until then.:cite[dirac1928]

### Two of the four components have negative energy

Now solve $H\psi = E\psi$. The simplest case is a particle at rest, $p = 0$. Then $H = \beta m$, which is diagonal: $H = \mathrm{diag}(m, m, -m, -m)$. Two solutions have $E = +m$ and two have $E = -m$. For any momentum, the same holds, since $H^2 = (p^2+m^2)\mathbb 1$ means that every eigenvalue squares to $p^2 + m^2$, and since $H$ has trace zero (the $\alpha$'s and $\beta$ are traceless), the eigenvalues must be two of each sign:

:::equation{#dirac-spectrum caption="The spectrum of Dirac's equation: two branches, each twice (two spin states)."}
$$\term{E}{E} = \pm\sqrt{\,\term{p2}{p^2} + m^2\,}\qquad(\text{each sign for two spin states})$$

```terms
E:
  label: 'E, an allowed energy'
  what: An eigenvalue of H. A free electron of momentum p can have either energy.
  why: The negative sign is not an artefact of squaring the equation: it is a genuine pair of the four components of the wave function.
  effect: At p = 0 the two values are +m and −m, so the allowed energies are separated by a gap of 2m (1.022 MeV for an electron).
p2:
  label: 'p², the momentum squared'
  what: The squared length of the momentum vector.
  why: It enters as in E² = p² + m².
  effect: At large momentum both branches approach ±p.
```
:::

The classical argument threw the negative root away because a particle with negative energy would be absurd. Quantum mechanics cannot do that: the negative-energy solutions are a part of the equation's complete set of solutions, and a perturbation such as a photon can push a particle from any state into any other. The figure shows both branches and the gap between them. Try a photon of more than twice the electron's energy and less than twice.

::dirac-levels{n="9.2" caption="The two branches E = ±√(p²+m²) of a free electron, in units of the electron's mass. The gap at p = 0 is 2mc² = 1.022 MeV. A photon of at least 2E can lift an electron from the lower branch to the upper one at the same momentum; what it leaves behind is a hole."}

### The sea, the hole, and what he predicted

If electrons could fall into the negative-energy states, atoms would collapse with a burst of radiation, as all the electrons dropped downwards forever. Dirac's answer in 1930 was that all the negative-energy states are already filled, and that the exclusion principle (Chapter 3) stops an electron from falling into a state that is occupied. The filled sea is invisible: it has no net charge or energy that we can measure, since it is everywhere. What one can see is a *disturbance* of it. A photon of energy 2mc² or more can lift one electron out of the sea into a positive-energy state, and leaves a **hole**. A missing electron of negative energy and negative charge behaves as a particle with *positive* energy and *positive* charge, and with the electron's mass.

Dirac's first reading, in 1930, was that the hole was a proton, since that was the only positive particle then known.:cite[dirac1930] That could not be right: a hole has exactly the electron's mass, and the proton is 1836 times heavier. In 1931 Dirac proposed that the hole is a new particle, with the electron's mass and the opposite charge, an **anti-electron**, and he noted that the same argument would apply to the proton.:cite[dirac1931] That is a prediction, and about a year later Anderson's photograph confirmed the first half of it.

:::history{year=1928 title="Dirac takes the square root" people="Paul A. M. Dirac" source="Sources: Dirac (1928, 1930, 1931)."}
Dirac published the relativistic equation for the electron in February 1928, in the *Proceedings of the Royal Society*.:cite[dirac1928] Its success was immediate: it gave the electron's spin and its magnetic moment, and the fine structure of hydrogen, from one assumption. Its difficulty was also immediate. In 1930 he proposed that the negative-energy states were filled, and identified the holes with protons.:cite[dirac1930] In 1931 he accepted that the holes had to have the electron's mass, and named them anti-electrons.:cite[dirac1931] The prediction and Anderson's photograph came about a year apart.

The picture of a sea has been dropped since. Quantum field theory (Chapter 14) replaces it with a cleaner statement: every field has particles and antiparticles as its quanta, and there is no sea. The prediction survived; its first explanation did not.
:::

## What an antiparticle is

The positron is the model. For every particle there is an **antiparticle** with:

- the same mass, the same spin and the same lifetime (or the same stability);
- the opposite value of every additive quantum number: electric charge, baryon number, lepton number, strangeness, and the rest that the next chapter collects.

A few particles are their own antiparticles: the photon, the $\pi^0$, the $Z$ boson, the Higgs boson. They have no additive charges to reverse. The other statements (equal mass and lifetime) follow from a deep property of relativistic quantum theories, the CPT theorem, and have been tested: the masses of the antiproton and the proton agree to better than a part in $10^{9}$, for instance.:cite[pdg2024]

In the particle table this is a single idea in a few lines. The library stores each particle once and *derives* the antiparticle by flipping every additive quantum number:

:::hood[How the particle table makes antiparticles]
```ts
// src/lib/hep/particles/index.ts
function anti(p: Particle): Particle {
  const flip = (x: number) => (x === 0 ? 0 : -x);
  return {
    ...p,
    pdg: -p.pdg,
    name: flipName(p.name),
    symbol: flipSymbol(p.symbol),
    charge3: flip(p.charge3),
    baryon3: flip(p.baryon3),
    lepton: [flip(p.lepton[0]), flip(p.lepton[1]), flip(p.lepton[2])],
    strangeness: flip(p.strangeness),
    // … charm, bottom, top, isospin, the quark content, the decay products
  };
}
```
`particle(-11)` is the positron, `particle(2212)` the proton and `particle(-2212)` the antiproton: the experiments' convention of a **PDG Monte Carlo number** gives each antiparticle the negative of its particle's number, and the table relies on it. The mass, spin, width and lifetime are copied unchanged, which is the statement above about equal properties. The particles that are their own antiparticles carry a `selfConjugate` flag, so that `particle(-22)` is an error, not a second photon.

One detail to be careful with: derived names are built from the particle's name by exchanging the sign, so the antiparticle of the $\Delta^+$ has the name `Delta-`, which is also the name of the $\Delta^-$ (*ddd*). The PDG numbers are unambiguous, and the names are not: use the numbers in code.
:::

:::programmer
An antiparticle is what you would get if you wrote the particle's record as a struct of integers and defined negation on it. The additive quantum numbers form an abelian group, $\mathbb{Z}^n$, and "the antiparticle" is the group inverse, applied to the charges but not to the mass. Conservation laws, which the next chapter collects, are then statements about sums in that group: a reaction is allowed only if the total of the inputs equals the total of the outputs, and a particle and its antiparticle sum to the identity, which is why they can annihilate to nothing but energy. The sign convention for the PDG identification number is the same trick one layer up.
:::

## Making pairs, and unmaking them

The positron turns up when a photon turns into an electron and a positron, and it disappears when it meets an electron again. Both processes can be understood with Chapter 2's invariant mass.

**Pair production.** Can a photon, alone in empty space, turn into $e^+e^-$? Its four-momentum has invariant mass zero: $p_\gamma^2 = 0$. The pair that it would turn into has a mass of *at least* $2m_e$, since a pair at rest has a total energy of $2m_e$ and any motion adds to it. A four-vector cannot change its invariant mass, so the conversion is impossible. In the electric field of a nucleus it is possible: the nucleus takes up a small part of the momentum and none of the energy to speak of, and the threshold on a heavy nucleus of mass $M$ is

$$E_\gamma^{\text{threshold}} = 2 m_e\left(1 + \frac{m_e}{M}\right) \approx 2 m_e = 1.022\ \text{MeV}.$$

In the photograph of a bubble chamber, the conversion is a V with two thin arms that curve in opposite directions: the magnetic field bends the electron one way and the positron the other, and this is how the sign of the charge is read.

::bubble-chamber{n="9.3" preset="pair" caption="A simulated bubble chamber in a magnetic field. A π⁰ was made outside the picture and decayed into two photons, which are neutral and leave no track. Each photon then converted into an e⁺e⁻ pair in the liquid hydrogen: a V whose arms curve in opposite directions. The more energetic a pair, the narrower its V."}

**Annihilation.** The reverse: an electron and a positron that meet at rest turn into photons. Why two photons and not one? The pair at rest has zero momentum and an energy of 1.022 MeV; a single photon of that energy would carry momentum, and the books would not balance. Two photons of 511 keV each, flying in opposite directions, balance both energy and momentum. They are back to back, always. Their 511 keV is the electron's $mc^2$.

The same two facts, a threshold set by an invariant mass and a pair produced at rest, run through the rest of the chapter.

### The threshold figure

The general rule is Chapter 2's. A reaction can happen when the centre-of-mass energy $\sqrt s$ reaches the sum of the masses of everything in the final state. With a beam of kinetic energy $T$ hitting a particle at rest, $s = m_a^2 + m_b^2 + 2(m_a + T)m_b$, which grows only as the square root of $T$ when $T$ is large: most of the beam's energy goes into the motion of the debris. Two equal beams colliding head-on have $\sqrt s = 2E$ with nothing wasted. The figure computes both for four reactions.

::threshold-figure{n="9.4" caption="√s against the beam's kinetic energy on a stationary target (blue) and for two equal colliding beams (green), with the √s that the final state needs as a dashed line. The crossing is the threshold. Choose the reaction and move the slider across the threshold."}

## The antiproton

Dirac's argument applied to the proton too, and it was a long wait. An antiproton is 1836 times heavier than a positron, and making one takes more than that.

There is a rule that makes the cost exact. **Baryon number** (the number of quarks minus antiquarks, divided by three, Chapter 11) is conserved in every known reaction, and the proton has $B = +1$. The collision of two protons has $B = +2$. A final state with an antiproton in it (which has $B = -1$) must also contain *three* protons to have $B = 2$ again: the reaction is $p\,p \to p\,p\,p\,\bar p$. The final state has four particles of the proton's mass, so the threshold for $\sqrt s$ is $4m_p$.

With a proton beam on a fixed target, $s = 2m_p^2 + 2m_p E_{\text{beam}}$. Setting $s = (4m_p)^2 = 16\,m_p^2$ gives $E_{\text{beam}} = 7m_p$, and the *kinetic* energy, which is what an accelerator supplies on top of the mass, is $T = E_\text{beam} - m_p$, which can be written as

:::equation{#pbar-threshold caption="Threshold kinetic energy for p p → p p p p̄ on a stationary proton."}
$$\term{T}{T_\text{thr}} = \frac{\term{s}{(4m_p)^2} - (2m_p)^2}{2m_p} = \term{six}{6\,m_p}\approx 5.63\ \text{GeV}$$

```terms
T:
  label: 'T_thr, the threshold kinetic energy of the beam'
  what: The smallest kinetic energy of a proton that strikes a proton at rest and can produce the final state p p p p̄.
  why: Below it, √s is less than four proton masses and there is not enough energy in the centre-of-mass frame to make the final state at all.
  effect: Above it the reaction is possible, and the rate rises steeply with energy.
s:
  label: 's, the required invariant mass squared'
  what: The square of the total energy in the centre-of-mass frame, which must be at least the square of the sum of the final masses, four proton masses.
  why: The final state is at its cheapest when all four particles are at rest in that frame.
  effect: The fixed-target collision wastes most of the beam energy; to get 4 m_p of √s you need 6 m_p of kinetic energy.
six:
  label: '6 m_p, in numbers'
  what: Six proton masses, 6 × 0.938272 GeV.
  why: The algebra of the left-hand side reduces to it exactly.
  effect: 5.63 GeV. With two equal beams the same reaction needs only 0.938 GeV of kinetic energy in each, 1.88 GeV in all.
```
:::

The library computes it from four-vectors, `mandelstamS` and the particle table, and checks the algebra (the test in `src/lib/sims/part3/physics.test.ts`): the threshold is $6m_p$ = 5.6296 GeV, and with a beam at that energy $\sqrt s$ is exactly $4m_p$ = 3.7531 GeV.

The numbers explain the machine. Emilio Segrè, Owen Chamberlain and their colleagues at Berkeley used the **Bevatron**, a proton synchrotron that accelerated protons to 6.2 GeV, above the threshold, onto a copper target.:cite[chamberlain1955] The nucleons in a copper nucleus are moving, which lowers the beam energy that is needed. The hard part was not making antiprotons but finding them among the far more numerous pions. Chamberlain, Segrè, Wiegand and Ypsilantis selected negative particles of one momentum with magnets, and then told the antiprotons from the pions by their *speed*: at the same momentum a heavier particle is slower. At a momentum of 1.2 GeV/c, for example, an antiproton has $\beta = 0.79$ and a pion has $\beta = 0.993$. The experiment measured the time of flight over a known distance, and used Cherenkov counters (Chapter 6) whose response depends on speed.:cite[chamberlain1955]

```numeric
id: pbar-threshold
title: The antiproton threshold
prompt: A proton beam hits a stationary proton and makes the reaction p p → p p p p̄. What is the smallest beam *kinetic* energy, in GeV, at which it can happen? (Proton mass 0.938272 GeV.)
answer: 5.6296
unit: GeV
tolerance: 0.005
hints:
  - The final state has four particles of the proton's mass, so √s must be at least 4 m_p.
  - For a beam on a stationary target s = 2 m_p² + 2 m_p E, with E the total energy of the beam particle. Kinetic energy is E − m_p.
explain: "s = 16 m_p² gives E = 7 m_p, so T = E − m_p = 6 m_p = 5.63 GeV. The same reaction with two equal colliding beams needs √s = 4 m_p, so E = 2 m_p in each beam and T = m_p = 0.938 GeV each: 1.88 GeV in all, a third of the fixed-target figure."
```

:::history{year=1955 title="The Bevatron finds the antiproton" people="Owen Chamberlain, Emilio Segrè, Clyde Wiegand, Thomas Ypsilantis" source="Source: Chamberlain et al. (1955)."}
In late 1955 the Berkeley group published *Observation of antiprotons*. A beam of protons from the Bevatron struck a copper target, and the apparatus picked out negative particles of one momentum and measured their time of flight over a known distance, along with their Cherenkov light in two different counters. A negative particle with the proton's mass showed up against the much more numerous pions.:cite[chamberlain1955] Segrè and Chamberlain shared the 1959 Nobel Prize in Physics.

The threshold of 5.63 GeV on a free proton fixed what the machine had to be, and the Bevatron's 6.2 GeV was above it. A proton and an antiproton that meet annihilate into lighter particles, mostly pions.
:::

## Antihydrogen, and what it is for

Positrons and antiprotons can be stored separately, in electric and magnetic traps; put together they can form **antihydrogen**, an antiproton with a positron in orbit. The interest is to compare it with hydrogen. If CPT holds, the two have the same spectrum, and their spectral lines can be compared to a great precision; and gravity acts on both, or it does not.

The first antihydrogen atoms were made at CERN in 1995. They moved at nearly the speed of light, too fast to be studied; experiments at CERN's Antiproton Decelerator made *cold* antihydrogen in 2002 and trapped it in 2010.:cite[baur1996,amoretti2002,alpha2010] The details are on the card below.

The question of gravity is older than the answer: does antimatter fall up? In 2023 the ALPHA-g experiment released antihydrogen atoms from a vertical magnetic trap and counted where they annihilated, above the trap or below it. They fell downwards, and the measured acceleration was $0.75 \pm 0.13\,\text{(stat+syst)} \pm 0.16\,\text{(simulation)}$ times the ordinary $g$: consistent with $g$, with an uncertainty of about 0.2 $g$, and inconsistent with the repulsive antigravity that some proposals had considered.:cite[alphag2023]

:::history{year=1995 title="Antihydrogen, hot and cold" people="PS210 collaboration; ATHENA and ATRAP collaborations; ALPHA and ALPHA-g collaborations" source="Sources: Baur et al. (1996); Amoretti et al. (2002); Gabrielse et al. (2002); Andresen et al. (2010); ALPHA Collaboration (2023)."}
In 1995 at CERN's Low Energy Antiproton Ring, an experiment called PS210 made the first antihydrogen: antiprotons sent through a xenon gas jet, with a few making an $e^+e^-$ pair in the field of a xenon nucleus and capturing the positron. Eleven candidates were reported, and the paper allowed that a couple might be background. The atoms travelled at almost the speed of light.:cite[baur1996]

In 2002 the ATHENA experiment reported the production of cold antihydrogen at CERN's Antiproton Decelerator, and the ATRAP experiment soon after confirmed it.:cite[amoretti2002,gabrielse2002] The ALPHA experiment held atoms in a magnetic trap in 2010,:cite[alpha2010] and in 2023 its vertical sibling ALPHA-g reported the first measurement of the effect of gravity on antimatter: it falls down.:cite[alphag2023]
:::

:::experiments
**CERN's Antiproton Decelerator** (AD) and its smaller ring **ELENA** are the only places in the world where antiprotons are slowed to the energies that atomic physics needs. The antiprotons are made by a proton beam from the Proton Synchrotron striking a metal target, in the reaction of this chapter, and only a tiny fraction of the protons produce one. They come out with energies of GeV; the AD and ELENA slow them in stages, with beam cooling (Chapter 23), to a few MeV and then to 100 keV. The experiments that receive them (ALPHA, ATRAP, ASACUSA, AEgIS, GBAR, BASE) compare the properties of matter and antimatter: spectra, masses, magnetic moments and the gravitational acceleration. The course's `hep` library does not simulate the AD: it makes antiparticles by the sign flip above.
:::

## Positrons in medicine

There is a use of the positron in every major hospital. A **PET** scanner (positron emission tomography) makes an image of where a radioactive tracer has gone in the body. The tracer is a molecule with a radioactive nucleus that decays by emitting a positron. The usual one is fluorodeoxyglucose, a sugar with a fluorine-18 atom: cells that consume more sugar, as tumours and active brain regions do, collect more of it. Fluorine-18 has a half-life of about 110 minutes and decays to oxygen-18 by emitting a positron, in about 97 % of its decays.

The positron slows down in the body, within about a millimetre, and then annihilates with an electron. The annihilation is what the scanner sees: two photons of 511 keV, back to back. A ring of detectors around the patient records pairs of photons that arrive at two crystals within a few nanoseconds of each other. The decay lay somewhere on the line joining the two crystals, the **line of response**, without any need for a lens or a collimator. Many such lines, from many decays, give an image: the same inverse problem as locating a source from many bearings, done statistically (the reconstruction of Chapter 8 is a cousin). The toy below simulates a ring in two dimensions, makes the lines of response from a phantom with three hot regions, and reconstructs an image from them.

::pet-scanner{n="9.5" caption="A toy PET scanner in two dimensions: a water phantom with three hot regions of tracer, a ring of 180 crystals, the lines of response between the crystals that fired together, and an image reconstructed from them. Plain back-projection smears every line across the whole image; the ML-EM iterations that real scanners use sharpen it, and amplify the noise if the counts are few. A toy, not a scanner: no scatter, no random coincidences, no depth of interaction, no third dimension."}

The positron's travel before it annihilates limits the sharpness of the image, and the two photons are not exactly back to back, since the electron and positron still have a little momentum when they annihilate: the angle between the photons is 180° to within about half a degree, which adds a blur in proportion to the diameter of the ring. The sliders in the figure include both effects.

```fermi
id: pet-activity
title: Positrons in a PET scan
prompt: A PET scan uses an injection of fluorine-18 with an activity of 300 MBq (300 million decays per second at the start). Its half-life is 110 minutes, and 97 % of its decays emit a positron. Ignoring any loss of the tracer from the body, about how many positrons annihilate in the first hour?
answer: 8.7e11
factor: 3
hints:
  - The number of atoms is the activity divided by the decay constant, λ = ln 2 / half-life.
  - In one hour, a fraction 1 − 2^(−60/110) of the atoms decay.
explain: "λ = ln 2 / (110 × 60 s) = 1.05 × 10⁻⁴ s⁻¹, so the injection holds N = A/λ = 3 × 10⁸ / 1.05 × 10⁻⁴ ≈ 2.9 × 10¹² atoms. In an hour a fraction 1 − 2^(−60/110) = 0.31 of them decay: 9 × 10¹¹ decays, and 97 % of those give a positron: about 8.7 × 10¹¹ annihilations. Each releases 1.022 MeV, so the whole hour is about 0.15 J of annihilation energy, all of it in photons of 511 keV, most of which leave the body. The decays are plentiful. What limits the image is the small fraction of photon pairs that the ring catches, and the statistical noise that follows."
```

## What comes next

The antiproton and the positron are the tip of a symmetry: for every kind of matter there is a kind of antimatter. The next two chapters use that, and ask two questions that arise. Where do particles come from, in the sky, before there were accelerators? That is Chapter 10: cosmic rays, which made the positron, the muon and the pion available to physicists a generation before the machines could make them. And what rules decide which reactions among them can happen and which cannot? That is Chapter 11, in which the conservation laws are collected in one ledger, and in which baryon number, which forced three extra protons into the antiproton reaction, is one line.

[Chapter 10](/chapters/cosmic-rays-pions-muons/) follows the cosmic rays that Anderson was photographing and finds two more particles in them, the pion and the muon, which differ from each other in a way that surprised everyone.

## Further reading

- Anderson's paper, *The positive electron* (:cite[chambers-anderson1933]), is four pages long and readable.
- Dirac's 1931 paper (:cite[dirac1931]) is where the prediction is made, in the middle of a paper about magnetic monopoles.
- Chamberlain, Segrè, Wiegand and Ypsilantis (:cite[chamberlain1955]) describe the experiment of the antiproton.
- The ALPHA-g paper (:cite[alphag2023]) for the state of the art in the gravity of antimatter.
