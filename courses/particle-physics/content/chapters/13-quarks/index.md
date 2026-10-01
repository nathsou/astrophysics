---
number: 13
title: Quarks
summary: The triplet of the Eightfold Way is real, and the proton is made of three of them. Why they need a third property, colour; what their magnetic moments say; where the narrow peaks of the dimuon map come from; and how electrons scattered at SLAC saw them.
duration: About 3½ hours
prerequisites: [the-eightfold-way, scattering-is-seeing]
---

Chapter 12 ended with a hint. The octet and decuplet are exactly what one gets by combining three copies of the smallest representation of SU(3), the triplet: $3\otimes3\otimes3 = 10\oplus8\oplus8\oplus1$. And the eight lightest mesons are what one gets from a triplet and an antitriplet: $3\otimes\bar3 = 8\oplus1$. If the triplet were a set of real particles, the whole zoo would be built from them. In January 1964 Murray Gell-Mann, at Caltech, and George Zweig, at CERN, each proposed that it was. Gell-Mann called the particles **quarks**.:cite[gellmann1964,zweig1964]

The proposal had a cost. For the baryons to have charges of 0, ±1 and +2, the quarks had to have charges of $+\tfrac23$ and $-\tfrac13$ of the electron's. No one had ever seen a charge of that size, and no one has since: no free quark has been observed.:cite[pdg2024] This chapter is about how quarks came to be believed anyway. It is a story with four steps: a table of hadrons built from three kinds of quark; a puzzle that needs a new property, **colour**; two numerical tests, one a magnetic moment and one the dimuon peaks; and finally an experiment that looked inside the proton and saw point-like objects scatter.

## The quark model

There are three quarks of light flavour, named $u$ (up), $d$ (down) and $s$ (strange). The charge, baryon number, isospin and strangeness of each are chosen so that the sums reproduce the table of hadrons of Chapter 12, with the relation $Q = I_3 + Y/2$:

| Quark | $Q$ | $B$ | $I_3$ | $S$ |
|---|---|---|---|---|
| u | +⅔ | ⅓ | +½ | 0 |
| d | −⅓ | ⅓ | −½ | 0 |
| s | −⅓ | ⅓ | 0 | −1 |

A **baryon** is three quarks, and a **meson** is a quark and an antiquark. Add the quantum numbers and the table of hadrons follows:

- the proton is $uud$: charge $\tfrac23+\tfrac23-\tfrac13 = 1$, baryon number 1, strangeness 0, $I_3 = \tfrac12+\tfrac12-\tfrac12 = +\tfrac12$;
- the neutron is $udd$: charge 0;
- the $\Lambda$ is $uds$, with $S = -1$; the $\Sigma^+$ is $uus$; the $\Xi^-$ is $dss$ with $S = -2$;
- the $\Omega^-$ is $sss$: charge $-1$, strangeness $-3$, as the decuplet's missing corner needs;
- the $\pi^+$ is $u\bar d$ (charge $\tfrac23+\tfrac13 = 1$), the $K^+$ is $u\bar s$ (strangeness $+1$), the $K^-$ is $s\bar u$.

The library does this arithmetic: `parseContent`, `contentNumbers` and `hadronsWithContent` in `hep/su3`, and its tests check that for every hadron of the particle table with a simple quark content the charge, baryon number, strangeness, charm and bottom number computed from the quarks are the table's. The builder below uses them: add quarks and antiquarks, colour them (the next section), and read off the properties and the hadrons of the table that match.

::quark-builder{n="13.1" caption="Build a hadron. Add quarks and antiquarks, choose a colour for each, and read off the charge, baryon number, strangeness and isospin; see whether the colours cancel, and which particles of the table have that content. The presets include the proton, the Δ⁺⁺ and the Ω⁻. Try one quark alone, or two."}

The quark model explains more than the labels. A quark has to be *light*, to make hadrons of about a GeV, and yet the quark masses in the particle table are tiny: the $u$ is 2.2 MeV, the $d$ 4.7 MeV, the $s$ 93 MeV. These are **current masses**, the quarks' masses in the equations of the theory. Two $u$ and a $d$ add up to 9 MeV, which is 1 % of the proton's mass of 938 MeV. The rest is the energy of the strong force that binds them, and of their motion, and that is why the proton is as heavy as it is (Chapter 18). A different number, the **constituent mass**, about 340 MeV for $u$ and $d$ and about 510 MeV for $s$, is the effective mass that a quark has inside a hadron, and the next sections use it.

Two further successes. The mass splittings of Chapter 12 are the cost of replacing a light quark by a strange one: each step down the decuplet adds about 150 MeV, which is the extra mass of a strange quark in the hadron. And the pattern of which hadrons exist, as opposed to which are merely allowed, follows from the rule that quarks combine into only two shapes, $qqq$ and $q\bar q$. A state with only two quarks, or with one, does not appear in the table, and the builder will say so. The heavier flavours, $c$, $b$ and $t$, come in Chapters 24 and 25.

## A problem with the Δ⁺⁺, and its solution

The $\Delta^{++}$ is made of three $u$ quarks, $uuu$, and it has spin 3/2, so the three spins are lined up. In its lowest-energy state the quarks are in a state with no orbital angular momentum, which is symmetric under the exchange of any two. So the wave function is symmetric in flavour (three identical quarks), symmetric in spin (all aligned) and symmetric in position. But quarks are fermions, spin ½, and the exclusion principle (Chapter 3) says that the total wave function of identical fermions must be *antisymmetric* under exchange. The $\Delta^{++}$ appears to be forbidden. It exists: it is the first peak of Chapter 12, and the same problem arises for the $\Delta^-$ ($ddd$) and the $\Omega^-$ ($sss$).

The way out, proposed in 1964 by Oscar Greenberg and in 1965 by Moo-Young Han and Yoichiro Nambu, is that quarks carry another property, which takes three values and is hidden in every observed hadron. We call it **colour**, and name the three values red, green and blue, though nothing about it is visual.:cite[greenberg1964,hannambu1965] The wave function of a baryon then has a colour part as well, and if the three quarks are in the state that is antisymmetric in colour ("one of each colour"), then the total wave function is antisymmetric even though the rest is symmetric, and the exclusion principle is satisfied.

:::history{year=1964 title="Quarks and aces" people="Murray Gell-Mann, George Zweig" source="Sources: Gell-Mann (1964); Zweig (1964)."}
Gell-Mann's paper, *A schematic model of baryons and mesons*, was published in *Physics Letters* in 1964. It built the hadrons from three kinds of quark with fractional charges. The name, he later wrote, was taken from a line in James Joyce's *Finnegans Wake*.:cite[gellmann1964,gellmann1994] George Zweig, then at CERN, wrote down the same idea in two CERN preprints in the same year, with the name "aces".:cite[zweig1964] Gell-Mann received the Nobel Prize in Physics in 1969 for his work on the classification of elementary particles.:cite[nobel-physics]
:::

:::history{year=1965 title="A third property, colour" people="Oscar W. Greenberg, Moo-Young Han, Yoichiro Nambu" source="Sources: Greenberg (1964); Han and Nambu (1965)."}
The Δ⁺⁺ problem was seen at once. In 1964 Greenberg proposed that quarks obey a modified statistics, "parastatistics of order three", under which three identical quarks could be in the same state.:cite[greenberg1964] In 1965 Han and Nambu proposed three triplets of quarks with a new, hidden SU(3), the ancestor of colour.:cite[hannambu1965] In the theory of the strong force that exists today (Chapter 18), colour is the charge of the strong force, as electric charge is that of electromagnetism.
:::

Colour has a consequence that explains why quarks are never seen alone. Hadrons are **colour-neutral**: the colours cancel. The cancellation can happen in two ways, and they are the two shapes that quark models need: three quarks of three different colours (red, green, blue), which cancel as the three primary colours of light add to white, or a quark with an antiquark of its anticolour (a meson). Two quarks cannot cancel. One quark cannot. A mathematical test, made with the representation theory of Chapter 12: colour is an SU(3) triplet, a combination of colour triplets contains a singlet if and only if it is $3\otimes3\otimes3$ or $3\otimes\bar3$ or a combination of those; and the library's `hasColourSinglet` decomposes the product and looks for the $1$. The builder uses it. Why the strong force makes only colourless combinations visible, **confinement**, is a property of the force that Chapter 18 describes.

A second line of evidence for three colours is counting: the rate at which electrons and positrons make hadrons is three times as large as it would be without colour (Chapter 16).

```predict
q: 'In the quark model the Δ⁺⁺ is three u quarks with their spins lined up, in the lowest spatial state. Suppose colour did not exist. What would the exclusion principle say about this state?'
options:
  - text: It is allowed, because each u quark has a different spin projection.
    why: 'In the Δ⁺⁺ with spin 3/2 and J_z = +3/2 all three spins point the same way. Two identical fermions in the same spin, flavour and spatial state are what the exclusion principle forbids.'
  - text: It is forbidden, because the wave function would be symmetric under exchange of two quarks, and fermions need an antisymmetric one.
    correct: true
    why: 'Flavour (uuu), spin (↑↑↑) and position (the same lowest state) are each symmetric under exchange. The product is symmetric. Quarks are fermions. A third, antisymmetric part of the wave function, colour, is what lets the Δ⁺⁺ exist.'
  - text: It is allowed, because quarks are not fermions.
    why: 'Quarks have spin ½, which makes them fermions (Chapter 3), and everything in the quark model follows from that.'
```

## The magnetic moments of the nucleons

One number from this model can be tested at once. A particle with spin and charge is a tiny magnet. Its **magnetic moment** $\mu$ is measured in nuclear magnetons, $\mu_N = e\hbar/2m_p$, the moment that a point particle of the proton's mass and unit charge would have. A Dirac particle (Chapter 9) of charge $Q_q e$ and mass $m_q$ has $\mu_q = Q_q\,(m_p/m_q)\,\mu_N$. If the proton were a point Dirac particle its moment would be exactly 1. The measurement gives $\mu_p = 2.793\,\mu_N$ and, for the *neutral* neutron, $\mu_n = -1.913\,\mu_N$.:cite[pdg2024] A neutral particle with a magnetic moment, and a proton with 2.8 times what a point particle would have, mean that both are extended objects with charged parts.

The quark model makes a definite prediction. In the ground-state wave function of a proton with spin up, the net spin of the quarks is shared as: up quarks together carry $+\tfrac43$ of a unit of spin-up (in units where each quark's spin contributes $\pm1$), and the down quark $-\tfrac13$. Adding the moments of the three quarks, weighted that way, gives

:::equation{#moments caption="Magnetic moments of the proton and the neutron in the quark model."}
$$\term{mup}{\mu_p} = \tfrac13\left(4\,\term{muu}{\mu_u} - \term{mud}{\mu_d}\right),\qquad \term{mun}{\mu_n} = \tfrac13\left(4\,\mu_d - \mu_u\right)$$

```terms
mup:
  label: 'μ_p, the proton''s magnetic moment'
  what: The magnetic moment of the proton, in nuclear magnetons.
  why: In the quark model it is the sum of the moments of the three quarks, each weighted by how much of the proton's spin it carries.
  effect: Measured 2.793 nuclear magnetons.
muu:
  label: 'μ_u, the moment of the up quark'
  what: The magnetic moment of a u quark inside a hadron, Q_u (m_p/m_u) in nuclear magnetons with Q_u = +2/3.
  why: A heavier quark has a smaller moment, a larger charge a larger moment.
  effect: With u and d of equal mass, μ_u = −2 μ_d, because their charges are +2/3 and −1/3.
mud:
  label: 'μ_d, the moment of the down quark'
  what: The same for the d quark, with charge −1/3.
  why: It enters the proton once and the neutron twice.
  effect: Of opposite sign to μ_u, so the two partly cancel in the proton.
mun:
  label: 'μ_n, the neutron''s magnetic moment'
  what: The neutron has one u and two d quarks, so the roles of u and d are exchanged.
  why: It is the proton's formula with u and d exchanged, which is what isospin says it should be.
  effect: A neutral particle with a moment of −1.913 nuclear magnetons, negative, and a second proof that it has charged parts.
```
:::

If the $u$ and $d$ quarks have the same constituent mass, $\mu_u = -2\mu_d$ and the ratio comes out exactly:

$$\frac{\mu_p}{\mu_n} = \frac{4\mu_u - \mu_d}{4\mu_d - \mu_u} = \frac{-8\mu_d-\mu_d}{4\mu_d + 2\mu_d} = -\frac32 .$$

The measured ratio is $2.793/(-1.913) = -1.460$. The prediction is within 3 %. If one also takes the constituent mass to be a third of the proton's, then $\mu_u = 2$ and $\mu_d = -1$ nuclear magnetons, and the model gives $\mu_p = 3$ and $\mu_n = -2$: both within 8 % of the measurements. It is not an accident, and no other model of that time did this. Turn it around: fix $\mu_u$ and $\mu_d$ to reproduce the proton and neutron exactly, and the quark masses follow: $\mu_u = 1.852$, $\mu_d = -0.972$, a constituent mass of 338 MeV for $u$ and $d$. Doing the same with the measured moment of the $\Lambda$, $-0.613\,\mu_N$, which in the model is the moment of its strange quark, gives a mass of the strange quark of about 510 MeV. These are the numbers of the previous section, and now they have a source.

```numeric
id: quark-mass-from-moments
title: A constituent mass from a magnetic moment
prompt: In the quark model μ_p = (4μ_u − μ_d)/3 and μ_n = (4μ_d − μ_u)/3, with μ_q = Q_q (m_p/m_q) in nuclear magnetons. Using the measured μ_p = 2.7928 and μ_n = −1.9130 to find μ_u, what is the constituent mass of the u quark, in MeV? (Proton mass 938.27 MeV, Q_u = 2/3.)
answer: 338
unit: MeV
tolerance: 0.02
hints:
  - Solve the two equations for μ_u. Adding 4 times the first to the second gives 4μ_p + μ_n = 5μ_u.
  - Then m_u = Q_u m_p / μ_u.
explain: "μ_u = (4 × 2.7928 − 1.9130)/5 = 1.852 nuclear magnetons. m_u = (2/3) × 938.27 MeV / 1.852 = 338 MeV: about a third of the proton's mass, which is what the constituent picture says. The d quark comes out at μ_d = (4 × (−1.9130) + 2.7928)/5 = −0.972, with a mass of 322 MeV, within 5 % of the u quark's."
```

:::deeper[Where the weights 4/3 and −1/3 come from]
The proton with spin up is a combination of states in which the three quarks have their spins arranged in different ways, built so that the whole is symmetric in the combined spin and flavour (the colour supplies the antisymmetry). Written out, it is

$$|p\uparrow\rangle = \frac{1}{\sqrt{18}}\Big[\,2\,u\!\uparrow u\!\uparrow d\!\downarrow - u\!\uparrow u\!\downarrow d\!\uparrow - u\!\downarrow u\!\uparrow d\!\uparrow\Big] + \text{permutations of the quarks' positions},$$

where each term is the product of the three quarks' flavour and spin. Compute the expectation value of the total magnetic moment, the sum of each quark's $\mu_q$ times its spin projection ($+1$ for up, $-1$ for down): the probabilities that the two $u$ quarks are up or down come out as $\tfrac53$ up and $\tfrac13$ down in total for the $u$ pair, so the net spin of the $u$ quarks is $\tfrac53-\tfrac13 = \tfrac43$, and the $d$ quark is up with probability $\tfrac13$ and down with $\tfrac23$, a net of $-\tfrac13$. The weights multiply the moments of the quarks, which gives $\mu_p = \tfrac43\mu_u - \tfrac13\mu_d$. The neutron follows by exchanging $u$ and $d$, and the library's `octetMoments` writes out all seven octet moments in the same way.
:::

## Vector mesons and the peaks of the dimuon map

The quark model has two kinds of meson with the same quark content but different spins. The pseudoscalars of the Eightfold Way ($\pi$, $K$, $\eta$) have the two quark spins opposite and a total of spin 0. Flip one spin so that they are parallel and the total is 1: the **vector mesons**. They are heavier, since parallel spins cost energy. The $\pi^+$ ($u\bar d$) at 140 MeV has a vector partner, the $\rho^+$, at 775 MeV. The neutral ones are mixtures:

- the $\rho^0$ is $(u\bar u - d\bar d)/\sqrt2$, with mass 775 MeV and width 147 MeV;
- the $\omega$ is $(u\bar u + d\bar d)/\sqrt2$, with mass 783 MeV and width 8.7 MeV;
- the $\phi$ is $s\bar s$, with mass 1019 MeV and width 4.2 MeV.

The $\rho$ and the $\omega$ have nearly equal masses because $u$ and $d$ have equal constituent masses and the two combinations differ only by a sign; the $\phi$ is 237 MeV heavier because it contains two strange quarks instead of two light ones, about 120 MeV for each, the same order as the 150 MeV per strange quark of the decuplet.

The widths say something striking about the quarks. The $\rho$ decays to two pions almost always (99.955 %), with 496 MeV to spare, and lives a very short time: its width is 147 MeV. The $\phi$ has a mass that is just above the threshold for a pair of kaons ($2\times493.7 = 987$ MeV), so only 32 MeV are available, a momentum of 127 MeV/$c$ for each. It decays to $K^+K^-$ or to $K_LK_S$ in 83 % of cases, and only in 15 % to the three pions $\pi^+\pi^-\pi^0$, though three pions have much more energy to spare. The width of the $\phi$ is 35 times smaller than that of the $\rho$. The explanation is in the quark lines: the decay $s\bar s \to K\bar K$ lets the strange quarks continue into the kaons, while $s\bar s\to\pi\pi\pi$ has to annihilate the quarks completely and make new ones. The rule that such decays are suppressed, named after Okubo, Zweig and Iizuka, is one of the signatures that the $\phi$ is $s\bar s$.

All three vector mesons have the same quantum numbers as the **photon**: spin 1, and the same parity and charge conjugation. A photon can turn into any of them and back, and one of the possible decays of a vector meson is therefore into a *virtual* photon and then into a lepton pair, $\rho^0\to\gamma^*\to\mu^+\mu^-$. The probability is small (the particle table's branching fractions to $e^+e^-$ are $4.5\times10^{-5}$ for the $\rho^0$ and $7\times10^{-5}$ for the $\omega$, and the muon mode is about the same), but the signature is clean: two muons whose invariant mass (Chapter 2) is the meson's mass. And the pions and kaons, whose quantum numbers are those of no photon, cannot do it.

Return to the dimuon map of Chapter 2, the 100,000 real pairs of muons from the CMS experiment, with the peaks that Chapter 2 left unlabelled. In the region below 1.1 GeV there are two features, a narrow spike near 0.78 GeV and another near 1.02 GeV. The first is the $\omega$ (and the $\rho$ beneath it); the second is the $\phi$.

::dimuon-map{n="13.2" reveal="rho,phi" caption="The invariant mass of 100,000 real muon pairs from CMS (2011, CERN Open Data, CC0), as in Chapter 2, with two peaks now labelled: the ρ and ω, together, near 0.78 GeV, and the φ near 1.02 GeV. They are the neutral vector mesons of the light quarks. Hover to read the bins."}

Count the real events. In the sample, an 80 MeV window around the $\omega$ (0.74 to 0.82 GeV) holds 717 pairs, where the windows on either side hold 491 and 487: about 230 pairs above the continuum. The window around the $\phi$ (0.98 to 1.06 GeV) holds 760 where its neighbours hold 490 and 495, about 270 above. The $\omega$ is the narrow spike. The $\rho$, which is 17 times as wide, is a broad low swelling beneath it that the sample's selection, which was designed for much heavier particles (Chapter 27), and the continuum largely hide; the map labels the pair together. The $\phi$ spike is a particle made of strange quarks, in a plot made from the muons in a detector at the Large Hadron Collider, and the data are real. The rest of the map is for later: the $J/\psi$ and $\Upsilon$ families (Chapter 24) and the $Z$ boson (Chapter 23).

## Looking inside the proton

The quark model fitted the hadrons, but nobody had *seen* a quark, and by the mid-1960s the model was considered by many a convenient bookkeeping. The test is the one Chapter 4 set up. To see a structure of size $\lambda$ one needs a probe of momentum transfer $Q \approx \hbar c/\lambda$; Hofstadter had used electrons of a few hundred MeV to measure the proton's size, 0.84 fm, and had shown that it is not a point. To see what is inside, go to higher energy. At the Stanford Linear Accelerator Center (SLAC), a linear accelerator two miles long, electrons could be accelerated to about 20 GeV, and in 1967 a group of physicists from SLAC and MIT began to scatter them from hydrogen.

The measurement is the same as Rutherford's, in a different regime: fire a beam of electrons at a target of protons, and record for each scattered electron its energy $E'$ and its angle. Two numbers describe the collision. The first is the **momentum transfer** $Q^2$, defined as $Q^2 = -q^2$ where $q$ is the difference of the electron's four-momentum before and after. It sets the resolution $\lambda = \hbar c/Q$. At a $Q^2$ of 10 GeV², $Q = 3.2$ GeV and $\lambda = 0.062$ fm, a thirteenth of the proton's radius. The second is the energy given to the proton, $\nu = E - E'$.

```fermi
id: dis-resolution
title: What does a 20 GeV electron resolve?
prompt: An electron scatters from a proton and transfers a momentum Q with Q² = 10 GeV². About what distance, in femtometres, does it resolve? (ħc = 0.1973 GeV fm.)
answer: 0.062
unit: fm
factor: 3
hints:
  - The resolution is λ = ħc/Q, as in Chapter 1.
explain: "Q = √10 = 3.16 GeV, so λ = 0.1973 / 3.16 = 0.062 fm, about a thirteenth of the proton's radius (0.84 fm). SLAC could see structure 13 times finer than the proton's size, and so could tell whether there was any."
```

If the electron scatters elastically, the proton recoils intact and the energy loss is fixed by the angle: $\nu = Q^2/2M$. This is the process that Hofstadter measured; it falls steeply with $Q^2$, the form factor of an extended object (Chapter 4). But the electron can also lose more energy and *break up* the proton into a spray of hadrons, **deep inelastic scattering**: the hadronic system has an invariant mass $W$ much greater than the proton's. The cross-section for that depends on two variables, $Q^2$ and $\nu$, and it is convenient to replace them by $Q^2$ and the dimensionless ratio

:::equation{#bjorken-x caption="Bjorken's scaling variable."}
$$\term{x}{x} = \frac{\term{Q2}{Q^2}}{2\,\term{M}{M}\,\term{nu}{\nu}}$$

```terms
x:
  label: 'x, the Bjorken variable'
  what: A number between 0 and 1 that measures how much energy the electron transferred, at a given Q². x = 1 is elastic scattering.
  why: If the photon strikes a single constituent of the proton, x is the fraction of the proton's momentum that the constituent carried (derived below).
  effect: A small x means a large energy transfer relative to Q², from a constituent with a small share of the momentum.
Q2:
  label: 'Q², the momentum transfer squared'
  what: The square of the four-momentum carried by the virtual photon, with the sign changed so that it is positive. In GeV².
  why: It sets the resolution of the probe, λ = ħc/Q.
  effect: 10 GeV² resolves about 0.06 fm.
M:
  label: 'M, the proton mass'
  what: 0.938 GeV.
  why: The target is at rest, so 2Mν is the invariant that appears.
  effect: Together with ν it fixes x for each measured scattering.
nu:
  label: 'ν, the energy transferred'
  what: The energy lost by the electron, E − E', in the proton's rest frame.
  why: It is measured directly from the scattered electron.
  effect: Larger ν at fixed Q² means smaller x.
```
:::

The question that SLAC asked was how the cross-section depends on $Q^2$ at fixed $x$. If the proton were a smooth, extended blob of charge, the answer would be familiar from Chapter 4: the cross-section would fall off steeply with $Q^2$ as the probe resolved finer than the blob's smoothness, and the inelastic cross-section would die away as the elastic one does. If instead the proton contained point-like charged constituents, then at $Q^2$ high enough to resolve them the electron would scatter from a point, and the cross-section for scattering from a point does not fall off in this way: it depends on $x$ and not on $Q^2$.

```predict
q: 'Electrons of up to 20 GeV scatter deeply inelastically from protons, with Q² from about 1 to a few tens of GeV². If the proton is a smooth extended blob of charge, how should the inelastic structure function F₂(x, Q²) behave as Q² rises at fixed x?'
options:
  - text: It should stay roughly constant, because the blob is the same size at every Q².
    why: 'The blob is the same size, but the probe resolves it better as Q² rises. A smooth blob has a form factor that falls off with Q². Staying constant is what a collection of points does.'
  - text: It should fall steeply, as the elastic form factor does.
    correct: true
    why: 'A smooth blob, probed at distances much shorter than its smoothness, is transparent to the probe: the amplitude to scatter from it without breaking it up falls rapidly. This was the expectation, and SLAC found the opposite: F₂ was nearly independent of Q².'
  - text: It should rise, because more of the blob is resolved.
    why: 'Resolving more of a smooth blob does not make it scatter more. Only a point-like structure that scatters independently gives a flat dependence, and rising is for a growing number of constituents (which does happen, slowly, as the later figure shows).'
```

The answer, announced in 1968 and published in 1969, was the surprise of the experiment: the inelastic cross-section did *not* fall steeply. Once the energy transfer was large enough to break the proton up, the structure functions depended on $x$ and hardly on $Q^2$. James Bjorken had predicted that if the constituents were points this would happen, and called it **scaling**.:cite[bloom1969,breidenbach1969,bjorken1969] It is as if at a resolution of 0.06 fm the proton looked like a collection of points. Richard Feynman gave the picture a name: the proton contains **partons**, point-like constituents, and the electron scatters from one of them at a time.:cite[feynman1969]

:::deeper[Why x is the parton's momentum fraction]
Let the proton have four-momentum $P$ and mass $M$. In a frame in which the proton is moving very fast, so that its constituents' masses and transverse momenta are negligible, a parton carries a fraction $\xi$ of the proton's momentum, $\xi P$. The virtual photon, of four-momentum $q$, is absorbed by the parton, which must afterwards be a (nearly) massless on-shell particle: $(\xi P + q)^2 = 0$. Expanding, $\xi^2 P^2 + 2\xi P\cdot q + q^2 = 0$. The first term, $\xi^2 M^2$, is negligible compared with the others, and $q^2 = -Q^2$, so $2\xi\,P\cdot q = Q^2$. In the proton's rest frame $P\cdot q = M\nu$, hence

$$\xi = \frac{Q^2}{2M\nu} = x .$$

Bjorken's variable is the fraction of the proton's momentum carried by the struck parton, and the cross-section at fixed $x$ is the sum, over kinds of parton, of the probability of finding one with that fraction, weighted by its charge squared.
:::

The structure function $F_2$ is the combination of the cross-sections that carries this information. In the parton picture it is

$$F_2(x) = \sum_q e_q^2\; x\, f_q(x),$$

where $f_q(x)\,dx$ is the number of partons of kind $q$ with momentum fraction between $x$ and $x+dx$, the **parton distribution function** (PDF), and $e_q$ is the quark's charge. Callan and Gross showed that point-like partons of *spin ½* give a particular relation between two of the structure functions, and the SLAC data fitted it: the partons are spin-½ particles, as quarks are.:cite[callan1969] Later measurements, including the scattering of neutrinos (a different probe of the same partons, with different charges), supported the fractional charges $\tfrac23$ and $-\tfrac13$ and showed that the charged partons carry only about half of the proton's momentum. The other half is carried by something neutral, the glue of Chapter 18.:cite[pdg2024]

:::history{year=1968 title="Electrons see points inside the proton" people="Jerome Friedman, Henry Kendall, Richard Taylor, and the SLAC–MIT collaboration" source="Sources: Bloom et al. (1969); Breidenbach et al. (1969); Bjorken (1969); Feynman (1969)."}
The SLAC–MIT group scattered electrons from the linear accelerator off hydrogen and deuterium targets and measured the scattered electrons in spectrometers at fixed angles of 6° and 10°. They found that, for a hadronic mass $W$ above the resonances, the cross-section was far larger than a smooth-blob proton would give and, as expressed in the right variables, that it depended only weakly on $Q^2$. The first results were shown in 1968 and the two papers appeared in *Physical Review Letters* in 1969.:cite[bloom1969,breidenbach1969] Bjorken's prediction of the scaling behaviour was published in the same year,:cite[bjorken1969] and Feynman's parton model, which explained it as scattering from point-like constituents, soon after.:cite[feynman1969] Friedman, Kendall and Taylor received the Nobel Prize in Physics in 1990.:cite[nobel-physics]
:::

:::history{year=1969 title="Feynman's partons" people="Richard P. Feynman" source="Source: Feynman (1969)."}
Feynman's paper *Very high-energy collisions of hadrons*, published in *Physical Review Letters* in 1969, viewed a fast-moving proton as a swarm of point-like constituents, each carrying a fraction of its momentum, and a collision as an incoherent sum of collisions with each of them.:cite[feynman1969] He called them partons, without committing himself to what they were. The identification with quarks followed from their measured charges and spin ½, and the glue was added when it became clear that the charged partons carry only about half of the momentum.
:::

## The proton at increasing resolution

The figure puts all of this together. It uses the course's own parton distributions, `xf` and `pdf` in `hep/gen`. **They are a teaching parametrisation and not a fit to data**: a set of hand-chosen shapes at a starting scale of 1.27 GeV, evolved to higher $Q$ with the real leading-order evolution equation (Chapter 18), and expect differences of tens of per cent from a published set. What they get right is structural: the valence quarks (two $u$ and one $d$) peaked near $x\approx0.2$; a sea of quark–antiquark pairs, with more $\bar d$ than $\bar u$; and a gluon that rises steeply towards small $x$.

Move the sliders. At the lowest $Q$ the resolution $\lambda = \hbar c/Q$ is larger than the proton and the picture is a blob; once it is finer, three valence quarks appear. At higher $Q$, and with a probe sensitive to smaller $x$, the sea and the gluons appear. The numbers (the partons with $x > x_\text{min}$) come from the integrals of the PDFs.

::dis-proton{n="13.3" caption="The proton at increasing resolution, from the course's pedagogical parton distributions. Q sets the resolution λ = ħc/Q; the second slider sets the smallest momentum fraction x that the probe is sensitive to. The curves are x f(x, Q) at that Q: the valence u and d, a fraction of the sea, and the gluon. The positions of the dots are random and mean nothing; the counts are the integrals of the distributions."}

Some numbers from the figure's distributions. The valence quarks number 3 whatever $Q$ (the sum rules: $\int(u-\bar u)\,dx = 2$ and $\int(d-\bar d)\,dx = 1$), and the share of the proton's momentum that they carry falls from 38 % at $Q = 2$ GeV to 26 % at $Q = 100$ GeV, while the gluons' share rises from 44 % to 48 % and the sea's from 18 % to 26 %. With $x > 0.01$ the proton has 2.5 valence quarks, 3.4 sea quarks and antiquarks and 8 gluons at $Q = 2$ GeV, and 2.2, 5.1 and 8.8 at $Q = 100$ GeV. Going to smaller $x$ finds many more: with $x > 0.001$ there are about 20 gluons at 1.27 GeV and 54 at $Q = 100$ GeV. A proton at high energy is a swarm.

The structure function does not scale exactly, and the second figure shows how it fails. At moderate $x$ the function $F_2$ is nearly flat over a range of $Q^2$ like the one SLAC used, and at small $x$ it rises: more small-$x$ partons are resolved as $Q$ rises. These slow changes, which QCD predicts and the course's PDFs reproduce through their evolution, are the **scaling violations** (Chapter 18).

::scaling-plot{n="13.4" caption="F₂(x, Q²) = Σ e_q² x (q + q̄) from the course's parton distributions, for four values of x, against Q². The shaded band is an illustrative range of Q² (2 to 20 GeV²). The curves for x = 0.1 and 0.25 are nearly flat there: Bjorken scaling. At x = 0.01 the function rises, and at x = 0.5 it falls: the scaling violations. A teaching parametrisation and not data."}

For the numbers in the band: between $Q^2 = 2$ and 20 GeV², $F_2$ at $x = 0.1$ changes by 1 %, at $x = 0.25$ it falls by 14 %, at $x = 0.5$ it falls by 29 % and at $x = 0.01$ it rises by 44 %.

## Sampling a parton's momentum

The proton beams of the generator (stage 2 of the pipeline in Chapter 0) need one more thing from the PDFs: to make a collision at the LHC one needs the momentum fractions $x_1$ and $x_2$ of the two partons that collide. They are random numbers with the density of the PDFs. A parton distribution is a function of $x$ that varies over many orders of magnitude; the algorithm for drawing from it is the subject of the exercise.

```code
id: sample-parton-x
title: Sampling x from a parton distribution
hook: gen.samplePartonX
prompt: |
  Implement `samplePartonX(f, n, r, xMin)`: return `n` values of $x$ in [`xMin`, 1] distributed with a density proportional to `f(x)`, using the random-number generator `r` (a function that returns a uniform number in [0, 1), from `hep/random`'s `rng`).
  A parton distribution varies over decades of $x$, so a table in $\ln x$ is a good place to start: in $t = \ln x$ the density is $x f(x)$. Build the cumulative distribution of $x f(x)$ on a grid of $t$ between $\ln x_\text{min}$ and 0, and invert it for each random number. Any correct method will do (inverse transform, or accept–reject with a good envelope), but it must use `r` and no other source of randomness, so that results can be repeated.
starter: |
  import type { Rng } from 'hep/random';

  export function samplePartonX(f: (x: number) => number, n: number, r: Rng, xMin = 1e-3): number[] {
    // 1. tabulate the cumulative integral of x f(x) over t = ln x, from ln(xMin) to 0
    // 2. for each of n draws, pick u = r() × total and invert the table
    return Array.from({ length: n }, () => 0.5);
  }
tests: |
  import { test, expect } from '@pp/test';
  import { samplePartonX } from 'solution';
  import { rng } from 'hep/random';
  import { pdf } from 'hep/gen';

  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

  test('returns n values inside [xMin, 1]', () => {
    const xs = samplePartonX((x) => 1 / x, 5000, rng(1), 1e-3);
    expect(xs.length).toBe(5000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1e-3);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1);
  });

  test('a density 1/x is flat in ln x: the mean of ln x is −ln(1000)/2', () => {
    const xs = samplePartonX((x) => 1 / x, 40000, rng(2), 1e-3);
    expect(mean(xs.map(Math.log))).toBeCloseTo(-Math.log(1000) / 2, 1);
  });

  test('x^(−1/2) (1 − x)^3 is a Beta(1/2, 4) density with mean 1/9', () => {
    const xs = samplePartonX((x) => x ** -0.5 * (1 - x) ** 3, 60000, rng(3), 1e-9);
    expect(mean(xs)).toBeCloseTo(1 / 9, 2);
  });

  test('the up-valence distribution of the course: the sample mean matches the integral', () => {
    const f = (x: number) => pdf(2, x, 10) - pdf(-2, x, 10);
    const xMin = 1e-3;
    let num = 0, den = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const x = Math.exp(Math.log(xMin) * (1 - (i + 0.5) / N));
      num += x * x * f(x);
      den += x * f(x);
    }
    const exact = num / den;
    const xs = samplePartonX(f, 30000, rng(5), xMin);
    expect(mean(xs)).toBeCloseTo(exact, 2);
  });

  test('the same seed gives the same numbers, and a different seed does not', () => {
    const f = (x: number) => x ** -0.3 * (1 - x) ** 4;
    expect(samplePartonX(f, 20, rng(7), 1e-3)).toEqual(samplePartonX(f, 20, rng(7), 1e-3));
    expect(samplePartonX(f, 20, rng(7), 1e-3)).not.toEqual(samplePartonX(f, 20, rng(8), 1e-3));
  });
solution: |
  import type { Rng } from 'hep/random';

  export function samplePartonX(f: (x: number) => number, n: number, r: Rng, xMin = 1e-3): number[] {
    const N = 600;
    const t0 = Math.log(xMin);
    const h = -t0 / N;
    // cumulative integral of x f(x) over t = ln x (trapezoid rule)
    const cdf = new Float64Array(N + 1);
    let prev = f(xMin) * xMin;
    for (let i = 1; i <= N; i++) {
      const x = Math.exp(t0 + i * h);
      const cur = f(x) * x;
      cdf[i] = cdf[i - 1]! + 0.5 * (prev + cur) * h;
      prev = cur;
    }
    const total = cdf[N]!;
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      const u = r() * total;
      let lo = 0, hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid]! <= u) lo = mid;
        else hi = mid;
      }
      const w = cdf[hi]! - cdf[lo]!;
      const frac = w > 0 ? (u - cdf[lo]!) / w : 0;
      out.push(Math.exp(t0 + (lo + frac) * h));
    }
    return out;
  }
hints:
  - 'In t = ln x the probability density is x f(x), because dx = x dt. Accumulate it with the trapezoid rule on a grid of 500 or so points.'
  - 'To invert: draw u uniformly in [0, total], find the interval of the table that contains u (binary search), interpolate linearly inside it, and return exp(t).'
```

:::programmer
A parton distribution is a function that is expensive to evaluate and cheap to tabulate, and the library treats it like one: the real work (evolving the distributions with $Q$) is done once, the first time they are asked for, and stored on a grid, and each call is a lookup with interpolation, the same trade as a lookup table in a game engine or a memoised function. Sampling $x$ from it is **inverse-transform sampling**, the same technique as drawing a lifetime from an exponential (Chapter 3), made to work on a tabulated cumulative distribution. The only subtlety is the choice of variable: a density that spans six decades of $x$ is smooth in $\ln x$, so the table lives there. The mistake to avoid is a table uniform in $x$, which spends all its resolution at large $x$ where the distributions are small.
:::

:::hood[Parton-distribution grids and their interpolation]
The generator calls `xf(pdg, x, Q)` hundreds of thousands of times per second. The first call evolves the distributions in $Q$ with the leading-order evolution equation, on a grid of 160 points in $\ln(1/x)$ from $x=1$ to $10^{-6}$ and a grid of $Q$ values spaced by 0.15 in $\ln Q^2$, and stores the result. After that a call is two small interpolations: cubic (a four-point Lagrange formula) along $\ln(1/x)$, and linear between the two nearest nodes of $\ln Q^2$:

```ts
// src/lib/hep/gen/pdf.ts: pdfAll(x, Q, out)
const f = (t - T.t[k]!) / (T.t[k + 1]! - T.t[k]!);       // position between two Q-nodes, t = ln Q²
let y = -Math.log(x);
const base = lagrange(y / H, lw4);                        // four weights along ln(1/x)
for (let s = 0; s < NF; s++) {                            // d, d̄, u, ū, s, c, b, g
  const o = s * N + base;
  const a = w0 * d0[o]! + w1 * d0[o + 1]! + w2 * d0[o + 2]! + w3 * d0[o + 3]!;   // at the lower Q-node
  const b = w0 * d1[o]! + w1 * d1[o + 1]! + w2 * d1[o + 2]! + w3 * d1[o + 3]!;   // at the upper one
  out[s] = a + f * (b - a);                               // linear in ln Q²
}
```

The last call's result is cached, so asking for several flavours at the same $(x, Q)$ costs one interpolation. The test suite checks that the evolution keeps the sum rules ($\int(u-\bar u)\,dx = 2$, $\int(d-\bar d)\,dx = 1$, and the momentum sum $\sum\int x f\,dx = 1$ to 3 %): a grid error would break them first. The reader's `samplePartonX`, above, can replace the reference through the hook `gen.samplePartonX`.
:::

:::experiments
Real parton distributions are *fitted*. Groups of physicists (CT, MSHT, NNPDF and others) fit the distributions' shapes to hundreds of measurements, from SLAC's to the LHC's, and publish the result as tables that a library called **LHAPDF** serves to the event generators, with a family of alternative fits that expresses the uncertainty. The measurement that extended the range of $x$ and $Q^2$ by orders of magnitude was **HERA** at DESY in Hamburg, the only electron–proton collider, which ran from 1992 to 2007 with electrons of 27.5 GeV against protons of 820 and then 920 GeV: its deep inelastic scattering reached $x$ down to about $10^{-5}$ and showed the gluon rising steeply at small $x$, which is what the course's distributions mimic. The LHC then uses the distributions twice, once for each proton: the probability of a collision between a parton with $x_1$ and one with $x_2$ is $f(x_1)f(x_2)$, with $\hat s = x_1x_2 s$ (Chapters 21 and 23).
:::

## What comes next

The proton is three quarks, plus a sea and a glue that carries half its momentum. What is that glue? Why can quarks not be pulled out of a proton, and what does colour have to do with it? Part IV takes up forces and fields: [Chapter 14](/chapters/fields-and-particles/) starts with what a field is, Chapter 15 with Feynman diagrams, and Chapter 18 returns to colour, the gluon and confinement, and the jets that a struck quark makes as it leaves the proton.

## Further reading

- Gell-Mann's *A schematic model of baryons and mesons* (:cite[gellmann1964]) is two and a half pages, and cautious.
- The SLAC–MIT papers (:cite[bloom1969,breidenbach1969]) and Feynman's partons (:cite[feynman1969]).
- The Particle Data Group's reviews of the quark model and of structure functions (:cite[pdg2024]).
