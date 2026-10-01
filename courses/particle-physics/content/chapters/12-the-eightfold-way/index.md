---
number: 12
title: The Eightfold Way
summary: By 1960 the strongly interacting particles numbered in the dozens, with no order among them. Plotted by charge and strangeness, they fell into hexagons and a triangle with a corner missing, and the missing particle was found where the pattern said.
duration: About 3 hours
prerequisites: [conservation-laws, relativity-for-particles]
---

By 1960 the list of strongly interacting particles had grown longer than anyone could keep in mind. Besides the proton and neutron and the pions, there were the kaons, the Λ and the three Σ, the two Ξ, and the resonances such as the Δ, with more being found each year as accelerators reached higher energies. They have a collective name, the **hadrons**. Each has a mass, a spin, a charge and strangeness (Chapter 11) and a lifetime. None of those was explained. A physicist faced with a list like that looks for a pattern, as Mendeleev did with the elements. This chapter is the search for it, and it succeeded: the particles fall into families that have the shapes of the representations of a group, and the pattern had a hole in it that predicted a particle, which was found in 1964.

The chapter has three parts. First a new quantum number, **isospin**, that groups particles of nearly equal mass. Second the **resonance**, a particle so short-lived that it shows up as a bump in a cross-section. Third the pattern itself: SU(3).

## Isospin: the proton and neutron as one particle

The proton has a mass of 938.272 MeV and the neutron 939.565 MeV. They differ by 1.293 MeV, 0.14 %. The strong force between two protons, between two neutrons and between a proton and a neutron is, as far as nuclear physics can tell, the same. In 1932 Werner Heisenberg proposed that this is not an accident: the proton and neutron are two states of one particle, the **nucleon**, in the way that spin up and spin down are two states of an electron.:cite[heisenberg1932] A particle with spin $s$ has $2s+1$ states, distinguished by the third component $s_z$. The nucleon has two states, and the label that distinguishes them is the third component of a new quantity, **isospin**, with $I = \tfrac12$: the proton has $I_3 = +\tfrac12$ and the neutron $I_3 = -\tfrac12$.

Nothing is spinning. Isospin is a mathematical device: it uses the algebra of spin (Chapter 3), with two states rotating into each other under the group SU(2), applied to a different pair of states. It is useful because the strong force does not care about the rotation: the strong interaction conserves isospin, so a strong reaction cannot tell the members of a multiplet apart. The electromagnetic force does care, since the proton has charge and the neutron does not, and that is what breaks the symmetry and makes the masses a little different.

The other particles come in multiplets too, with $2I + 1$ members each. The three pions, $\pi^+$, $\pi^0$, $\pi^-$ (139.57, 134.98 and 139.57 MeV), form a triplet with $I = 1$ and $I_3 = +1, 0, -1$. The kaons are doublets, $(K^+, K^0)$ and $(\bar K^0, K^-)$. The $\Lambda$ is alone, with $I = 0$; the $\Sigma^+, \Sigma^0, \Sigma^-$ are a triplet, the two $\Xi$ a doublet; and the resonance $\Delta(1232)$ comes in four charge states, $\Delta^{++}$, $\Delta^+$, $\Delta^0$, $\Delta^-$, with $I = \tfrac32$.

The charge of every member follows from its isospin and strangeness. Gell-Mann and Nishijima noted that for hadrons

:::equation{#gmn caption="The Gell-Mann–Nishijima relation: charge from isospin and hypercharge."}
$$\term{Q}{Q} = \term{I3}{I_3} + \frac{\term{Y}{Y}}{2},\qquad Y = B + S$$

```terms
Q:
  label: 'Q, the electric charge'
  what: The charge of the particle in units of the proton's charge.
  why: It is what the detector measures from the sign of a track's curvature. The relation says that it is not independent of the other quantum numbers.
  effect: For the proton Q = 1/2 + 1/2 = 1, for the neutron −1/2 + 1/2 = 0.
I3:
  label: 'I₃, the third component of isospin'
  what: The label that distinguishes the members of an isospin multiplet. Particles with I = 1/2 have I₃ = ±1/2, those with I = 1 have −1, 0, +1.
  why: Of all the members of a multiplet, the electromagnetic force sees only their charge, and the charge steps up by one with I₃.
  effect: Raise I₃ by one unit within a multiplet and the charge rises by one unit.
Y:
  label: 'Y, the hypercharge'
  what: The sum of baryon number B and strangeness S (for the light hadrons of this chapter). It is the same for every member of an isospin multiplet.
  why: It is the second label that, with I₃, places a particle on the plane of Fig. 12.2.
  effect: Nucleons have Y = +1, the Λ and Σ have Y = 0, the Ξ have Y = −1, and the Ω⁻ has Y = −2.
```
:::

For the $\Xi^-$: $I_3 = -\tfrac12$, $B = 1$, $S = -2$ so $Y = -1$, and $Q = -\tfrac12 - \tfrac12 = -1$. The library checks the relation for every hadron of its particle table whose isospin is tabulated (the charm and bottom hadrons too, with their quantum numbers added to $Y$). It is a relation among the table's own columns, which is the best evidence that the table is internally consistent, and that the quantum numbers of Chapter 11 and the new one hang together.

| Baryon | $Q$ | $I_3$ | $S$ | $Y$ | Mass (MeV) |
|---|---|---|---|---|---|
| p | +1 | +½ | 0 | +1 | 938.3 |
| n | 0 | −½ | 0 | +1 | 939.6 |
| Σ⁺ | +1 | +1 | −1 | 0 | 1189.4 |
| Σ⁰ | 0 | 0 | −1 | 0 | 1192.6 |
| Σ⁻ | −1 | −1 | −1 | 0 | 1197.4 |
| Λ | 0 | 0 | −1 | 0 | 1115.7 |
| Ξ⁰ | 0 | +½ | −2 | −1 | 1314.9 |
| Ξ⁻ | −1 | −½ | −2 | −1 | 1321.7 |

These eight spin-½ baryons are the table that the rest of the chapter arranges. Notice how the masses cluster: the nucleons near 939, the $\Lambda$ and $\Sigma$ between 1116 and 1197, the $\Xi$ near 1318. Within a cluster the masses differ by a few MeV (isospin broken by electromagnetism), and between clusters by about 180 MeV (the cost of one unit of strangeness).

## A resonance is a bump

Chapter 3 said that a particle that decays quickly has a *width* $\Gamma$, and that a width of $\Gamma$ corresponds to a lifetime $\hbar/\Gamma$. The $\Delta(1232)$ has a mass of 1232 MeV and a width of 117 MeV, so a lifetime of $5.6\times10^{-24}$ s: during that time light travels 1.7 fm, the size of the proton. Nobody sees a Δ's track in a detector; nobody could. It decays into a nucleon and a pion so quickly that it never leaves the neighbourhood of the point where it was made. Such a particle is called a **resonance**, and the way to find it is the way one finds the resonant frequency of a circuit: scan the energy of an incoming beam and look for a peak.

The scan is this. Fire pions of a chosen energy at a target of hydrogen (that is, protons at rest), count how many scatter, and compute the cross-section $\sigma$, the effective area of the proton for that pion (Chapter 4). The pion and proton together have a centre-of-mass energy $\sqrt s$ that rises with the pion's energy (Chapter 2). If there is a state of mass $M$ that the pion and proton can form, the cross-section rises when $\sqrt s$ passes through $M$, as a driven oscillator responds near its resonant frequency, and falls again after. The shape of the bump is the Breit–Wigner curve, with a full width at half maximum of $\Gamma$.

```predict
q: 'The Δ(1232) has mass 1.232 GeV; the proton is 0.938 GeV and the pion 0.140 GeV. A pion beam hits protons at rest. At about what kinetic energy of the pion beam is the centre-of-mass energy equal to the Δ mass?'
options:
  - text: About 0.15 MeV, since the Δ is only a little heavier than the nucleon.
    why: 'The Δ is 294 MeV above the proton in mass, not 0.15 MeV. In the centre-of-mass frame all of the energy must be there.'
  - text: About 190 MeV.
    correct: true
    why: 'On a stationary proton s = m_p² + m_π² + 2 m_p E_π. Setting √s = 1.232 GeV gives E_π = (1.232² − 0.938² − 0.140²)/(2 × 0.938) = 0.329 GeV, and the kinetic energy is 0.329 − 0.140 = 0.190 GeV: 190 MeV, within the reach of the cyclotrons of the early 1950s.'
  - text: About 1.2 GeV, the Δ mass itself.
    why: 'That would be right for colliding beams in which all of the beam energy is available. On a fixed target, as in Chapter 2, only part of it is, and the threshold is lower here than the Δ mass.'
```

The figure shows what a measurement of this kind gives, from the particle table's mass and width. It is a model curve and not data: its height is the largest cross-section that a single partial wave of angular momentum 3/2 can give (Chapter 3's unitarity), which is $8\pi/k^2 = 190$ mb for the momentum $k = 227$ MeV/$c$ of the pion in the centre-of-mass frame, and which the real $\pi^+p$ cross-section, at about 200 mb, nearly reaches.:cite[pdg2024]

::delta-bump{n="12.1" caption="The Δ resonance in pion–proton scattering. The curve is a model with the particle table's mass and width; the peak height is the unitarity limit of a single wave of angular momentum 3/2. π⁺p is pure isospin 3/2, and π⁻p is one third of it."}

The two curves differ by a factor of three, and the reason is isospin. A $\pi^+$ and a proton have $I_3 = +1 + \tfrac12 = \tfrac32$, which can only be a state of total isospin $I = \tfrac32$: the $\pi^+p$ system is a pure $\Delta^{++}$ state. A $\pi^-p$ has $I_3 = -\tfrac12$, which can be part of an $I = \tfrac32$ state or an $I = \tfrac12$ state, and the Clebsch–Gordan coefficients say it is $\tfrac13$ of the first and $\tfrac23$ of the second. At the Δ's mass the $I = \tfrac32$ part resonates and the other does not, so $\sigma(\pi^-p)/\sigma(\pi^+p) = \tfrac13$, a ratio of 3 : 1 that was seen in the data and was part of how the resonance's isospin was determined.

:::deeper[Where the factor of one third comes from]
The state of a $\pi^-$ ($I = 1$, $I_3 = -1$) and a proton ($I = \tfrac12$, $I_3 = +\tfrac12$) is a combination of the two total-isospin states with $I_3 = -\tfrac12$. The standard Clebsch–Gordan coefficients for $1\otimes\tfrac12$ give

$$|\pi^-p\rangle = \sqrt{\tfrac13}\,|\tfrac32,-\tfrac12\rangle - \sqrt{\tfrac23}\,|\tfrac12,-\tfrac12\rangle,$$

while $|\pi^+p\rangle = |\tfrac32,+\tfrac32\rangle$ exactly. The probability of being in the $I = \tfrac32$ state is $\tfrac13$ for $\pi^-p$ and 1 for $\pi^+p$. The strong force conserves isospin, so the two isospin states scatter independently, and near the Δ only $I = \tfrac32$ has a large amplitude. If $\sigma_{3/2}$ is the cross-section of the $I = \tfrac32$ state, then $\sigma(\pi^+p) = \sigma_{3/2}$ and $\sigma(\pi^-p) = \tfrac13\sigma_{3/2} + \tfrac23\sigma_{1/2}$, which tends to $\tfrac13\sigma_{3/2}$ where $\sigma_{1/2}$ is small. The library's `pionNucleonIsospinFractions` has the three charge channels.
:::

:::history{year=1952 title="A cross-section that will not stop rising" people="Enrico Fermi, Herbert Anderson, Edward Long, Darragh Nagle" source="Source: Anderson, Fermi, Long and Nagle (1952)."}
In 1952, at the University of Chicago, Herbert Anderson, Enrico Fermi and their colleagues measured how often positive pions of increasing energy, from the university's synchrocyclotron, were scattered by hydrogen. The cross-section rose steeply with energy over the range the machine could reach.:cite[anderson1952] The rise was the first sign of a resonance, which came to be called the "3,3 resonance" (spin 3/2 and isospin 3/2) and then the $\Delta(1232)$. Measurements at higher energy located the peak near a pion energy of 190 MeV, at about 200 mb, which fits the kinematics above.:cite[pdg2024] It was the first of many such resonances, and the first evidence that the proton has excited states.
:::

## SU(3) as a pattern

The proton and the neutron are two states of one particle. The proton, the neutron, the Λ, the three Σ and the two Ξ, as the table above shows, have similar masses (within about 40 %), the same spin ½ and the same baryon number. Could they all be states of one particle, with a symmetry that is broken much more than isospin is? **Murray Gell-Mann** and, independently, **Yuval Ne'eman** proposed in 1961 that they are, and that the symmetry is **SU(3)**.:cite[gellmann1961,neeman1961]

SU(3) is the group of $3\times3$ unitary matrices with determinant 1: it acts on a set of three states, which we can call $u$, $d$ and $s$. (In 1964 these will turn out to be quarks, and Chapter 13 says what they are. For this chapter they are labels of a triplet.) The group has eight generators, which are the 3×3 analogues of the Pauli matrices. Two of them commute and can be diagonalised at the same time: they are $I_3$ and the hypercharge $Y$. The other six change one state into another, in the way that the raising and lowering operators of spin change $s_z$. A set of states that these eight generators move among, and nothing else, is called a **representation**. For SU(3) the representations are labelled by two non-negative integers $(p, q)$, and their dimensions are

:::equation{#su3-dim caption="The dimension of the representation (p, q) of SU(3)."}
$$\dim(\term{p}{p}, \term{q}{q}) = \frac{(p+1)(q+1)(p+q+2)}{2}$$

```terms
p:
  label: 'p, a Dynkin label'
  what: The first of two non-negative integers that label a representation of SU(3). A representation (p, 0) is a pattern in which p quarks (labels u, d, s) are combined symmetrically.
  why: It counts how many steps of one kind lie between the highest state and the edge of the pattern.
  effect: p = 1 with q = 0 is the triplet (3), p = 3 with q = 0 is the decuplet (10).
q:
  label: 'q, the other Dynkin label'
  what: The second integer. (0, 1) is the antitriplet, and (1, 1) is the octet.
  why: The conjugate representation, with all states reflected through the origin, has p and q exchanged.
  effect: The octet (1, 1) is its own conjugate, which is why its pattern is symmetric under reflection and it contains particles and antiparticles together (π⁺ and π⁻, K⁺ and K⁻).
```
:::

(0,0) has dimension 1, (1,0) and (0,1) have 3, (2,0) has 6, **(1,1) has 8** and **(3,0) has 10**. The library generates the states of any $(p, q)$ from its highest weight, the state with the largest $I_3$ and $Y$ that the others are made from, and its output is the weight diagram of the figure: a state is a dot at $(I_3, Y)$, the charge is constant along diagonals, and the number in a dot is how many states have that pair of labels. Move the sliders to see which patterns appear.

::weight-diagram{n="12.2" p=1 q=1 caption="Weight diagrams of SU(3), generated from the highest weight by the library. Choose a representation or set p and q. The octet (1,1) is a hexagon with a double state at the centre. The decuplet (3,0) is a triangle of ten dots. The numbers in the dots are multiplicities and the small labels are charges. Hypercharge Y is vertical and I₃ horizontal."}

Look at the two patterns that matter.

- The **octet** (8) has a hexagon of six states and a double state in the middle: at $Y = +1$ a doublet $(I_3 = \pm\tfrac12)$, at $Y = 0$ a triplet and a singlet at the same $Y$, and at $Y = -1$ a doublet. Put the eight spin-½ baryons on it: $p, n$ at the top, $\Sigma^+, \Sigma^0, \Sigma^-$ and $\Lambda$ at $Y = 0$ ($\Sigma^0$ and $\Lambda$ both at the centre, which is why the centre is double), and the two $\Xi$ at the bottom. The same pattern holds the eight lightest spin-0 mesons: $K^+, K^0$ at the top, $\pi^+, \pi^0, \pi^-$ and $\eta$ in the middle, and $K^-, \bar K^0$ below.
- The **decuplet** (10) is a triangle with rows of 4, 3, 2 and 1: isospin $\tfrac32, 1, \tfrac12, 0$ at hypercharge $+1, 0, -1, -2$. Put the spin-3/2 baryons on it: the four $\Delta$ in the top row, then the three $\Sigma^*(1385)$, then the two $\Xi^*(1530)$. The last place, at $Y = -2$, charge $-1$, strangeness $-3$, was empty in 1962.

The octet had been "full" for years: all eight were known. The decuplet had ten places, and nine particles to put in them.

### Masses within a multiplet

If SU(3) were exact, all the members of a multiplet would have the same mass. They do not: the $\Delta$ is at 1232 MeV, the $\Sigma^*$ at about 1385 and the $\Xi^*$ at about 1530. The symmetry is broken by the difference between the strange and non-strange states, and Gell-Mann and, independently, Susumu Okubo worked out how: if the breaking behaves in a particular simple way, the masses obey a formula that depends on the hypercharge and isospin.:cite[gellmann1962,okubo1962] For the baryon octet it is

$$2\,(m_N + m_\Xi) = 3\,m_\Lambda + m_\Sigma ,$$

where each mass is an average over the charge states of the multiplet. With the particle table's masses, $m_N = 938.9$, $m_\Xi = 1318.3$, $m_\Lambda = 1115.7$ and $m_\Sigma = 1193.2$ MeV, the left side is 4514 MeV and the right side is 4540 MeV: they agree to 0.6 %. For the lightest spin-0 mesons the analogous relation holds for the squares of the masses, $4 m_K^2 = 3 m_\eta^2 + m_\pi^2$, and it works to about 6 %. For the decuplet the formula says something simpler:

:::equation{#equal-spacing caption="Equal spacing in the decuplet: the mass depends linearly on the hypercharge."}
$$\term{M}{M}(Y) = M_0 + \term{c}{c}\,\term{Ycoord}{Y}$$

```terms
M:
  label: 'M(Y), the mass of the decuplet row at hypercharge Y'
  what: The mass of any member of the decuplet, which depends only on the row it is in (isospin multiplets have equal masses, up to electromagnetic differences).
  why: The Gell-Mann–Okubo formula, applied to a decuplet, has no terms beyond the linear one in Y.
  effect: Each step down in Y changes the mass by the same amount c.
c:
  label: 'c, the mass step'
  what: The mass change per unit of hypercharge, about −150 MeV. The mass rises as the hypercharge falls, one unit of strangeness at a time.
  why: It is the measure of how badly SU(3) is broken in this multiplet.
  effect: With c = −150 MeV the four rows are spaced about 150 MeV apart.
Ycoord:
  label: 'Y, the hypercharge'
  what: +1 for the Δ, 0 for the Σ*, −1 for the Ξ*, −2 for the missing corner.
  why: It is the label for the rows of the triangle.
  effect: Each step down by one unit in Y adds one unit of strangeness.
```
:::

## The missing corner

The first three rows are known. In round numbers of the early 1960s the $\Delta$ was at 1232 MeV, the $\Sigma^*$ at 1385 and the $\Xi^*$ at 1530. The steps are 153 MeV and 145 MeV. The bottom row should be one more step down, another 145 to 150 MeV: about 1675 to 1680 MeV. The library does the calculation with the table's masses for the Δ and the Ω⁻ and the PDG values of today for the other two: the steps are 152 and 148 MeV, and the next level comes at 1680 MeV from the last spacing and 1682 MeV from a straight line through all three. (The measured mass of the Ω⁻ today is 1672 MeV, within 0.6 % of both.)

```predict
q: 'The rows of the decuplet sit at about 1232, 1385 and 1530 MeV (steps of about 150 MeV). Strangeness changes by one unit from row to row. Where would you expect the particle with strangeness −3?'
options:
  - text: Near 1600 MeV, since the steps should get smaller as the mass grows.
    why: 'Nothing in the argument makes the steps shrink. The Gell-Mann–Okubo formula for a decuplet says the mass is a linear function of the hypercharge, so the steps are equal.'
  - text: Near 1680 MeV, one more step of about 150 MeV.
    correct: true
    why: 'A straight line through the three rows has a step of about 149 MeV. One more step gives 1530 + 149 ≈ 1679 MeV, which is close to where Gell-Mann''s argument puts it, and to where the Ω⁻ was found: 1672 MeV in today''s tables.'
  - text: Near 1800 MeV, because strange particles are heavier.
    why: 'Each extra unit of strangeness adds about 150 MeV (the step), not 270. The step is already in the three rows you were given.'
```

Gell-Mann went further in 1962 and said what the new particle would look like. It would have charge $-1$, strangeness $-3$ and spin 3/2, and a mass near 1680 MeV. Could it decay by the strong force? The strong force conserves strangeness (Chapter 11), so the products of a strong decay have strangeness $-3$, and the lightest such system the particle could turn into is a $\Xi$ ($S = -2$) with a $\bar K$ ($S = -1$): at least 1808 MeV by the table's masses, which is more than 1680 MeV. So the strong decay is closed by *energy*. Every decay that is open changes strangeness by at least one unit, and is weak: slow. The $\Omega^-$ should live $10^{-10}$ s, long enough to leave a track several centimetres long. That is the prediction.

::eightfold-puzzle{n="12.3" caption="The Eightfold Way puzzle. Place the eight spin-½ baryons on the octet, then the nine known spin-3/2 baryons on the decuplet. Find the missing corner (strangeness −3, charge −1), predict its mass from the spacing of the rows, and lock in the prediction. The diagrams come from the library's SU(3) code; the masses of the Δ and Ω⁻ are from the particle table, those of the Σ* and Ξ* are the PDG values of the neutral states."}

:::history{year=1961 title="A pattern for the hadrons" people="Murray Gell-Mann, Yuval Ne'eman" source="Sources: Gell-Mann (1961, 1962); Ne'eman (1961); Okubo (1962)."}
In 1961 Gell-Mann, at Caltech, circulated a report, *The Eightfold Way: a theory of strong interaction symmetry*, which arranged the hadrons in the representations of SU(3).:cite[gellmann1961] Yuval Ne'eman, working independently in London, published the same idea in *Nuclear Physics* in the same year.:cite[neeman1961] Gell-Mann's fuller account, *Symmetries of baryons and mesons*, came out in the *Physical Review* in 1962,:cite[gellmann1962] and Susumu Okubo derived the mass formula that goes with it.:cite[okubo1962] In 1962, when the $\Xi^*$ resonance was announced, Gell-Mann pointed out that the decuplet then had a place unfilled, and predicted the properties of the particle that was missing: the $\Omega^-$.:cite[gellmann1962]
:::

## 1964: the Ω⁻ is found

To make an $\Omega^-$ one needs three units of strangeness from a beam and a target that carry none or one. The reaction is

$$K^-\,p \to \Omega^-\,K^+\,K^0,$$

which conserves charge ($-1 + 1 = 0 = -1 + 1 + 0$), baryon number (+1 on each side) and strangeness ($-1 + 0 = -3 + 1 + 1$). The reaction judge of Chapter 11 will confirm it. Its threshold, from the masses of the three final particles, is a centre-of-mass energy of 2.664 GeV, which a $K^-$ beam of 3.1 GeV/$c$ striking protons at rest reaches (by the same arithmetic as the antiproton's). A beam of 5 GeV/$c$ has plenty.

The experiment was done at Brookhaven National Laboratory on Long Island, with the 80-inch bubble chamber (Chapter 5) filled with liquid hydrogen, so that the target protons were the hydrogen nuclei in the chamber itself, and a beam of $K^-$ at 5.0 GeV/$c$ from the laboratory's proton synchrotron, the AGS. The physicists scanned the photographs for the characteristic pattern.:cite[chambers-barnes1964] One picture had a $K^-$ entering the chamber and interacting with a proton, to produce a $K^+$ and a $K^0$ and an $\Omega^-$. The $\Omega^-$ travelled a few centimetres and decayed into a $\Xi^0$ and a $\pi^-$. The $\Xi^0$, which is neutral and leaves no track, decayed into a $\Lambda$ and a $\pi^0$; the $\pi^0$ decayed into two photons that converted into electron–positron pairs (Chapter 9) in the liquid, and the $\Lambda$, again neutral, decayed into a proton and a $\pi^-$ whose tracks form a V. A chain of decays, each at a vertex that the geometry fixed, all in one picture. Tracking back from the visible tracks gave the mass of the parent: $1686 \pm 12$ MeV.:cite[chambers-barnes1964]

::bubble-chamber{n="12.4" preset="omega" caption="A re-simulation of the topology of the 1964 Brookhaven event: a K⁻ of 5 GeV/c from the left makes Ω⁻ K⁺ K⁰ in liquid hydrogen; the Ω⁻ decays to Ξ⁰ π⁻, the Ξ⁰ to Λ π⁰, and the Λ to p π⁻. This is a simulation drawn from the published kinematics, not the photograph, which is held by Brookhaven National Laboratory; it follows the course's chamber model, with its field, bubble density and lengths of flight. Dashed lines (when shown) are the neutral particles' paths. In the simulation the neutral kaon is a K_S and decays to π⁺π⁻."}

:::history{year=1964 title="The tenth particle of the decuplet" people="V. E. Barnes and 32 colleagues at Brookhaven National Laboratory" source="Source: Barnes et al. (1964)."}
*Observation of a hyperon with strangeness minus three* appeared in *Physical Review Letters* on 24 February 1964. The authors, 33 physicists from Brookhaven and other institutions, described a single bubble-chamber event in which the Ω⁻ was made and decayed through a chain of particles. The chamber was the Brookhaven 80-inch hydrogen bubble chamber and the beam was of 5.0 GeV/$c$ K⁻ mesons. They found that the mass, $1686 \pm 12$ MeV, was in agreement with the prediction of the Eightfold Way, and they named it Ω⁻.:cite[chambers-barnes1964] Gell-Mann received the Nobel Prize in Physics in 1969 for his contributions to the classification of elementary particles and their interactions.:cite[nobel-physics]
:::

The prediction is the reason that the Eightfold Way was believed. A classification that merely organises known particles has little force: any list can be arranged in some fashion. A classification that says "there is a particle with this charge, this strangeness, this spin and about this mass, and it will live long enough to leave a track", and is right, has been tested.

```fermi
id: delta-flight
title: How far does a Δ go?
prompt: The Δ(1232) has a width of 0.117 GeV. About how far, in femtometres, does it travel at nearly the speed of light before it decays? (ħc = 0.1973 GeV fm.)
answer: 1.7
unit: fm
factor: 3
hints:
  - The distance is c times the lifetime τ = ħ/Γ, which in natural units is ħc/Γ.
explain: "cτ = ħc/Γ = 0.1973 GeV fm / 0.117 GeV = 1.69 fm. A particle moving near the speed of light covers that in 5.6 × 10⁻²⁴ s, about the diameter of a proton: the Δ lives and dies inside the region where it was made. It can only be seen as a bump."
```

```numeric
id: decuplet-spacing
title: Predict the Ω⁻
prompt: In 1962 the three known rows of the decuplet were at 1232, 1385 and 1530 MeV. Using the average spacing of the three rows, (1530 − 1232)/2, predict the mass of the missing S = −3 particle in MeV (one spacing below the last row).
answer: 1679
unit: MeV
tolerance: 0.004
hints:
  - The average step is (1530 − 1232)/2 = 149 MeV.
  - The prediction is the last row plus one step.
explain: "1530 + 149 = 1679 MeV. Using only the last two rows (1385 and 1530) gives 1530 + 145 = 1675 MeV: the answer does not depend much on the choice. The Ω⁻ is at 1672 MeV, and the first measurement gave 1686 ± 12 MeV."
```

:::programmer
The Eightfold Way is a **type system** for particles. A representation of a group is the set of states that the group's generators can reach from one another, and the weight diagram is its type: a particle is an instance of exactly one of them. The decuplet had a slot with no instance, and the type told the physicists what a value for it would look like. The same idea is at work whenever a schema predicts a missing field, or a state machine has an unreachable state that a test should hit. The group theory is a way of getting the schema for free, from a handful of rules, instead of listing it.
:::

:::hood[Generating a multiplet from its highest weight]
The library does not store the octet or the decuplet. It *generates* any representation $(p, q)$ by listing its states with Gelfand and Tsetlin's patterns, triples of rows of integers that interlace one another, and reading off $I_3$ and $Y$ from the sums of the rows:

```ts
// src/lib/hep/su3/index.ts: irrep(p, q)
const m13 = p + q, m23 = q, m33 = 0;                       // the top row, from the highest weight
for (let m12 = m23; m12 <= m13; m12++) {
  for (let m22 = m33; m22 <= m23; m22++) {
    const s2 = m12 + m22;                                    // an isospin multiplet: I = (m12 − m22)/2
    const y3 = 3 * s2 - 2 * (m13 + m23 + m33);              // 3Y
    for (let m11 = m22; m11 <= m12; m11++) {                 // one state of the multiplet per m11
      const nu = m11, nd = s2 - m11;
      const i3x2 = nu - nd;                                  // 2·I3
      // … add one state at (i3x2, y3), counting multiplicities
    }
  }
}
```

Each pattern is one state, so the count comes out right without any group theory being coded: the tests check $\dim(p, q) = (p+1)(q+1)(p+q+2)/2$ for every $(p, q)$ up to $(5, 5)$, and that products of representations decompose correctly ($3\otimes\bar3 = 8\oplus1$, $3\otimes3\otimes3 = 10\oplus8\oplus8\oplus1$). The particles are then *placed* on the diagram by matching the strangeness and $I_3$ of each table entry to a weight. The decuplet has two kinds of entry: the table has the $\Delta$ and the $\Omega^-$, and has no $\Sigma^*$ or $\Xi^*$, whose masses the library keeps in a small constant. The puzzle widget shows exactly this: nine places that can be filled from the data, and one that cannot.
:::

:::experiments
The classification is still how experiments name the hadrons that they find. The PDG's particle listing assigns every established hadron to a multiplet, and the **LHCb** experiment (Chapter 24), which studies hadrons that contain heavy quarks, has reported dozens of new ones, many of them members of multiplets of the same kind; the pattern is a tool for deciding whether a new bump in an invariant-mass spectrum is a new state or a known one with a missing decay product. Bubble chambers, the instruments of 1964, have been replaced by electronic detectors (Chapter 7), and nobody photographs the Ω⁻ any more: the LHC experiments reconstruct it in the decay $\Omega^-\to\Lambda K^-$ (the largest branching fraction, 67.8 % in the particle table) from tracks, by the invariant-mass method of Chapter 2.
:::

## What comes next

The pattern is a pattern of *what*? The octet and decuplet are representations of SU(3), and the triplet is the simplest of them. If the triplet corresponded to real particles, all the others could be built from it: $3\otimes3\otimes3 = 10\oplus8\oplus8\oplus1$ contains exactly the decuplet and the octet, and $3\otimes\bar3 = 8\oplus1$ contains the meson octet. [Chapter 13](/chapters/quarks/) takes that step. The triplet particles are the quarks, they have charges that are fractions of the electron's, and the physicists who proposed them in 1964 did not at first believe that they were real.

## Further reading

- Gell-Mann's 1962 paper *Symmetries of baryons and mesons* (:cite[gellmann1962]) and Okubo's mass formula (:cite[okubo1962]).
- The Brookhaven paper (:cite[chambers-barnes1964]) is two and a half pages, and has the photograph.
- Anderson, Fermi, Long and Nagle (:cite[anderson1952]) for the first sign of a resonance.
