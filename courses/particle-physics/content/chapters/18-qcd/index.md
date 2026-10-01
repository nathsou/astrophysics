---
number: 18
title: QCD
summary: Quantum chromodynamics is the gauge theory of colour. Its gluons carry colour themselves, so the coupling weakens at high energy (asymptotic freedom) and strengthens at low energy until quarks are confined. This chapter follows that through string breaking, parton showers, jets, the discovery of the gluon at PETRA and the quark–gluon plasma, and adds a jet-clustering algorithm to the course's pipeline.
duration: About 3½ hours
prerequisites: [symmetry-and-gauge]
---

Collide an electron and a positron at 91 GeV, the mass of the Z boson, and about 70 per cent of the time the result is a pair of quarks (Chapter 23).:cite[pdg2024] Chapter 16's R ratio counted such pairs. But no detector has ever recorded a quark. What comes out of the collision is two narrow sprays of hadrons, back to back, each carrying the direction and the energy of the quark that started it. Sometimes there are three sprays. This chapter explains why quarks are never seen alone, why the sprays look the way they do, and how the third spray in a three-jet event was the first sight of the gluon.

Quantum chromodynamics (QCD) is the theory that does it. Its structure is the one of Chapter 17, with matrices in place of a phase: the group is SU(3), the field is the quark's colour, and the gauge bosons are eight gluons. What is new is what happens because the gluons carry the charge they couple to.

## Colour and the gluons

Chapter 13 introduced colour as the answer to a puzzle: the Δ⁺⁺ contains three up quarks with parallel spins, which the exclusion principle forbids unless the quarks differ in a further label. Each quark comes in three colours, conventionally red, green and blue, and each antiquark in three anticolours. The labels are not colours of light. They are the three components of a vector on which the SU(3) matrices of Chapter 17 act.

The gauge bosons of SU(3) are the **gluons**. There are eight of them, one for each generator, and a gluon is not itself colourless: it carries a colour and an anticolour, so that when a quark emits one, the quark changes colour and the gluon carries the difference. A red quark can become a green quark by emitting a gluon that is red and anti-green. Counting the combinations gives nine (three colours times three anticolours), and one combination, the colour-symmetric singlet, is not a gluon: the eight that remain are the eight generators of SU(3).

The quark–gluon vertex is the same kind of line as the photon vertex of Chapter 15, with the strength $g_s = \sqrt{4\pi\alpha_s}$ in place of *e*, and a quark can radiate a gluon in the way an electron radiates a photon. The e⁺e⁻ → qq̄g process is the QCD analogue of e⁺e⁻ → μ⁺μ⁻γ.

::diagram-gallery{process="e+ e- > u u~ g" forces="qed,qcd" n="18.1" caption="The two tree diagrams of e⁺e⁻ → u ū g: a gluon radiated by the quark or by the antiquark. They are the QCD counterparts of the final-state diagrams of e⁺e⁻ → μ⁺μ⁻γ. Each has two powers of e and one of g_s in the amplitude. The probability of radiating a gluon is therefore of order α_s relative to that of making the pair, which is what the three-jet counting below measures."}

How strongly a quark radiates depends on the group, through a number called the **colour factor**. For a quark emitting a gluon it is $C_F = 4/3$. For a gluon emitting a gluon it is $C_A = 3$. The first is the value of $\sum_a T_aT_a$ for the generators in the three-dimensional representation, and the second is the value of $\sum_{cd} f_{acd}f_{bcd}$ for the structure constants of Chapter 17 (the course's tests compute both from the Gell-Mann matrices). Their ratio, $C_A/C_F = 9/4$, says that a gluon radiates 2.25 times more strongly than a quark: jets started by gluons are broader and have more particles than those started by quarks.

The gluon's self-coupling is the new feature. The non-abelian field strength of Chapter 17 contains terms with three and four gluon fields, so there are vertices with three gluons and four gluons. The photon has none.

::diagram-gallery{process="g g > g g" forces="qcd" n="18.2" caption="The four tree diagrams of gg → gg: the exchange of a gluon in the s-, t- and u-channels (each with two triple-gluon vertices) and the four-gluon contact vertex. At tree level photons cannot scatter off each other by exchanging photons, because they carry no charge. Gluons can, because they carry colour."}

Chapter 17 showed that gauge invariance forbids a mass term for the gauge bosons, so the gluons are massless, as the photon is. Yet the force between the hadrons we observe is short-ranged: it does not reach beyond a nucleus. The resolution is confinement, which comes from the gluon self-coupling: coloured objects are never found alone, and the force between colourless hadrons is only a remnant of the force between their constituents.

## A coupling that gets weaker at high energy

The coupling of a gauge theory runs, as α did in Chapter 16. In QED the running comes from fermion loops in the photon line, which screen the charge. In QCD there are quark loops in the gluon line, which screen colour in the same way, and there are gluon loops, which come from the gluon self-coupling and have the opposite effect: they *anti-screen*. The balance is set by a number β₀:

:::equation{#beta caption="The one-loop running of the strong coupling. The number of quark flavours that are lighter than the scale enters through n_f."}
$$\frac{d\,\term{as}{\alpha_s}}{d\ln\term{mu}{\mu^2}} = -\,\frac{\term{b0}{\beta_0}}{4\pi}\,\alpha_s^2,\qquad \beta_0 = 11 - \tfrac23\,n_f \qquad\Longrightarrow\qquad \alpha_s(Q^2) = \frac{4\pi}{\beta_0\,\ln(Q^2/\Lambda^2)}$$

```terms
as:
  label: 'α_s, the strong coupling'
  what: The analogue of the fine-structure constant for the strong force, α_s = g_s²/4π. It is a function of the energy scale.
  why: It is the number that multiplies each extra gluon emission in the series of Chapter 15.
  effect: It is about 0.118 at the Z mass, 0.18 at 10 GeV and 0.3 near 2 GeV. Below about 1 GeV it is too large for the series to be useful.
mu:
  label: 'μ, the renormalisation scale'
  what: The energy scale at which the coupling is evaluated, normally set to the momentum transfer of the process, Q.
  why: The loops depend on the logarithm of the ratio of the scale to the masses and momenta in the problem, which makes the coupling a function of scale.
  effect: 'At large μ the coupling is small: this is asymptotic freedom.'
b0:
  label: 'β₀, the one-loop coefficient'
  what: β₀ = 11 − 2n_f/3. The 11 comes from the gluon loops (it is (11/3)C_A with C_A = 3), and the −2n_f/3 from the quark loops. For QED the same calculation gives a coefficient of the opposite sign.
  why: Its sign decides whether the coupling grows or falls with scale. It is positive for n_f ≤ 16, so the coupling falls.
  effect: With n_f = 5 flavours, β₀ = 23/3 = 7.67. The coupling would grow with energy, as in QED, only if there were 17 or more flavours of quark.
```
:::

The sign is the physics. In QED the coupling grows with energy. In QCD, because 11 > 2*n*<sub>f</sub>/3 for any number of flavours that exist (there are six), it falls: the quarks and gluons interact more weakly the harder you hit them. This is **asymptotic freedom**, and it is the reason the quarks inside a proton, seen in the deep inelastic scattering of Chapter 13, behave nearly as free particles at high momentum transfer, and the reason perturbation theory, the diagram series of Chapter 15, works for jets at the LHC. The solution of the equation has a scale Λ, at which the one-loop coupling would become infinite, and it marks where the theory stops being perturbative. Its value depends on the number of flavours and on the loop order at which one works: a few hundred MeV in the conventional definition, so that ħ*c*/Λ is about a fermi, the size of a proton. (At one loop with five flavours and α<sub>s</sub>(*m*<sub>Z</sub>) = 0.118, the formula gives 88 MeV; with two loops and the usual conventions the number is larger. The scale is a convention; the running is physics.)

```predict
q: 'The strong coupling is 0.118 at the Z mass, 91 GeV. What do you expect it to be at 10 GeV, a tenth of the energy?'
options:
  - text: Smaller, about 0.06, because lower energy means weaker interactions.
    why: 'In QED the coupling falls towards low energy, but in QCD the gluon loops reverse the trend. The strong coupling is larger at low energy.'
  - text: 'About the same, 0.118: the coupling is a constant of nature.'
    why: 'A coupling constant is constant only at fixed scale. Quantum loops make it depend on the scale at which it is probed, and in QCD the dependence is strong: a factor of 1.5 between 91 and 10 GeV.'
  - text: Larger, about 0.18.
    correct: true
    why: 'Solving the running equation with five flavours gives 0.173 at one loop and 0.178 with two loops (the course’s hep/sm). It grows further at lower energy, to about 0.3 at 2 GeV. This is the same running that makes the quarks behave as free particles at high energy.'
```

```numeric
id: qcd-alphas-10
title: The strong coupling at 10 GeV at one loop
prompt: 'Using the one-loop solution α_s(Q²) = α_s(m_Z²) / [1 + (β₀/4π) α_s(m_Z²) ln(Q²/m_Z²)] with n_f = 5 (so β₀ = 23/3), α_s(m_Z) = 0.118 and m_Z = 91.19 GeV, find α_s at Q = 10 GeV.'
answer: 0.173
unit: ''
tolerance: 0.003
hints:
  - 'ln(Q²/m_Z²) = 2 ln(10/91.19) = −4.42.'
  - 'β₀/4π = 7.667/12.566 = 0.610.'
explain: 'The denominator is 1 + 0.610 × 0.118 × (−4.42) = 0.682, so α_s = 0.118/0.682 = 0.173. The two-loop value, which the course’s hep/sm also computes, is 0.178. Below the b-quark threshold the number of flavours drops to four and the coupling runs faster.'
```

```numeric
id: qcd-max-flavours
title: How many flavours would remove asymptotic freedom?
prompt: 'β₀ = 11 − 2n_f/3. For what number of flavours n_f does β₀ change sign? (Give the exact real value.)'
answer: 16.5
unit: ''
tolerance: 0.01
hints:
  - 'Set 11 − 2n_f/3 = 0.'
explain: 'n_f = 33/2 = 16.5. With 17 or more flavours of quark the quark loops would win over the gluon loops, the coupling would grow with energy and there would be no asymptotic freedom. The Standard Model has six.'
```

::running-couplings{which="alphas" n="18.3" caption="The strong coupling from hep/sm: αs(m_Z) = 0.118, run to other scales at one loop (dashed) and two loops (solid), with the number of active flavours changing at the charm and bottom masses. It falls slowly with Q, and the curve is frozen at 1 GeV, where the perturbative series stops being useful. Measurements of α_s over a range of scales from the tau lepton's mass to the highest LHC energies are collected by the Particle Data Group, and they lie on the curve.:cite[pdg2024]"}

:::history{year=1973 title="Asymptotic freedom" people="David Gross, Frank Wilczek, David Politzer" source="Sources: Gross and Wilczek (1973); Politzer (1973); Nobel Foundation (2004)."}
By the early 1970s the experiments at SLAC (Chapter 13) had shown that quarks inside a proton behave, at high momentum transfer, as if they hardly interacted. Yet the strong force binds them so tightly that none is ever seen alone. A theory with a coupling that is strong at long distance and weak at short distance was needed, and none of the field theories that had been worked out had that behaviour: QED, for one, has a coupling that grows with energy.

In 1973 David Gross and Frank Wilczek, at Princeton, and independently David Politzer, at Harvard, calculated the running of the coupling in non-abelian gauge theories and found that the coefficient has the opposite sign.:cite[p4-gross1973,p4-politzer1973] For the SU(3) theory of quarks and gluons, the coupling falls with energy as long as there are no more than 16 flavours of quark. The result made QCD, which had been proposed as the theory of the colour force, the natural theory of the strong interaction. Gross, Politzer and Wilczek shared the Nobel Prize in Physics in 2004 for it.:cite[p4-nobel2004]
:::

## Confinement and string breaking

At high energy the coupling is small. At low energy, large distance, it is large, and the picture is of a different kind. The gluons attract each other because they carry colour charge. Between a quark and an antiquark the field lines of the colour force are not free to spread out, as the electric field lines of a pair of opposite charges do: they are squeezed into a narrow tube of roughly constant cross-section, the **flux tube** or **string**. The energy stored in a tube is proportional to its length, with a constant of proportionality κ, the **string tension**, of about 1 GeV per fermi (in the conventional unit, about 0.2 GeV²). The potential energy of a quark–antiquark pair at separation *r* is, to a good approximation, the **Cornell potential**, introduced to describe the bound states of a charm quark and antiquark:

$$V(r) = -\frac43\,\frac{\alpha_s\,\hbar c}{r} + \kappa\,r .$$

The first term is Coulomb's law with the colour factor 4/3 of the previous section (:cite[p4-eichten1975]), the force between a quark and an antiquark when they are close. The second is the string: a constant force κ at every distance. Compare this with electricity. Two opposite electric charges attract with a force that falls as 1/*r*², and it costs a finite energy to separate them completely. The colour force between a quark and an antiquark does not fall off, and separating them to a distance *r* costs κ*r*: 10¹⁵ GeV, about 1.6 × 10⁵ joules, for a metre. The pair cannot be pulled apart. Long before that, the string breaks.

```fermi
id: qcd-string-metre
title: The energy of a metre of colour string
prompt: 'Suppose a quark and an antiquark could be held 1 metre apart, joined by a string with a tension of 1 GeV per fermi. About how much energy, in joules, would be stored in it? (1 m = 10¹⁵ fm; 1 GeV = 1.6 × 10⁻¹⁰ J.)'
answer: 1.6e5
unit: J
factor: 3
hints:
  - The energy is the tension times the length.
explain: 'κ × 1 m = 1 GeV/fm × 10¹⁵ fm = 10¹⁵ GeV = 1.6 × 10⁵ J, enough to lift a sixteen-tonne lorry by a metre. The situation never arises: a new quark–antiquark pair, with a rest energy of the order of a GeV, can be made as soon as the string holds that much energy, which happens within a fermi or so, so long before the string reaches a metre it has turned into hadrons.'
```

Why does the string break? A string with enough stored energy can turn some of it into a new quark–antiquark pair, as an electric field strong enough can create electron–positron pairs from the vacuum. Once the tube is longer than 2*m*/κ, where *m* is the mass of the quark that would be made, the energy in the stretched piece pays for the pair's rest mass. The new quark and antiquark appear in the middle, each attached to one of the two pieces, which are now two separate strings, each with a quark at one end and an antiquark at the other. Where there was one coloured pair there are now two. The process repeats until the pieces are too short to break, and each is a colour-neutral hadron: a meson.

::string-breaking{n="18.4" caption="Pulling a quark–antiquark pair apart (tab 1), the forces compared with electricity (tab 2), and the breaking of a whole string of energy √s into mesons, a jet (tab 3). This is a cartoon in one space dimension: a flux tube of constant energy per length κ ≈ 0.9 GeV/fm, quarks that feel a constant force, and a break probability that switches on once the stored energy can pay for a pair. Energy is conserved exactly and shown live. The quark masses are cartoon values, and the plateau in tab 3 is a toy result: the course's hadronisation module (hep/hadronise) is separate and more detailed."}

Three observations on the figure are worth making explicit. First, **energy is conserved**: the work you do pulling the string goes into stretching it, and when it breaks, the string energy that disappears equals the rest mass of the new pair. Second, **quarks are never found alone**. Every break creates pairs that keep the pieces colour-neutral: free colour never appears. Third, the **third tab** shows what a quark of high energy does: it is a string with one end moving fast, and it breaks many times, leaving a chain of mesons whose rapidities are spread flat from one end to the other, a **rapidity plateau** of length about ln(*s*/*m*²).

That the string picture is more than a cartoon is shown by calculations on a lattice. Chapter 17 ended with the lattice formulation of a gauge theory and its Wilson loops, and with the area law that signals a linearly rising potential. Wilson's 1974 formulation of QCD on a lattice shows the area law at strong coupling, and numerical lattice calculations then show it at the couplings of the real world. A mathematical *proof* that QCD confines, from the equations, does not exist: it is one of the Clay Mathematics Institute's Millennium Prize problems, in the form of the question whether Yang–Mills theory has a mass gap.

:::history{year=1974 title="Wilson's lattice" people="Kenneth Wilson" source="Sources: Wilson (1974); Creutz (1980)."}
In 1974 Kenneth Wilson, at Cornell, formulated gauge theory on a four-dimensional lattice of points in space and time, with the gauge field living on the links between neighbouring points, as in the last section of Chapter 17. In the limit of strong coupling it is simple enough to solve, and the result is that the average of a Wilson loop falls exponentially with its area: the area law, which means that the energy of a static quark–antiquark pair rises linearly with their separation. Wilson argued that this is quark confinement.:cite[p4-wilson1974]

The lattice formulation was also something one could simulate: it replaces the infinite number of degrees of freedom of a field by a finite, if large, number, and the path-integral weight is positive, so that it can be sampled by Monte Carlo. An early Monte Carlo calculation of the string tension in SU(2) gauge theory was made by Michael Creutz in 1980.:cite[p4-creutz1980] Since then lattice QCD has become the way the strong interaction is computed where perturbation theory fails: the masses of the proton and the neutron and the strong coupling are calculated from the Lagrangian, on supercomputers.
:::

## Hadronisation

The process by which the coloured partons of a hard collision turn into the colourless hadrons that a detector sees is called **hadronisation**, or fragmentation. It cannot be computed from the equations of QCD with perturbation theory, because the coupling at the relevant scales, about 1 GeV, is too large. It is described by models, tuned to data. The one in the figure is the **Lund string model**,:cite[p4-andersson1983] which the course's `hep/hadronise` implements as a toy: every string breaks into hadrons in its own rest frame, one break at a time. The new quarks are given a small transverse momentum drawn from a Gaussian, the lighter quarks are made more often than the heavier (u : d : s in the ratio about 1 : 1 : 0.3 in the toy), and the fraction *z* of the string's remaining momentum that a hadron takes follows the Lund fragmentation function

$$f(z) \propto \frac{1}{z}\,(1-z)^a\,\exp\!\left(-\frac{b\,m_\perp^2}{z}\right).$$

The parameters *a* and *b* are fitted to data (the toy uses typical values; they are marked in the module's README as quoted from memory, approximate). Heavy quarks keep more of their energy in their leading hadron, which the generator models with the Peterson function.

The alternative picture, used by the Herwig generator, first has gluons split into quark–antiquark pairs so that the colour lines connect nearby partons into small colour-neutral **clusters** with a mass of a few GeV, which then decay into hadrons. Both models describe the data, and the difference between them is one of the systematic uncertainties of the experiments.

The hadronisation of the toy is not perfect: at 91 GeV it gives about 16 charged particles per event, where LEP measured about 21.:cite[pdg2024] The toy has fewer particles because its table of hadrons is reduced and its parameters are not tuned. It conserves energy, momentum, charge and flavour exactly, which the tests check on thousands of strings.

## Jets

Whatever the details of hadronisation, its effect on the *energy flow* is gentle. The hadrons from a quark of high energy travel in a narrow cone around its direction, with transverse momentum relative to it of a fraction of a GeV, and their total momentum is the quark's. The experiments measure the sprays and call them **jets**. A jet is a definition, not a particle: an algorithm that groups the particles of an event into sets whose summed four-momentum approximates that of the original parton.

There are many algorithms. What the experiments need from one is that its answer should not change when the event changes in ways that do not matter:

- **Infrared safety**: adding a very soft particle must not change the jets. (Gluons radiated with very low energy are numerous and cannot be counted.)
- **Collinear safety**: splitting a particle into two collinear halves must not change the jets. (A quark that splits into a quark and a collinear gluon is the same quark, as far as an experiment can see.)

If a jet algorithm fails either property, its predictions cannot be computed in perturbation theory, because the infinite terms in the loops and the real emissions no longer cancel. Sterman and Weinberg's 1977 definition of a jet by a cone and an energy fraction was the first to be built with this in mind.:cite[p4-sterman1977]

The standard algorithm of the LHC experiments is **anti-k<sub>T</sub>**.:cite[p4-cacciari2008] It is a **sequential recombination** algorithm: it repeatedly merges the two closest objects, with a particular definition of closeness. Given a list of particles with transverse momentum *p*<sub>T</sub>, rapidity *y* and azimuth φ (Chapter 2), it defines a distance between every pair and a distance of each particle from the beam:

:::equation{#antikt caption="The anti-kT distances. The algorithm repeatedly finds the smallest distance in the list and merges the pair, or declares the particle a jet if the beam distance is the smallest."}
$$\term{dij}{d_{ij}} = \min\!\left(\frac{1}{p_{T,i}^{2}},\frac{1}{p_{T,j}^{2}}\right)\frac{\term{dR}{\Delta R_{ij}^2}}{\term{R}{R^2}},\qquad d_{iB} = \frac{1}{p_{T,i}^{2}},\qquad \Delta R_{ij}^2 = (y_i - y_j)^2 + (\phi_i - \phi_j)^2$$

```terms
dij:
  label: 'd_ij, the distance between two particles'
  what: A number that is small when the two particles are close in rapidity and azimuth and at least one of them has large transverse momentum.
  why: 'The factor 1/pT² makes the hardest particle the centre of attraction: the smallest d_ij involves the hardest particle and its nearest neighbour.'
  effect: A soft particle near a hard one is absorbed by it, long before two soft particles near each other merge.
dR:
  label: 'ΔR, the angular distance'
  what: The distance in the (y, φ) plane, the same as ΔR of Chapter 2 with the rapidity in place of the pseudorapidity.
  why: Differences of rapidity and azimuth do not change under boosts along the beam, so the clustering gives the same jets whatever the boost of the collision.
  effect: Particles farther apart than R are never merged directly with each other (they may still be merged through a third).
R:
  label: 'R, the jet radius'
  what: The parameter of the algorithm. A hard particle collects all the soft particles within R of it, so the jet is a cone of radius R in the (y, φ) plane.
  why: It decides how large an angle counts as one jet. Small R separates nearby jets; large R gathers more of the radiation.
  effect: The LHC experiments use R = 0.4 for most analyses and larger values for jets from boosted heavy particles.
```
:::

Read the algorithm in four lines. (1) Compute all *d*<sub>ij</sub> and *d*<sub>iB</sub>. (2) Find the smallest. (3) If it is a *d*<sub>ij</sub>, replace the two particles by their four-momentum sum (the "E-scheme"). (4) If it is a *d*<sub>iB</sub>, call the particle a jet and remove it. Repeat until nothing is left. Because the distances weight by the *inverse* of the transverse momentum (the generalised family has $p_T^{2p}$ with exponent *p*, and *p* = −1 is anti-k<sub>T</sub>; *p* = 1 is the k<sub>T</sub> algorithm that clusters soft particles first and *p* = 0 is Cambridge–Aachen), the hardest particle in a region is the seed. Each soft particle within *R* of it is merged into it, one after the other, so the jet is a round cone of radius *R*. Soft particles cannot change the jet's shape, because they have no influence on the order of merging, and the algorithm is infrared and collinear safe. That regularity, a circle of fixed size, is why the experiments prefer it: corrections for the detector and for the uncertainty of the energy scale are easiest to determine for jets with a simple shape.

### Two jets, three jets

The figure below uses the course's generator: Z → qq̄ events at 91.2 GeV (or other energies), with the matrix element, the parton shower of the next section, the toy Lund hadronisation and the decays of unstable hadrons. The particles that a detector would see (everything but the neutrinos) are clustered with anti-k<sub>T</sub>. Each event has been rotated so that its plane lies in the transverse plane, which changes nothing physically in an e⁺e⁻ event and shows the event as a hadron-collider detector would see a pair of jets at rapidity zero.

::shower-jets{n="18.5" caption="Simulated e⁺e⁻ → qq̄ events, clustered with anti-kT (hep/reco; your own version of reco.antiKt is used instead if you have installed it). Switch the parton shower off and every event has two jets, back to back, however you choose R. Switch it on and a fraction of the events, depending on R and the pT threshold, has three: a gluon radiated at a wide angle. The three particles of such an event lie in a plane, because their momenta add to zero. The two buttons at the bottom test infrared and collinear safety: a soft particle or a collinear split changes none of the jets."}

In the course's own sample of 160 events at 91.2 GeV with a threshold of 5 GeV, about 32 % of the events have three or more jets for R = 0.4, 18 % for R = 0.7 and 6 % for R = 1.2 (with a statistical uncertainty of a few per cent each). At 30 GeV and R = 0.7 the fractions with a threshold of 5, 3 and 2 GeV are about 2.5, 12 and 24 %.

Things to try:

1. With the shower **off**, step through ten events. All have two jets: a quark pair becomes two strings, which become two sprays. Any third jet in the shower-on events comes from hard gluon radiation.
2. With the shower **on**, press **Next three-jet**. Look at the jet table: the two hardest jets are the quark and antiquark, usually, and the third, softer, is the gluon. The three jets are coplanar.
3. Increase *R* from 0.4 to 1.2. Nearby jets merge, and the fraction of three-jet events falls: whether an event has three jets depends on the *definition*, which is why measurements specify *R*.
4. Raise the threshold on the jet's p<sub>T</sub>. A fainter gluon jet drops below it and the event becomes a two-jet event.
5. Press **Add a soft particle** and **Split the hardest particle** repeatedly. The number of jets and their transverse momenta do not change (a soft particle may shift a jet by a few tens of MeV, and a collinear split changes nothing).
6. Choose 30 GeV, the energy of PETRA, below. With the default threshold of 5 GeV almost no event has three jets, because the gluon jet has a transverse momentum of a few GeV. Lower the threshold to 2 GeV and they appear: the three-jet fraction depends on both R and the threshold, as well as on α_s.

### You write: jet clustering

```code
id: qcd-antikt
title: Anti-kT jet clustering
hook: reco.antiKt
prompt: |
  Implement `antiKt(particles, R, ptMin = 0)`, the anti-k<sub>T</sub> algorithm. `particles` is a list of four-vectors `{ E, px, py, pz }`. Use the distances of the equation above with transverse momentum *p*<sub>T</sub> = √(p<sub>x</sub>² + p<sub>y</sub>²), rapidity *y* = ½ ln((E + p<sub>z</sub>)/(E − p<sub>z</sub>)) and azimuth φ = atan2(p<sub>y</sub>, p<sub>x</sub>), with Δφ wrapped into [0, π]. At each step find the smallest of all d<sub>ij</sub> and d<sub>iB</sub>; merge the pair by adding four-vectors (E-scheme), or make the particle a jet.

  Return `{ jets, constituents }`: the jets with p<sub>T</sub> above `ptMin`, sorted by decreasing p<sub>T</sub>, as four-vectors, and for each jet the list of indices (into `particles`) of the particles it contains. A particle with p<sub>T</sub> = 0 (along the beam) cannot be clustered and is ignored.

  A direct implementation, rescanning all pairs at each step, takes O(N³) operations, which is fine for the sizes here. The course's reference version keeps each particle's nearest neighbour in a cache (O(N²)). Once your function passes, *use my code* makes the jets in the figure above, and in the whole pipeline, come from it.
starter: |
  import type { P4 } from 'hep';

  export interface JetResult {
    jets: P4[];
    constituents: number[][];
  }

  /** Anti-kT jets with radius R; jets with pT > ptMin, sorted by decreasing pT. */
  export function antiKt(particles: P4[], R: number, ptMin = 0): JetResult {
    // 1. keep the particles with pT > 0: items = { p: four-vector, members: [index] }
    // 2. repeat while items remain:
    //      d_iB = 1/pT_i²,  d_ij = min(1/pT_i², 1/pT_j²) · (Δy² + Δφ²) / R²
    //      the smallest d_iB: item i is a jet; the smallest d_ij: merge j into i (add four-vectors, join the members)
    // 3. keep jets with pT > ptMin and sort by decreasing pT
    return { jets: [], constituents: [] };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { antiKt } from 'solution';
  import { antiKt as reference } from 'hep/reco';
  import { rng } from 'hep/random';
  import { fromPtEtaPhiM, sum, pt as ptOf, mass } from 'hep/kinematics';
  import { hooks } from 'hep';
  import * as reco from 'hep/reco';
  import type { P4 } from 'hep';

  const rapidity = (p: P4) => 0.5 * Math.log((p.E + p.pz) / (p.E - p.pz));
  const dR = (a: P4, b: P4) => {
    let dphi = Math.abs(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px));
    dphi = Math.min(dphi, 2 * Math.PI - dphi);
    return Math.hypot(rapidity(a) - rapidity(b), dphi);
  };
  const massless = (pt: number, eta: number, phi: number) => fromPtEtaPhiM(pt, eta, phi, 0);

  // an event with n hard jets of ~12 particles each, plus soft background
  function event(seed: number, nJets = 3): P4[] {
    const r = rng(seed);
    const out: P4[] = [];
    for (let j = 0; j < nJets; j++) {
      const eta0 = (r() - 0.5) * 3;
      const phi0 = -Math.PI + ((j + r() * 0.5) * 2 * Math.PI) / nJets;
      const ptJet = 30 + 100 * r();
      for (let k = 0; k < 12; k++) {
        const z = Math.pow(r(), 1.5);
        out.push(massless(Math.max(0.3, ptJet * z * 0.3), eta0 + 0.12 * (r() - 0.5) * 2, phi0 + 0.12 * (r() - 0.5) * 2));
      }
    }
    for (let k = 0; k < 15; k++) out.push(massless(0.3 + r(), (r() - 0.5) * 6, -Math.PI + 2 * Math.PI * r()));
    return out;
  }

  const key = (p: P4) => [p.E, p.px, p.py, p.pz];

  test('one particle is one jet', () => {
    const p = massless(25, 0.4, 1.0);
    const res = antiKt([p], 0.4);
    expect(res.jets.length).toBe(1);
    expect(res.constituents).toEqual([[0]]);
    expect(res.jets[0]!.E).toBeCloseTo(p.E, 10);
  });

  test('two particles merge when closer than R and stay apart when farther', () => {
    const a = massless(50, 0, 0), near = massless(20, 0.1, 0.25), far = massless(20, 0, 1.2);
    expect(dR(a, near)).toBeLessThan(0.4);
    const merged = antiKt([a, near], 0.4);
    expect(merged.jets.length).toBe(1);
    const s = sum([a, near]);
    expect(merged.jets[0]!.px).toBeCloseTo(s.px, 10);
    expect(merged.jets[0]!.E).toBeCloseTo(s.E, 10);
    expect([...merged.constituents[0]!].sort()).toEqual([0, 1]);
    const apart = antiKt([a, far], 0.4);
    expect(apart.jets.length).toBe(2);
    expect(ptOf(apart.jets[0]!)).toBeGreaterThanOrEqual(ptOf(apart.jets[1]!));
  });

  test('the azimuth wraps around ±π', () => {
    const a = massless(40, 0, 3.05), b = massless(30, 0, -3.10);
    expect(antiKt([a, b], 0.4).jets.length).toBe(1);
  });

  test('a hard particle gathers everything within R, and the jet is a circle: soft particles beyond R stay out', () => {
    const hard = massless(100, 0, 0);
    const inside = [massless(1, 0.3, 0.1), massless(1, -0.2, -0.3), massless(0.5, 0.0, 0.35)];
    const outside = massless(1, 0, 0.8);
    const res = antiKt([hard, ...inside, outside], 0.4);
    expect(res.jets.length).toBe(2);
    expect([...res.constituents[0]!].sort()).toEqual([0, 1, 2, 3]);
    expect(res.constituents[1]).toEqual([4]);
  });

  test('agrees with the reference on random events, jet by jet', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const ev = event(seed, 2 + (seed % 3));
      for (const R of [0.4, 0.8]) {
        const mine = antiKt(ev, R, 5);
        const ref = reference(ev, R, 5);
        expect(mine.jets.length).toBe(ref.jets.length);
        mine.jets.forEach((j, i) => {
          key(j).forEach((v, k) => expect(v).toBeCloseTo(key(ref.jets[i]!)[k]!, 8));
          expect([...mine.constituents[i]!].sort((x, y) => x - y)).toEqual([...ref.constituents[i]!].sort((x, y) => x - y));
        });
      }
    }
  });

  test('four-momentum is conserved: with ptMin = 0 the jets add up to the input', () => {
    const ev = event(7);
    const res = antiKt(ev, 0.6, 0);
    const a = sum(res.jets), b = sum(ev);
    expect(a.E).toBeCloseTo(b.E, 8);
    expect(a.px).toBeCloseTo(b.px, 8);
    expect(a.pz).toBeCloseTo(b.pz, 8);
    const all = res.constituents.flat().sort((x, y) => x - y);
    expect(all).toEqual(ev.map((_, i) => i));
  });

  test('infrared safety: a very soft extra particle changes no hard jet', () => {
    const r = rng(3);
    for (let seed = 1; seed <= 8; seed++) {
      const ev = event(seed);
      const before = antiKt(ev, 0.4, 10);
      const ghost = massless(1e-3, (r() - 0.5) * 6, -Math.PI + 2 * Math.PI * r());
      const after = antiKt([...ev, ghost], 0.4, 10);
      expect(after.jets.length).toBe(before.jets.length);
      before.jets.forEach((j, i) => expect(Math.abs(ptOf(after.jets[i]!) - ptOf(j))).toBeLessThan(0.01));
    }
  });

  test('collinear safety: splitting a particle in two collinear halves changes no jet', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const ev = event(seed);
      const before = antiKt(ev, 0.4, 10);
      const i = 3;
      const p = ev[i]!;
      const half = (f: number): P4 => ({ E: p.E * f, px: p.px * f, py: p.py * f, pz: p.pz * f });
      const split = [...ev.slice(0, i), ...ev.slice(i + 1), half(0.3), half(0.7)];
      const after = antiKt(split, 0.4, 10);
      expect(after.jets.length).toBe(before.jets.length);
      before.jets.forEach((j, k) => key(j).forEach((v, c) => expect(v).toBeCloseTo(key(after.jets[k]!)[c]!, 8)));
    }
  });

  test('ptMin removes the soft jets and the result is sorted by pT', () => {
    const ev = event(5, 4);
    const all = antiKt(ev, 0.4, 0);
    const cut = antiKt(ev, 0.4, 20);
    expect(cut.jets.length).toBeLessThanOrEqual(all.jets.length);
    for (const j of cut.jets) expect(ptOf(j)).toBeGreaterThan(20);
    for (let k = 1; k < all.jets.length; k++) expect(ptOf(all.jets[k - 1]!)).toBeGreaterThanOrEqual(ptOf(all.jets[k]!));
  });

  test('installed as the hook, it drives the pipeline: clusterJets gives the same jets as the reference', () => {
    const ev = event(2);
    hooks.setOverride('reco.antiKt', antiKt);
    try {
      const viaHook = reco.clusterJets(ev, 0.4, 10);
      const ref = reference(ev, 0.4, 10);
      expect(viaHook.jets.length).toBe(ref.jets.length);
      viaHook.jets.forEach((j, i) => expect(ptOf(j)).toBeCloseTo(ptOf(ref.jets[i]!), 8));
      expect(mass(viaHook.jets[0]!)).toBeGreaterThanOrEqual(0);
    } finally {
      hooks.setOverride('reco.antiKt', undefined);
    }
  });
solution: |
  import type { P4 } from 'hep';

  export interface JetResult {
    jets: P4[];
    constituents: number[][];
  }

  interface Item {
    p: P4;
    members: number[];
  }

  const pt2 = (p: P4) => p.px * p.px + p.py * p.py;
  function rapidity(p: P4): number {
    const a = p.E + p.pz;
    const b = p.E - p.pz;
    if (a <= 0 || b <= 0) return p.pz >= 0 ? 1e6 : -1e6;
    return 0.5 * Math.log(a / b);
  }

  export function antiKt(particles: P4[], R: number, ptMin = 0): JetResult {
    const items: Item[] = [];
    particles.forEach((p, i) => {
      if (pt2(p) > 1e-24) items.push({ p: { E: p.E, px: p.px, py: p.py, pz: p.pz }, members: [i] });
    });
    const done: Item[] = [];
    while (items.length > 0) {
      let best = Infinity;
      let bi = -1;
      let bj = -1; // −1: the beam
      for (let i = 0; i < items.length; i++) {
        const ki = 1 / pt2(items[i]!.p);
        if (ki < best) {
          best = ki;
          bi = i;
          bj = -1;
        }
        const yi = rapidity(items[i]!.p);
        const phii = Math.atan2(items[i]!.p.py, items[i]!.p.px);
        for (let j = i + 1; j < items.length; j++) {
          const kj = 1 / pt2(items[j]!.p);
          const dy = yi - rapidity(items[j]!.p);
          let dphi = Math.abs(phii - Math.atan2(items[j]!.p.py, items[j]!.p.px));
          dphi = Math.min(dphi, 2 * Math.PI - dphi);
          const d = (Math.min(ki, kj) * (dy * dy + dphi * dphi)) / (R * R);
          if (d < best) {
            best = d;
            bi = i;
            bj = j;
          }
        }
      }
      if (bj < 0) {
        done.push(items[bi]!);
        items.splice(bi, 1);
      } else {
        const a = items[bi]!;
        const b = items[bj]!;
        a.p = { E: a.p.E + b.p.E, px: a.p.px + b.p.px, py: a.p.py + b.p.py, pz: a.p.pz + b.p.pz };
        a.members = a.members.concat(b.members);
        items.splice(bj, 1);
      }
    }
    const kept = done.filter((j) => Math.sqrt(pt2(j.p)) > ptMin).sort((x, y) => pt2(y.p) - pt2(x.p));
    return { jets: kept.map((j) => j.p), constituents: kept.map((j) => j.members) };
  }
hints:
  - 'Keep a list of items, each with its four-vector and the indices it contains. In every pass compute d_iB = 1/pT² for each item and d_ij for each pair, remember the smallest, and act on it. A merge reduces the list by one, a jet removes one: the loop ends after at most N passes.'
  - 'The easy mistakes: using pT instead of 1/pT² (that is the kT algorithm, p = 1), forgetting to wrap Δφ (a particle at φ = 3.1 and one at φ = −3.1 are close), merging the *momenta* with a weighted average instead of adding four-vectors, and forgetting that the beam distance competes with the pair distances at every step.'
  - 'IRC safety is a property of the algorithm, not an extra step: if the distances are right, the soft ghost and the collinear split tests pass.'
```

:::programmer
Sequential recombination is **agglomerative hierarchical clustering** with a custom linkage: start with every particle as its own cluster, repeatedly merge the closest pair, stop when a termination condition (the beam distance) says so. The k<sub>T</sub> family differs from textbook hierarchical clustering in two ways. The "distance" mixes geometry and a weight (transverse momentum), and the stopping rule is built into the same distance, which means there is no dendrogram to cut afterwards. The choice of the exponent is a choice of which merge happens first, and the infrared safety is a statement about robustness to *noise*: adding a point with negligible weight must not change the answer. It is a property that a good clustering algorithm for noisy data has anyway.
:::

:::hood[Anti-kT in O(N²), and in O(N log N)]
Rescanning all pairs at every step is O(N²) per step and O(N³) overall, which is too slow for a heavy-ion event with thousands of particles. The course's reference in `hep/reco/jets.ts` is O(N²) overall. Its trick is that the smallest distance involving particle *i* is a property of *i* and its nearest neighbour, and most neighbours do not change when two others merge. Each particle caches its nearest neighbour and the distance to it, and a merge triggers a rescan only for the particles whose neighbour was one of the two merged:

```ts
for (let q = 0; q < nLive; q++) {
  const c = live[q]!;
  if (c === bi) continue;
  // Every other particle's distances are unchanged except those to the merged pseudojet. So if the merged pseudojet is
  // at least as close as the old nearest neighbour was, it is the new nearest neighbour; only otherwise is a rescan needed.
  const d = dist(bi, c);
  if (d <= dnn[c]! || (nn[c] !== bi && nn[c] !== j && d < dnn[c]!)) {
    dnn[c] = d;
    nn[c] = bi;
  } else if (nn[c] === bi || nn[c] === j) recomputeNN(c);
}
```

Finding the global minimum costs O(N) per step, so the whole clustering is O(N²). FastJet, the standard program, goes further. Because the anti-k<sub>T</sub> distance is a geometric distance times a weight, the search can be restricted to geometric nearest neighbours in the (y, φ) plane; a computational-geometry structure (a Delaunay triangulation, which gives the nearest neighbours of points on a plane) maintains them in O(log N) per update, for O(N ln N) in all.:cite[p4-cacciari2006] The `p = 0, ±1` algorithms of the course's `sequentialJets` share the cache.
:::

## Where the third jet comes from: the parton shower

A quark made in a hard collision does not stay a quark. It radiates gluons, which radiate gluons or split into quark–antiquark pairs, and so on, in a cascade that goes down from the energy of the hard process to about a GeV, where hadronisation takes over. The tree-level process e⁺e⁻ → qq̄g of Figure 18.1 is the first step; the **parton shower** is the series of all further ones, in the soft and collinear approximation, where they are most probable.

The probability that a quark radiates a gluon with fraction 1 − *z* of its energy, at transverse momentum *p*<sub>T</sub> relative to its direction, in an interval d ln *p*<sub>T</sub>², is

$$d\mathcal P = \frac{\alpha_s(p_T^2)}{2\pi}\,P_{qq}(z)\,dz\,\frac{dp_T^2}{p_T^2},\qquad P_{qq}(z) = C_F\,\frac{1+z^2}{1-z},$$

and for a gluon splitting there are two more splitting functions, with the colour factor $C_A$ for g → gg and $T_R = 1/2$ for g → qq̄ (the library's `splitting` object). The logarithmic factor d*p*<sub>T</sub>²/*p*<sub>T</sub>² and the pole at *z* → 1 are the soft and collinear enhancements: most of the radiation is a gluon of low energy near the quark's direction. The probability of *no* emission above a scale is the **Sudakov form factor**,

$$\Delta(t) = \exp\!\left(-\int_t^{t_{\max}} \frac{dt'}{t'}\,\frac{\alpha_s(t')}{2\pi}\int P(z)\,dz\right),\qquad t = p_T^2 ,$$

which is the same structure as the survival probability e<sup>−λ*t*</sup> of a radioactive nucleus (Chapter 3), with the "decay rate" being the emission rate. The Sudakov factor is named after Vladimir Sudakov's 1956 study of electron vertices at high energy.:cite[p4-sudakov1956] The shower generates the sequence of emissions by choosing, from a uniform random number, the scale at which the next one occurs: it is the inverse of Δ, and since the emission rate depends on the coupling and on *z* in a way that cannot be inverted in closed form, the program uses a trick, the **veto algorithm**, described below. Three-jet events are the events in which the first emission is hard and wide-angle, so that its jet survives the clustering. In perturbation theory their fraction is proportional to α<sub>s</sub>, which is why counting them measures it.

### The veto algorithm

The emission rate is a function you can evaluate at any scale but not integrate and invert. The **Sudakov veto algorithm** replaces it by a larger function that you *can* invert, and corrects the difference by rejection. Suppose the true rate per unit ln *t* is *f*(*t*) and you know a constant *g* ≥ *f*(*t*) everywhere. Trial scales from the overestimate are easy: the waiting time in ln *t* between trials is exponential with rate *g*. At each trial, accept it as an emission with probability *f*(*t*)/*g*; otherwise **veto** it and continue downward from that scale.

The result is exactly the true first-emission distribution *f*(*t*)Δ(*t*), by the thinning property of Poisson processes. The trials form a Poisson process of rate *g* in ln *t*. Keeping each independently with probability *f*/*g* leaves a Poisson process of rate *f*, and the first point of that process, the first accepted trial, has the distribution *f*(*t*) exp(−∫*f* d ln *t*′) = *f*(*t*)Δ(*t*): the chance that nothing was accepted above *t*, times the density of an acceptance at *t*.

:::hood[The veto loop in the library]
The core of `nextEmission` in `hep/shower/fsr.ts` (lightly abridged), for the case of a fixed coupling and for the running one:

```ts
let t = tmax;
for (let trial = 0; trial < 100000; trial++) {
  const u = rng();
  if (fixed !== undefined) t *= Math.pow(u, (2 * Math.PI) / (R * fixed));  // next trial scale from the overestimate
  else t = LAMBDA2 * Math.exp(Math.log(t / LAMBDA2) * Math.pow(u, (2 * Math.PI * B0_NF5) / (R * K)));
  if (!(t > tmin)) return null;                    // nothing emitted above the cutoff
  if (fixed === undefined && rng() * K * alphaSOver(t) > alphaSShower(t)) continue;  // veto on the coupling
  // ... then z is drawn, and the vetoes on the splitting function, the z range and angular ordering follow
}
```

Each `continue` is a veto: the trial scale is discarded and the next one is generated from it. The overestimate is the analytic one-loop coupling times a constant factor K, so the trial scales are generated by inverting its integral in closed form (the `Math.pow(u, …)` lines), and the real coupling, the splitting function, the allowed range of *z* and the angular-ordering condition are all applied as accept–reject steps afterwards. The test suite checks the first-emission distribution against the analytic Sudakov formula with a χ² test, for quarks and gluons, with fixed and running coupling.
:::

::sudakov-veto{n="18.6" caption="The veto algorithm on a 45.6 GeV quark with a fixed coupling, so that every trial can be drawn. Left: one evolution. Each trial gets a random height up to the flat overestimate; below the true rate it is an emission (green), above it it is vetoed (red cross), and the search continues. Right: 6,000 evolutions give a distribution of first-emission scales that agrees with the analytic Sudakov formula (line). The fraction with no emission above 1 GeV agrees with the formula's value, written under the plot."}

The parton shower of the course (`hep/shower`) is a toy, and says so: transverse-momentum ordered, with the one-loop coupling, the angular-ordering veto for colour coherence, massless kinematics in the cascade, and a global rescaling to conserve four-momentum exactly. It is the structure of the generators the experiments use (Pythia and Herwig), simplified.

:::history{year=1979 title="Three-jet events at PETRA" people="TASSO, MARK-J, PLUTO and JADE collaborations" source="Sources: Ellis, Gaillard and Ross (1976); Brandelik et al. (1979); Barber et al. (1979); Berger et al. (1979); Bartel et al. (1980)."}
In 1976 John Ellis, Mary Gaillard and Graham Ross pointed out that if quarks interact through gluons, then a quark and an antiquark made in e⁺e⁻ annihilation should sometimes radiate a hard gluon, giving three jets instead of two. The experiment that could test it needed a collision energy high enough for the three jets to be separate and to look different from two.:cite[p4-ellis1976]

PETRA, an electron–positron ring of 2.3 km circumference at DESY (Deutsches Elektronen-Synchrotron), the German particle-physics laboratory in Hamburg, was built for this. It began operating in 1978 and reached centre-of-mass energies of about 30 GeV in 1979. Four experiments, TASSO, MARK-J, PLUTO and JADE, studied the hadronic events, and in 1979 three of them published evidence of events with a planar three-jet structure: TASSO observed "planar events", MARK-J reported "the discovery of three-jet events and a test of quantum chromodynamics", and PLUTO "evidence for gluon bremsstrahlung" in e⁺e⁻ annihilations.:cite[p4-tasso1979,p4-markj1979,p4-pluto1979] JADE added a more detailed study, published in 1980.:cite[p4-jade1980]

What was observed is a topology, not a track: an event shape in which the energy was not along one axis but spread in a plane in three clusters, with a rate and a shape consistent with the radiation of a gluon from a quark. The gluon itself, like the quarks, was never seen as a particle. It was seen as a jet, and it is, in that sense, the first evidence of the particle that carries the strong force.
:::

## Measuring α_s

The rate of three-jet events is proportional to α<sub>s</sub>, and so is each other effect of gluon radiation: the correction 1 + α<sub>s</sub>/π to the R ratio of Chapter 16, the hadronic width of the Z and of the tau lepton (Chapter 23), the evolution of the parton distributions of Chapter 13 with the scale, and the heights of the jet cross-sections at the LHC. The Particle Data Group's world average, from a combination of these and others, is α<sub>s</sub>(*m*<sub>Z</sub>) = 0.118 with an uncertainty below 1 %,:cite[pdg2024] and the measurements of the running between the tau mass and the TeV scale lie on the curve of Figure 18.3. The strong coupling is the least precisely known of the couplings of the Standard Model, by a large factor, and it limits the precision of many predictions, notably those of the Higgs boson's production rate (Chapter 30).

## Heavy-ion collisions and the quark–gluon plasma

Asymptotic freedom has a second, surprising consequence. At very high temperature, the particles in a gas collide with energy so large that the coupling between them is small, and the quarks and gluons should be free of confinement: not bound into hadrons, but a plasma of quarks and gluons, the **quark–gluon plasma**. Lattice QCD calculations (Chapter 17's method applied to the real theory) find that at zero net baryon density the transition from hadrons to the plasma is not a sudden change but a smooth **crossover**,:cite[p4-aoki2006] centred on a temperature of about 155 MeV,:cite[p4-bazavov2014] that is 1.8 × 10¹² K, about 100,000 times hotter than the core of the Sun.

The way to make matter that hot in a laboratory is to collide heavy nuclei. In a few weeks of each year the LHC collides lead nuclei instead of protons, at a collision energy of a few TeV per pair of nucleons, and the experiment designed for them is **ALICE** (A Large Ion Collider Experiment).:cite[p4-alice2008] Hundreds of nucleons collide at once and the matter in the overlap region, a few fermis across, thermalises in a time of the order of 1 fm/*c*. Two kinds of observation tell what that matter is.

- **Jet quenching.** Hard partons produced in the first instant must travel through the hot matter to escape. In lead–lead collisions the production of particles of large transverse momentum is suppressed, by a factor of several in central collisions, relative to what the proton–proton rate and the number of collisions predict. The partons lose energy in the medium. That a quark or gluon is dragged in the plasma is evidence that the plasma is coloured.:cite[p4-alice2011]
- **Collective flow.** The overlap region of two nuclei that collide off-centre is almond-shaped, and the particles come out with a pattern in azimuth that follows the almond, as if pressure gradients in a fluid had pushed them. The pattern, measured at the LHC, is described well by relativistic hydrodynamics with a very small viscosity,:cite[p4-alice2010] so the plasma behaves as a strongly coupled fluid rather than as a gas of free quarks.

These are the headline results; the field is large and this section is a pointer. The plasma is the state of the universe in its first microseconds (the astrophysics course's [big bang chapter](/astrophysics/ch/big-bang/) places it there), recreated for a few 10⁻²³ s.

:::experiments
**Pythia** and **Herwig** are the general-purpose generators behind the ideas of this chapter: matrix elements, a parton shower with Sudakov factors, and Lund-string or cluster hadronisation.:cite[p4-sjostrand2015] The generator the course uses is a transparent miniature of them; its physics matches in structure, not in tuning. **FastJet** (a C++ library, with interfaces for Python and for the experiments' software) is the program that every LHC experiment uses to cluster jets, and can use the O(N ln N) geometry described above, among other strategies it chooses from by the size of the event.:cite[p4-cacciari2012] ATLAS and CMS reconstruct anti-k<sub>T</sub> jets with R = 0.4 as their default, from calorimeter clusters and, in particle-flow reconstruction, from tracks combined with the calorimeters. For the heavy-ion case, ALICE uses jets with background subtraction of the large soft event.

The jet energy scale, the correspondence between the energy a jet appears to have in a detector and the energy of the parton it came from, is one of the largest systematic uncertainties of the experiments (Chapter 28).
:::

## What comes next

The chapter has finished Part IV. Forces are gauge fields: the photon of U(1) gave QED with its calculable cross-sections and loops; the gluons of SU(3) gave QCD with its running coupling, its confinement and its jets. Three of the pipeline's stages have grown in this part. The generator can now make e⁺e⁻ events from matrix elements, shower them and hadronise them, and the reconstruction clusters the particles into jets with the anti-k<sub>T</sub> algorithm, yours if you wrote it. [Part V](/chapters/accelerating-particles/) leaves the physics of the collision for the machine that makes it happen: how to accelerate particles to the energies at which these processes occur, how to steer them, and how to make them collide often enough to see rare things.

## Further reading

- The original papers on asymptotic freedom and on the lattice (:cite[p4-gross1973,p4-politzer1973,p4-wilson1974]).
- Cacciari, Salam and Soyez's paper on anti-k<sub>T</sub>, and the FastJet manual (:cite[p4-cacciari2008,p4-cacciari2012]).
- The Particle Data Group's review of QCD for the running coupling, and of the quark model for the hadrons (:cite[pdg2024]).
- Andersson, Gustafson, Ingelman and Sjöstrand's review of the Lund string model (:cite[p4-andersson1983]).
