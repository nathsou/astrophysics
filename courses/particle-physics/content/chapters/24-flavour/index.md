---
number: 24
title: Flavour
summary: Quarks and leptons come in three generations, and the weak force mixes them. The mixing explains why strange particles decay slowly, predicted the charm quark, and, because three generations allow a complex phase, makes matter and antimatter behave differently. It also gives the b quark a lifetime long enough to see it fly.
duration: About 3 hours
prerequisites: [w-and-z, conservation-laws, reconstruction]
---

In Chapter 22 the W turned a down quark into an up quark and an electron neutrino into an electron, each within its own pair. Look at the particle table and that cannot be the whole story. A kaon contains a strange quark and decays through the weak force into pions, which have none. A strange quark has become an up quark or a down quark, across a family boundary. Particle physicists use the word **flavour** for which kind of quark or lepton a particle is, and this chapter is about the weak force changing it.

There are six flavours of quark and six of lepton, which fall into three **generations**: the same pattern of charges repeated three times with increasing mass.

| Generation | Up-type quark (charge +⅔) | Down-type quark (charge −⅓) | Charged lepton | Neutrino |
|---|---|---|---|---|
| I | u, 2.2 MeV | d, 4.7 MeV | e, 0.511 MeV | ν_e |
| II | c, 1.27 GeV | s, 93 MeV | μ, 105.7 MeV | ν_μ |
| III | t, 172.6 GeV | b, 4.18 GeV | τ, 1.777 GeV | ν_τ |

The masses are the particle table's (the quark masses are the "current" masses, as Chapter 13 explained, and the top is its pole mass). They span a factor of about $3\times10^5$ between the electron and the top quark, and nothing in the theory says why. Isidor Rabi's remark on the muon, "who ordered that?" (Chapter 10), is now a question about two whole families. This chapter does not answer it. It describes how the weak force connects the three, and what that shows.

## Mixing: the Cabibbo angle

If the W coupled each up-type quark only to the down-type quark of its own generation, then a strange quark could never decay to an up quark. But it does, through $s \to u\,W^-$. The decays of strange particles are slower than those of particles that do not contain strange quarks, so the coupling exists but is weak. Compare two decays that Fermi's theory (Chapter 22) says are governed by the same constant: the beta decay of a neutron, $d\to u$, and the decay of a $\Lambda$, $s\to u$. The second goes at a rate about twenty times lower, after allowing for the energy released.

In 1963 Nicola Cabibbo proposed that the quark that the W couples to $u$ is not $d$ itself but a **rotated** combination,

$$d' = d\cos\theta_C + s\sin\theta_C,$$

so that the weak charged current changes $u$ into $d'$, and the total strength is shared between the two: $\cos^2\theta_C$ for $u\leftrightarrow d$ and $\sin^2\theta_C$ for $u\leftrightarrow s$.:cite[cabibbo1963] The angle that fits the data is $\theta_C = 13.0°$, with $\sin\theta_C = 0.225$.

The same angle accounts for a small discrepancy that had been noticed: the Fermi constant measured in the beta decay of nuclei, which is $d\to u$, is about 2.6 % smaller than the one from the muon's decay, which has no quarks in it. $\cos\theta_C = 0.974$. The coupling of the W to the $u$–$d$ pair is $\cos\theta_C$ times what it is to a lepton pair, so the weak force between nucleons seems a little weaker than between leptons.

## GIM and charm

The Cabibbo scheme solved one problem and made another. The Z boson of Chapter 23 couples to neutral pairs, and if the quarks were $u$, $d$ and $s$ with the mixture $d'$, the Z would couple to $\bar d' d'$, which contains a term $\bar s d$: a Z that changes a strange quark into a down quark without changing its charge. A **flavour-changing neutral current** like that would let the $K_L$ decay into $\mu^+\mu^-$ at a rate comparable to charged-current decays. The observed branching fraction is about $7\times10^{-9}$.:cite[pdg2024] Neutral currents that change flavour are, as far as anyone has seen, absent at tree level.

In 1970 Sheldon Glashow, John Iliopoulos and Luciano Maiani found the remedy: add a **fourth quark**, $c$, and let it couple to the orthogonal combination $s' = -d\sin\theta_C + s\cos\theta_C$. The Z then couples to $\bar d'd' + \bar s's'$, which equals $\bar dd + \bar ss$ with the off-diagonal terms cancelling.:cite[gim1970] The charm quark pairs with $s'$ the way the up quark pairs with $d'$, so the first two generations are two identical doublets, and the quarks match the two lepton doublets $(\nu_e, e)$ and $(\nu_\mu,\mu)$ one for one.

:::history{year=1970 title="A fourth quark to cancel a current that was not there" people="Sheldon Glashow, John Iliopoulos, Luciano Maiani" source="Sources: Glashow, Iliopoulos and Maiani (1970); Gaillard and Lee (1974)."}
Glashow, Iliopoulos and Maiani did not need the charm quark to describe any observed particle. They needed it to make the weak interaction free of a current that experiments had not seen. At the time most physicists did not take the idea seriously, and the quark model was not yet believed (Chapter 13). In 1974 Mary Gaillard and Benjamin Lee used the theory's loop diagrams, which cancel only if the charm quark and the up quark differ in mass, to estimate the charm mass from the measured mass difference of the $K_L$ and the $K_S$, and found about 1.5 GeV.:cite[gaillard1974] The prediction was made just before the J/ψ appeared.
:::

:::history{year=1963 title="Rotating the quarks, a year before they existed" people="Nicola Cabibbo" source="Source: Cabibbo (1963)."}
Cabibbo's paper is about the hadrons, not quarks: he worked with the SU(3) symmetry of Chapter 12, in which the weak current has a component with $\Delta S = 0$ and a component with $|\Delta S| = 1$, and proposed that they share one universal strength, divided by an angle. The language of quarks came a few years later, and rewrote the same idea as a rotation between the $d$ and the $s$ quark. The angle is still the largest of the three mixing angles.:cite[cabibbo1963]
:::

## The November Revolution

The charm quark and its antiquark can form a bound state, like positronium (Chapter 9) with the strong force instead of the electromagnetic one. In November 1974 two experiments found it at the same time.

::dimuon-map{reveal="rho,phi,jpsi,psi2s,upsilon,z" n="24.1" caption="The dimuon map of Chapter 2, now with every peak named. The ρ, ω and φ near 1 GeV (Chapter 13); the J/ψ at 3.097 GeV and the ψ(2S) at 3.686 GeV, bound states of a charm quark and its antiquark (this section); the three Υ states at 9.46, 10.02 and 10.36 GeV, bound states of a bottom quark and its antiquark (below); and the Z at 91.19 GeV (Chapter 23). The step near 8 GeV, where the trigger turns on, is explained in Chapter 27."}

:::history{year=1974 title="The November Revolution" people="Samuel Ting, Burton Richter and their collaborations" source="Sources: Aubert et al. (1974); Augustin et al. (1974); Nobel Foundation (1976)."}
On 11 November 1974 two groups announced the same particle. At Brookhaven National Laboratory a team led by Samuel Ting fired protons of 30 GeV at a beryllium target and looked for pairs of electrons and positrons; they found a sharp peak in the pair mass at 3.1 GeV and called the particle **J**.:cite[aubert1974] At the Stanford Linear Accelerator Center, a team led by Burton Richter, working with the SPEAR electron–positron collider, saw the rate of $e^+e^-\to$ hadrons jump by a large factor at the same energy, within a very narrow range, and called it **ψ**.:cite[augustin1974] The particle is now called the J/ψ. Ting and Richter shared the 1976 Nobel Prize in Physics.:cite[nobel1976] A few days later SPEAR found a second narrow state at 3.7 GeV, the ψ(2S), and the field changed within weeks.

What made the discovery astonishing was the width. The J/ψ has a width of 93 keV, a lifetime of $7\times10^{-21}$ s, about 1,600 times the lifetime of the ρ meson, which weighs a quarter as much. A hadronic resonance usually falls apart in $10^{-23}$ to $10^{-24}$ s. This one was narrow because it could not.
:::

Why it cannot is an energy account, and the library does it. The lightest hadrons with charm are the $D^0$ ($c\bar u$, 1.865 GeV) and $D^+$ ($c\bar d$, 1.870 GeV). A $c\bar c$ state decays quickly by splitting into a pair of them, the way the ρ splits into two pions, if it has the energy: $2m_{D^0} = 3.730$ GeV. The J/ψ has 3.097 GeV and the ψ(2S) 3.686 GeV. Both are **below the threshold** to make a $D\bar D$ pair. The only way out for the charm quark and antiquark is to annihilate each other into gluons, a process the strong force suppresses strongly. The same mechanism makes the J/ψ narrow, and the radiative and leptonic decays visible. The branching fraction of the J/ψ to a muon pair is 6 % (the particle table): that is why the peak is in the dimuon map. The state with the same quark content but more energy, the ψ(3770), lies above threshold and is broad.

The charm quark was found. The same pattern repeated itself higher up. In 1975, in the same SPEAR collider, Martin Perl and colleagues found events with an electron and a muon and no other particles, which pointed to a third charged lepton, the **tau**, 3,500 times heavier than the electron.:cite[perl1975] And in 1977, at Fermilab, a team led by Leon Lederman looked at the dimuons produced when protons of 400 GeV hit a nuclear target and found a bump near 9.5 GeV.:cite[herb1977]

:::history{year=1977 title="A bump at 9.5 GeV, and the bottom quark" people="Leon Lederman, Steve Herb and the E288 collaboration" source="Sources: Herb et al. (1977); Fermilab History and Archives."}
The experiment, E288 at Fermilab, recorded about 7,000 muon pairs with masses above 4 GeV in a month of running in the spring of 1977, and in them a bump near 9.5 GeV with some 800 events and almost no background (the same-charge pairs, which cannot come from a particle decay, served as a measure of the background).:cite[fnal-e288] They called it the **Υ** (upsilon). It was the bound state of a fifth quark, the **bottom** or **beauty** quark, and its antiquark. Better resolution later separated the bump into three peaks, Υ(1S), Υ(2S) and Υ(3S) at 9.46, 10.02 and 10.36 GeV, which are the three in Figure 24.1. As with charm, all three lie below the threshold for a pair of B mesons (2 × 5.279 = 10.559 GeV), so all three are narrow, 20 to 54 keV.:cite[herb1977]
:::

## Three generations and the CKM matrix

With six quarks, the rotation of Cabibbo's angle becomes a $3\times3$ matrix, the **Cabibbo–Kobayashi–Maskawa matrix**, $V$, whose elements say how strongly the W couples each up-type quark to each down-type one. The coupling for $u\to d$ is proportional to $V_{ud}$, for $c\to b$ to $V_{cb}$, and so on.

Two Japanese physicists, Makoto Kobayashi and Toshihide Maskawa, published the next step in 1973, when only three quarks were known to exist. They asked what a matrix of that kind looks like for $N$ generations, and found that for $N = 3$ but not for $N = 2$ it contains a **complex phase** that cannot be removed.:cite[km1973]

:::deeper[Counting the parameters of a mixing matrix]
An $N\times N$ unitary matrix has $N^2$ real parameters. Not all of them are physical, because the phases of the $2N$ quark fields can be redefined freely, and a common phase does nothing, which removes $2N-1$ of them: $(N-1)^2$ remain. Of those, $N(N-1)/2$ are the angles of rotations (the number of independent rotations in $N$ dimensions) and the rest, $(N-1)(N-2)/2$, are phases. For $N = 2$ there is one angle and no phase: the Cabibbo angle, and a real matrix. For $N = 3$ there are three angles and **one phase**. A complex matrix gives different amplitudes for a process and for the process with every particle replaced by its antiparticle. That is CP violation, and the mixing matrix of three generations has room for it, with no new ingredient.
:::

Kobayashi and Maskawa had predicted a third generation, and the phase that goes with it, before the charm quark was found. The tau (1975) and the bottom quark (1977) were the first two members. The top quark, which completes the picture, was found in 1995 (Chapter 25). Kobayashi and Maskawa shared the 2008 Nobel Prize in Physics.:cite[nobel2008]

:::history{year=1973 title="Six quarks, predicted when three were known" people="Makoto Kobayashi, Toshihide Maskawa" source="Sources: Kobayashi and Maskawa (1973); Nobel Foundation (2008)."}
Kobayashi and Maskawa were at Kyoto University. Their paper, published in the *Progress of Theoretical Physics*, is titled "CP-violation in the renormalizable theory of weak interaction". It asked whether the Standard Model of Glashow, Weinberg and Salam could accommodate the CP violation seen in the kaon in 1964 (below), and answered that it could, if there were at least six quarks, which then looked like an unmotivated extravagance.:cite[km1973] The matrix is now called by their names together with Cabibbo's.
:::

The elements of the matrix are measured. They are hierarchical: the largest are on the diagonal, and each step away from it costs about a factor of five or twenty. A convenient parametrisation by Lincoln Wolfenstein expands them in powers of one small number, $\lambda = \sin\theta_C \approx 0.225$:

:::equation{#wolfenstein caption="The CKM matrix in the Wolfenstein parametrisation, to third order in λ. Rows: u, c, t. Columns: d, s, b."}
$$V \;\approx\; \begin{pmatrix} 1-\tfrac12\term{lam}{\lambda}^2 & \lambda & \term{A}{A}\lambda^3(\term{rho}{\rho}-i\,\term{eta}{\eta}) \\ -\lambda & 1-\tfrac12\lambda^2 & A\lambda^2 \\ A\lambda^3(1-\rho-i\eta) & -A\lambda^2 & 1\end{pmatrix}$$

```terms
lam:
  label: 'λ = sin θ_C'
  what: The Cabibbo angle's sine, about 0.225. The one small parameter in which the whole matrix is expanded.
  why: It sets the strength of the mixing between neighbouring generations. Each step up the hierarchy of generations costs one factor of λ.
  effect: '|V_us| = λ is 0.225, |V_cb| = Aλ² is 0.042, |V_ub| ≈ Aλ³ √(ρ²+η²) is 0.0037.'
A:
  label: 'A, of order 1'
  what: A number near 0.83 that scales the second and third generations' mixing, |V_cb| = Aλ².
  why: The b quark lives longer than a naive count of phase space suggests because |V_cb| is as small as 0.042, the square of λ times about 0.8.
  effect: A larger A means a shorter B lifetime.
rho:
  label: 'ρ, the real part of the corner'
  what: With η, it locates the apex of the unitarity triangle. In the text, ρ̄ ≈ 0.16 is the version corrected at the next order in λ.
  why: It sets the size of the smallest elements, V_ub and V_td, which govern b → u transitions and B⁰ oscillations.
  effect: Shifts the apex of the triangle sideways.
eta:
  label: 'η, the imaginary part of the corner'
  what: The size of the complex phase that cannot be removed. η̄ ≈ 0.35.
  why: It is the only source of CP violation in the quark sector of the Standard Model. If η were 0, the matrix would be real and the weak force would treat quarks and antiquarks alike.
  effect: The Jarlskog invariant J, a measure of the total amount of CP violation, is proportional to η and is 3 × 10⁻⁵ for η̄ = 0.35.
```
:::

The four numbers $(\lambda, A, \bar\rho, \bar\eta)$ determine all nine elements. Rounded from the Particle Data Group's global fit they are $\lambda\approx0.225$, $A\approx0.83$, $\bar\rho\approx0.16$ and $\bar\eta\approx0.35$.:cite[pdg2024,wolfenstein1983] The course's `hep/sm` module builds the matrix from them, exactly unitary.

::ckm-matrix{n="24.2" caption="The nine magnitudes |V_ij| from the four Wolfenstein parameters (the defaults are the PDG's global-fit values), shaded by log |V|². The hierarchy is a staircase: λ at one step, λ² at two, λ³ at three. Move λ and watch the whole pattern change. Rows and columns always square and sum to 1: that is what unitarity means. Set η̄ to zero and the Jarlskog invariant J vanishes: a real matrix cannot distinguish matter from antimatter."}

## The unitarity triangle

Unitarity of $V$ is a set of equations, and the interesting ones relate columns of the matrix. Multiply the first column of $V$ by the complex conjugate of the third, element by element, and add:

:::equation{#triangle caption="One of the orthogonality relations of the CKM matrix. Three complex numbers that add to zero form a triangle."}
$$\term{Vud}{V_{ud}V_{ub}^*} + \term{Vcd}{V_{cd}V_{cb}^*} + \term{Vtd}{V_{td}V_{tb}^*} = 0$$

```terms
Vud:
  label: 'V_ud V_ub*'
  what: A complex number built from two matrix elements, with the second conjugated. Its size is about 0.0035.
  why: Each term of the sum is the amplitude of a path from a down quark to a bottom quark through one of the three up-type quarks. Unitarity says the three paths cancel.
  effect: Its length is the side of the triangle from the origin to the apex.
Vcd:
  label: 'V_cd V_cb*'
  what: The middle term, real to a very good approximation, with size 0.0094. It is chosen as the base of the triangle.
  why: It is the best-measured side, and dividing the whole relation by it makes the base the segment from 0 to 1.
  effect: After the division the apex sits at (ρ̄, η̄).
Vtd:
  label: 'V_td V_tb*'
  what: The third term, of size about 0.0086.
  why: |
    It involves the top quark, which has never been produced in a B meson decay: it comes in through loops, as in the oscillation of B⁰ into its antiparticle.
  effect: Its length is the side of the triangle from the apex to the point (1, 0).
```
:::

The three terms are of similar size, which is why the triangle is a good one for experiments: no side is much shorter than the others, and every angle is large. Divide by the middle term, and the triangle has its base from (0, 0) to (1, 0) and its apex at $(\bar\rho,\bar\eta)$. The triangle has an area exactly proportional to the Jarlskog invariant, $J = |V_{cd}V_{cb}|^2\bar\eta$, which is $3\times10^{-5}$.

Each measurement constrains the apex. A rate of $b\to u$ decays against $b\to c$ decays measures $|V_{ub}/V_{cb}|$, which is the length of the side from the origin. The oscillation frequencies of the neutral $B$ mesons measure $|V_{td}|$ and thus the side from the other end. The time-dependent CP asymmetry of the decay $B^0\to J/\psi K_S^0$ measures the angle $\beta$; interference effects in $B\to DK$ decays measure $\gamma$. They are different measurements, with different theoretical inputs and different experimental systematics. If the CKM matrix is the whole story, they all describe the same triangle.

::unitarity-triangle{n="24.3" caption="Building the triangle from measurements. Two sides, from the b → u rate and the B oscillation frequency, fix the apex as the intersection of two circles. The angles β and γ are independent measurements and give two straight lines, which must pass through the same point. The sliders are set to the central values of the PDG global fit, so they agree by construction; move one and see how a disagreement would look. The bands, if you switch them on, are schematic and not the published uncertainties. Set the sides so that the apex falls to the axis: the triangle is flat, and CP violation vanishes."}

The angle $\beta$ is the cleanest. The measured value, $\sin2\beta\approx0.7$, makes $\beta = 22.5°$ and that line passes where the other measurements say the apex is. That constraints of such different origin overlap at one point is one of the most stringent tests of the Standard Model's flavour structure. The groups that combine the measurements, CKMfitter and UTfit, publish the current state of it.

## CP violation

The conservation law at stake is the one that Chapter 22 marked as surviving. **C**, charge conjugation, replaces every particle with its antiparticle. **P** is the mirror reflection. The weak force violates each, but the combination CP, a reflection that also swaps matter and antimatter, looked like an exact symmetry of the weak force in 1957: a left-handed neutrino turns under CP into a right-handed antineutrino, and both exist.

```predict
q: 'The neutral kaon has two long-lived-looking states: the K_S (lifetime 90 ps), which decays to two pions, and the K_L (lifetime 51 ns), which if CP is conserved can only decay to three. A beam of neutral kaons is produced at a target and examined 17 metres away. A few decays to exactly two pions are seen there. What do they show?'
options:
  - text: 'Nothing unusual: they are K_S that happened to survive the 17 metres.'
    why: 'A K_S of a few GeV/c flies about 10 cm on average. The chance to survive 17 metres is about e⁻¹⁶⁰, which is 10⁻⁷⁰: it does not happen. Do the arithmetic with the widget below.'
  - text: The K_L itself decays to two pions at a small rate, so CP is violated.
    correct: true
    why: 'By 17 m the K_S component has decayed, and what remains is the K_L. If CP were conserved, the K_L could decay only to the CP-odd three-pion state and never to the CP-even two-pion state. Seeing two pions means that the K_L is not exactly a CP eigenstate or that its decay breaks CP: either way CP is violated. This is what Cronin and Fitch found in 1964.'
  - text: The kaon changed into a different particle on the way.
    why: 'Nothing in the beam line changes a K_L into something else. Strangeness is changed only by the weak force, and that is exactly what makes the K_S and K_L mixtures of K⁰ and its antiparticle; but that is a property of the state, not a change on the way.'
```

::kaon-survival{n="24.4" caption="The fraction of K_S and K_L surviving along a beam line, from the lifetimes in the particle table, at the momentum you choose. At 2 GeV/c a K_S has a mean flight of about 11 cm, and none of them has survived to the 57 feet, 17.4 m, of the Cronin–Fitch beam (the fraction is 10⁻⁷⁰); about three quarters of the K_L have."}

:::history{year=1964 title="Two pions that should not have been there" people="James Cronin, Val Fitch, James Christenson, René Turlay" source="Sources: Christenson et al. (1964); Nobel Foundation (1980)."}
The neutral kaon $K^0$ ($d\bar s$) and its antiparticle $\bar K^0$ ($s\bar d$) can turn into each other through the weak force, so the particles with definite lifetimes are mixtures: the short-lived $K_S$ and the long-lived $K_L$. If CP were conserved, the $K_S$ would be the CP-even mixture, free to decay to two pions (CP-even), and the $K_L$ the CP-odd mixture, which can decay only to three (CP-odd), and the three-pion decay has little energy to spare, hence the long lifetime.

At the Alternating Gradient Synchrotron at Brookhaven, Christenson, Cronin, Fitch and Turlay used a beam of neutral kaons that had flown some 57 feet down a collimator, long enough for all the $K_S$ to decay, and looked for $K_L$ decays into exactly two pions in a helium-filled spectrometer. They found an excess of $45 \pm 9$ events pointing straight back along the beam, a fraction $(2.0\pm0.4)\times10^{-3}$ of the charged $K_L$ decays.:cite[christenson1964] Cronin and Fitch received the Nobel Prize in Physics in 1980.:cite[nobel1980]
:::

The effect is small: the CP-violating admixture in the $K_L$ is $|\varepsilon| = 2.2\times10^{-3}$.:cite[pdg2024] A second kind of CP violation, in the decay itself rather than the mixing, took thirty-five years to establish: in 1999 the NA48 experiment at CERN and the KTeV experiment at Fermilab found a small difference between the rates of the two-pion decays of the $K_L$ and the $K_S$, $\mathrm{Re}(\varepsilon'/\varepsilon) = (1.66\pm0.23)\times10^{-3}$ in today's average.:cite[fanti1999,alavi1999,pdg2024] The CKM mechanism has room for both. But the kaon's CP violation is small and hard to calculate, because the strong force binds the quarks together, and that was the reason to look at heavier hadrons, where the effects are expected to be large and calculable.

## B mesons

A $B^0$ meson ($b\bar d$) is the heavy analogue of the kaon: it too turns into its antiparticle. The effect, discovered by the ARGUS experiment at the DORIS electron–positron collider in Hamburg in 1987, was larger than expected, which meant that the top quark in the loop that causes it must be much heavier than most physicists had assumed.:cite[albrecht1987] Chapter 25 comes back to that. The frequency of the oscillation is about 0.5 per picosecond, so that in the 1.5 ps of a $B^0$'s life a sizeable fraction oscillate.:cite[pdg2024]

The CKM mechanism predicts that CP violation should be **large** in some B decays, of order one and not one part in a thousand. The cleanest is $B^0\to J/\psi K_S^0$, which a $B^0$ and a $\bar B^0$ can both reach, directly or after oscillating. The two paths interfere, with a phase $2\beta$, and the rate of decay as a function of time, for a meson that was a $B^0$ at production, differs from that of one that was a $\bar B^0$ by an amount $\sin2\beta\,\sin(\Delta m\,t)$. To measure that one needs to know both which it was at production and how long it lived.

That is what the **B factories** were built for.

:::history{year=2001 title="Two B factories, two measurements, one phase" people="The BaBar and Belle collaborations" source="Sources: Aubert et al. (2001); Abe et al. (2001); Nobel Foundation (2008)."}
Two electron–positron colliders were built to make B mesons in pairs by tuning the collision energy to the $\Upsilon(4S)$, a state at 10.58 GeV that decays to $B^0\bar B^0$ or $B^+B^-$ and nothing else. **PEP-II** at SLAC, where the **BaBar** detector (named for the B and B-bar mesons) stood, collided electrons of 9.0 GeV with positrons of 3.1 GeV. **KEKB** at KEK in Tsukuba, Japan, where **Belle** stood, collided 8.0 GeV electrons with 3.5 GeV positrons. The beams were deliberately unequal, so that the $\Upsilon(4S)$ would not be at rest in the laboratory, and moved with $\beta\gamma = 0.56$ at PEP-II and 0.425 at KEKB.

The reason is one of geometry. At the $\Upsilon(4S)$ the B mesons have only 0.34 GeV/c of momentum, and fly 30 µm before they decay: far less than a detector can resolve. With the boost, both mesons travel on average a quarter of a millimetre along the beam and their decay vertices, separated by an average of about 250 µm at PEP-II, reveal the time between the two decays. In the summer of 2001 both collaborations reported the CP asymmetry: BaBar $\sin2\beta = 0.59\pm0.14\pm0.05$, Belle $0.99\pm0.14\pm0.06$ (statistical, then systematic uncertainty), back to back in *Physical Review Letters*, and the effect was established in the B system.:cite[babar2001,belle2001,babarbelle2014] Kobayashi and Maskawa's Nobel Prize in 2008 recognised this as the confirmation of their idea.:cite[nobel2008]
:::

```numeric
id: pepii-flight
title: How far the B mesons fly at PEP-II
prompt: 'At PEP-II the Υ(4S) moves with βγ = 0.56. A B⁰ at rest in the Υ(4S) frame (its momentum there is only 0.34 GeV/c) has a lifetime of 1.517 ps. What is the mean distance, in micrometres, that a B⁰ travels along the beam in the laboratory, to the accuracy of using βγ of the Υ(4S) for the B? (c = 299.8 µm/ps.)'
answer: 255
unit: µm
tolerance: 0.03
hints:
  - 'cτ = 299.8 µm/ps × 1.517 ps = 455 µm.'
  - 'Multiply by βγ = 0.56.'
explain: 'cτ = 454.8 µm, times 0.56 gives 255 µm. The same arithmetic at KEKB (βγ = 0.425) gives 193 µm. A B⁰ in the Υ(4S) frame has βγ of its own, 0.34/5.28 = 0.064, which adds or subtracts about 30 µm: the boost of the machine is what makes the two vertices separable, since without it the two mesons would be separated by about 30 µm.'
```

## Heavy flavour in a detector

Everything above rests on one practical fact: hadrons with a bottom or a charm quark live long enough to fly a measurable distance before decaying. A $B^0$ has a lifetime of 1.5 ps, which is $c\tau = 455$ µm. Why is it so long? The weak decay rate of a quark of mass $m$ follows the muon formula of Chapter 22, with the muon replaced by the quark and with the mixing between generations as a factor:

$$\Gamma_b \sim N\,\frac{G_F^2\,m_b^5}{192\pi^3}\,|V_{cb}|^2 .$$

The fifth power of the mass makes heavy quarks decay fast, and the factor $|V_{cb}|^2 = (0.042)^2 = 1.8\times10^{-3}$ makes this one decay slowly: it was the smallness of the mixing between the third and second generations that gave the b hadron a lifetime that experimenters could use.

```fermi
id: b-lifetime
title: The b lifetime from the muon formula
prompt: 'Scale the muon decay width Γ = G_F² m⁵/(192π³) to the b quark: replace m_μ by m_b = 4.18 GeV, multiply by |V_cb|² = 0.0018 and by N = 5 for the number of decay channels (counting the colours of the quark pairs), and ignore the suppression from the mass of the charm quark in the final state. What lifetime does this give? (G_F = 1.166 × 10⁻⁵ GeV⁻², ħ = 6.58 × 10⁻²⁵ GeV·s.)'
answer: 2.6e-12
unit: s
factor: 2
hints:
  - 'm_b⁵ = 4.18⁵ = 1,276 GeV⁵ and G_F² = 1.36 × 10⁻¹⁰ GeV⁻⁴.'
  - 'G_F² m_b⁵/(192π³) = 2.9 × 10⁻¹¹ GeV. Then multiply by 0.0018 and by 5.'
explain: 'Γ = 2.9 × 10⁻¹¹ × 1.8 × 10⁻³ × 5 = 2.6 × 10⁻¹³ GeV, so τ = 6.58 × 10⁻²⁵/2.6 × 10⁻¹³ = 2.5 × 10⁻¹² s: a few picoseconds, from nothing but the muon lifetime and one matrix element. The measured B lifetime is 1.5 ps. The estimate is crude (the phase space of the charm quark reduces the rate by about a half, QCD corrections and the choice of mass change it by factors of the same size) but it explains the scale: without the |V_cb|² of 0.0018 the lifetime would be a few times 10⁻¹⁵ s, and no detector could see the flight.'
```

A b hadron of 50 GeV, an ordinary one in a jet at the LHC, has $\beta\gamma = 50/5.28 = 9.5$ and flies on average 4.3 mm. A D⁺ of the same momentum flies 8 mm, since its lifetime is longer, 1.03 ps. A $\tau$ lepton flies 2.4 mm. A detector's silicon pixel layers can locate the point where a charged track crosses them to a few tens of micrometres. The decay of such a hadron is a **secondary vertex**, displaced from the **primary vertex** where the proton collision happened, and its charged decay products do not point back to the collision.

::displaced-vertex{n="24.5" caption="Left: cτ for each particle, from the lifetimes in the particle table: the b and c hadrons and the τ are tens to hundreds of micrometres (to be compared with the shaded region: three times the impact-parameter resolution of the course detector, about 20 µm at 10 GeV), the K_S and Λ are centimetres, and the pion, K_L and muon are effectively stable on the scale of a detector. Right: for the chosen particle and momentum, the exponential distribution of the flight distance and the fraction beyond three resolutions. A 50 GeV B⁰ flies 4.3 mm; its decay is almost always displaced."}

### The impact parameter

The geometry of the decay gives an observable for each charged track. A track from the primary vertex, extrapolated back, passes through it. A track from a displaced decay passes beside it, at a distance called the **impact parameter**, $d_0$: the distance of closest approach, in the plane transverse to the beam, between the track and the primary vertex. An impact parameter of 100 µm for a track that is measured to 20 µm is a five-sigma effect. So the useful quantity is the **significance**, $S = d_0/\sigma_{d_0}$, a standardised residual: the number of standard deviations by which the track misses the vertex. Tracks from the primary vertex have $S$ distributed with unit width about 0. Tracks from a decay have a tail.

The tail has a sign. A particle that decays at a distance $L$ along its flight direction sends its decay products out in roughly the same direction, and their closest approach to the primary vertex lies **ahead** of it, along the jet. Mis-measured prompt tracks are equally likely to miss on either side. So the impact parameter is signed by whether the point of closest approach lies ahead of the vertex along the jet axis, the **lifetime sign**: positive for tracks from a decay, symmetric about 0 for the rest.

:::programmer
A significance is a **z-score**: a measurement divided by its own estimated uncertainty, so that a threshold means the same thing for every track. Cutting on $d_0$ would be wrong in the way that a fixed threshold on any raw metric is: a well-measured track and a badly measured one have different noise. The lifetime sign is a **feature engineered from the physics** that breaks a symmetry between classes: the background is symmetric under reversing the sign, the signal is not, so the negative side of the distribution is a free, data-driven estimate of the background on the positive side. Real experiments use that: they calibrate the tagger's mistag rate on the negative tail.
:::

### Write it yourself

:::hood[The impact parameter in the library]
The reference `impactParameter` in `hep/reco` first asks `trackAtVertex` for the signed distance of the vertex from the track's circle and for its uncertainty (propagated from the track's covariance), then adds the uncertainty of the vertex itself and attaches the lifetime sign:

```ts
export function impactParameter(track: RecoTrack, vertex: { x: number; y: number; z: number; cov?: number[][] }, jet?: P4): ImpactParameter {
  const a = trackAtVertex(track, vertex.x, vertex.y, vertex.z);
  let d0 = -a.dxy;
  let s2 = a.sxy * a.sxy;
  if (vertex.cov) {
    const C = vertex.cov;
    s2 += a.nx * a.nx * C[0]![0]! + 2 * a.nx * a.ny * C[0]![1]! + a.ny * a.ny * C[1]![1]!;   // the vertex's own error, projected on the track's normal
  }
  if (jet) {
    // point of closest approach relative to the vertex, along the jet direction in the transverse plane
    const p = helixAt(trackHelix(track), a.s);
    const dot = (p.x - vertex.x) * jet.px + (p.y - vertex.y) * jet.py;
    d0 = Math.abs(d0) * (dot >= 0 ? 1 : -1);
  }
  const sigma = Math.sqrt(s2);
  return { d0, sigma, significance: d0 / sigma, /* … the longitudinal parts … */ };
}
```

Two details matter. The track's error is not simply σ(d0): the vertex position is itself uncertain, and the error is projected on the direction perpendicular to the track, $\hat n$, the gradient of the distance with respect to the vertex position. And the sign convention of the unsigned $d_0$ (positive when the vertex is to the right of the track's direction) is replaced, for a jet, by the lifetime sign, which has nothing to do with left and right.
:::

```code
id: impact-parameter
title: The impact parameter and its significance
hook: reco.impactParameter
prompt: |
  Implement `impactParameter(track, vertex, jet?)`. `trackAtVertex(track, x, y, z)` from `hep/reco` does the geometry: it returns `dxy` (the signed distance of the
  vertex from the track's circle, in the transverse plane), `dz`, their uncertainties `sxy` and `sz`, the unit normal `(nx, ny)` of the track at the nearest point (the gradient of
  `dxy` with respect to the vertex position) and the arc length `s` from the track's perigee to the nearest point.

  Return `{ d0, sigma, significance, dz, sigmaDz, significanceZ }`:

  - `d0 = −dxy` (millimetres);
  - `sigma` is the uncertainty of `d0`: the track's `sxy` and, if `vertex.cov` is given, the vertex's own covariance projected on the normal, added in quadrature (nᵀ C n, with C the 2 × 2 block of the covariance);
  - `significance = d0 / sigma`;
  - the same for the longitudinal distance (`dz`, `sz`, plus `C[2][2]` of the vertex), without any sign convention;
  - **with a jet**, the sign of `d0` is the *lifetime sign* instead: the magnitude is unchanged, and the sign is positive if the point of closest approach lies ahead of the vertex along the jet's direction in the transverse plane. The point of closest approach is `helixAt(trackHelix(track), s)`; take its displacement from the vertex and its dot product with `(jet.px, jet.py)`.
starter: |
  import type { P4 } from 'hep';
  import type { RecoTrack } from 'hep/reco';
  import { trackAtVertex, trackHelix, helixAt } from 'hep/reco';

  export function impactParameter(
    track: RecoTrack,
    vertex: { x: number; y: number; z: number; cov?: number[][] },
    jet?: P4,
  ) {
    return { d0: 0, sigma: 1, significance: 0, dz: 0, sigmaDz: 1, significanceZ: 0 };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { impactParameter } from 'solution';
  import { impactParameter as reference, curvatureFromPt } from 'hep/reco';
  import { rng } from 'hep/random';

  function mkTrack(pt, eta, phi, q, d0, z0) {
    const s = [0.02, 1e-3, 1e-6, 0.05, 1e-3];
    const cov = s.map((a, i) => s.map((b, j) => (i === j ? a * a : 0)));
    return {
      id: 0, charge: q, pt, eta, phi, d0, z0, chi2: 1, ndof: 5, hits: [], truth: -1,
      tanLambda: Math.sinh(eta), c: curvatureFromPt(pt, 3.8, q), d0Raw: d0, z0Raw: z0,
      sigmaD0: 0.02, sigmaZ0: 0.05, cov, nLayers: 8,
    };
  }
  const close = (a, b) => expect(a).toBeCloseTo(b, 6);

  test('a stiff track displaced by 0.2 mm: |d0| = 0.2 mm and a significance of about 10', () => {
    const t = mkTrack(100, 0.3, 0.0, 1, 0.2, 0.1);
    const r = impactParameter(t, { x: 0, y: 0, z: 0.1 });
    expect(Math.abs(r.d0)).toBeCloseTo(0.2, 2);
    expect(Math.abs(r.significance)).toBeGreaterThan(8);
    expect(Math.abs(r.significance)).toBeLessThan(12);
  });

  test('a track through the vertex has d0 = 0', () => {
    const t = mkTrack(30, -0.5, 1.2, -1, 0.0, 0.0);
    expect(Math.abs(impactParameter(t, { x: 0, y: 0, z: 0 }).d0)).toBeLessThan(1e-9);
  });

  test('agrees with the library on 60 random tracks and vertices', () => {
    const r = rng(5);
    for (let i = 0; i < 60; i++) {
      const t = mkTrack(1 + 60 * r(), 4 * r() - 2, 6 * r() - 3, r() < 0.5 ? 1 : -1, 0.4 * r() - 0.2, 2 * r() - 1);
      const v = { x: 0.1 * r() - 0.05, y: 0.1 * r() - 0.05, z: 2 * r() - 1 };
      const a = impactParameter(t, v), b = reference(t, v);
      for (const k of ['d0', 'sigma', 'significance', 'dz', 'sigmaDz', 'significanceZ']) close(a[k], b[k]);
    }
  });

  test('the vertex covariance widens sigma, along the normal of the track', () => {
    const r = rng(6);
    for (let i = 0; i < 30; i++) {
      const t = mkTrack(5 + 40 * r(), 2 * r() - 1, 6 * r() - 3, 1, 0.1 * r(), 0);
      const cov = [[0.0004, 0.0001, 0], [0.0001, 0.0009, 0], [0, 0, 0.01]];
      const v = { x: 0, y: 0, z: 0, cov };
      const a = impactParameter(t, v), b = reference(t, v), plain = impactParameter(t, { x: 0, y: 0, z: 0 });
      close(a.sigma, b.sigma);
      close(a.sigmaDz, b.sigmaDz);
      expect(a.sigma).toBeGreaterThan(plain.sigma);
    }
  });

  test('the lifetime sign: closest approach ahead of the vertex along the jet is positive, behind is negative', () => {
    // a track along +x at y = +0.2 mm: its closest approach to the origin is at y = +0.2
    const t = mkTrack(100, 0.0, 0.0, 1, 0.2, 0.0);
    const v = { x: 0, y: 0, z: 0 };
    const ahead = impactParameter(t, v, { E: 50, px: 0, py: 30, pz: 0 });
    const behind = impactParameter(t, v, { E: 50, px: 0, py: -30, pz: 0 });
    expect(ahead.d0).toBeGreaterThan(0);
    expect(behind.d0).toBeLessThan(0);
    expect(Math.abs(ahead.d0)).toBeCloseTo(Math.abs(behind.d0), 9);
  });

  test('with a jet, matches the library on random tracks (sign included)', () => {
    const r = rng(8);
    for (let i = 0; i < 60; i++) {
      const t = mkTrack(2 + 40 * r(), 2 * r() - 1, 6 * r() - 3, r() < 0.5 ? 1 : -1, 0.3 * r() - 0.15, 0);
      const ph = 6 * r() - 3;
      const jet = { E: 60, px: 40 * Math.cos(ph), py: 40 * Math.sin(ph), pz: 10 };
      const v = { x: 0, y: 0, z: 0 };
      close(impactParameter(t, v, jet).d0, reference(t, v, jet).d0);
      close(impactParameter(t, v, jet).significance, reference(t, v, jet).significance);
    }
  });
solution: |
  import type { P4 } from 'hep';
  import type { RecoTrack } from 'hep/reco';
  import { trackAtVertex, trackHelix, helixAt } from 'hep/reco';

  export function impactParameter(
    track: RecoTrack,
    vertex: { x: number; y: number; z: number; cov?: number[][] },
    jet?: P4,
  ) {
    const a = trackAtVertex(track, vertex.x, vertex.y, vertex.z);
    let d0 = -a.dxy;
    let s2 = a.sxy * a.sxy;
    let sz2 = a.sz * a.sz;
    if (vertex.cov) {
      const C = vertex.cov;
      // the vertex's own uncertainty, projected on the track's normal
      s2 += a.nx * a.nx * C[0][0] + 2 * a.nx * a.ny * C[0][1] + a.ny * a.ny * C[1][1];
      sz2 += C[2][2];
    }
    if (jet) {
      const p = helixAt(trackHelix(track), a.s);
      const dot = (p.x - vertex.x) * jet.px + (p.y - vertex.y) * jet.py;
      d0 = Math.abs(d0) * (dot >= 0 ? 1 : -1);
    }
    const sigma = Math.sqrt(s2);
    const sigmaDz = Math.sqrt(sz2);
    return { d0, sigma, significance: d0 / sigma, dz: a.dz, sigmaDz, significanceZ: a.dz / sigmaDz };
  }
hints:
  - 'trackAtVertex gives you dxy, dz, sxy, sz, the normal (nx, ny) and the arc length s. d0 is minus dxy.'
  - 'The vertex covariance enters as nᵀCn = nx²C00 + 2 nx ny C01 + ny² C11, added to sxy².'
  - 'For the lifetime sign you need the point on the helix at arc length s: helixAt(trackHelix(track), s) gives { x, y, z, phi }.'
```

### A b-tagger

With a significance for every track, tagging a jet is a classification problem. A jet from a b quark has several tracks with large positive significance, because the $B$ decays to several charged particles and the cascade $B\to D\to$ hadrons adds more. A jet from a light quark has almost none. The simplest discriminant is the **second-largest** significance in the jet: one displaced track could be a fluke, a mis-measured prompt track or a decay of a long-lived strange particle, but two is not.

::btag-lab{n="24.6" caption="Simulated light, charm and bottom jets (30–80 GeV) through the course's detector simulation and reconstruction (the heavy hadron's lifetime and flight are realistic, the fragmentation around it is schematic). Plot the reference tagger's score, or the second-largest or largest lifetime-signed impact-parameter significance in the jet, and move the cut: the table gives the fraction of each flavour that passes. The curve is the efficiency for b jets against the mistag rate for light jets as the cut moves. With the two exercises of this chapter solved, a button re-runs 150 jets of each flavour with your impact-parameter and b-tag functions."}

The efficiency for tagging b jets, $\varepsilon_b$, and the **mistag rate**, the fraction of light jets that pass, $\varepsilon_\text{light}$, trade against each other along the curve, which is the receiver operating characteristic of the tagger. In the figure a cut of 3 on the second-largest significance keeps about 75 % of the b jets and 0.5 % of the light jets, at which the tagger has a **rejection** of light jets of 200. Charm jets pass about a fifth of the time: a D meson also flies, though less far.

:::programmer
The numbers in the table are the entries of a **confusion matrix** read off at a threshold. A b-jet efficiency is a true-positive rate, a mistag rate is a false-positive rate, and the curve is the usual ROC. What makes the problem different from most classifiers is the **class prior**: b jets are about one in a hundred of the jets in a typical collision. A tagger that keeps 75 % of b jets and 0.5 % of light jets sounds excellent, but with a prior of 1:100, the jets it keeps are made of 0.75 b-jets against 0.5 light-jets: a purity of only 60 %. That is why the working point is chosen from the analysis in which the tagger is used, with the prior in the calculation. The threshold is a design parameter, not a property of the tagger.
:::

```code
id: btag
title: A b-tagger
hook: reco.bTag
prompt: |
  Implement `bTag(jet, tracks, vertices)`, which returns a score between 0 and 1: near 1 for a jet that probably contains a b hadron, near 0 for one that does not.

  `jet` is the jet's four-vector. `tracks` is the event's list of reconstructed tracks (`RecoTrack`: `pt`, `eta`, `phi`, `chi2`, `ndof`, …) and `vertices` its vertices; the one with `kind === 'primary'` is the primary vertex.

  A good recipe: use the tracks within ΔR < 0.4 of the jet axis with `pt > 1`, `chi2/ndof < 5`, and for which both `|d0| < 2 mm` and `|dz| < 5 mm` with respect to the primary vertex; compute each one's lifetime-signed significance with `impactParameter(track, pv, jet)` from `hep/reco`; take the **second-largest** significance S₂ (or 0 if there are fewer than two such tracks), and return a smooth increasing function of it: for example `1 / (1 + exp(−(S₂ − 3)))`. A cut at 0.5 is then a cut at S₂ = 3. A jet with no usable tracks must score low.

  Your function replaces the library's tagger in the reconstruction when you use it ("use my code"), so every jet of every simulated event is scored by it.
starter: |
  import type { P4 } from 'hep';
  import type { RecoTrack, RecoVertex } from 'hep/reco';
  import { impactParameter } from 'hep/reco';

  export function bTag(jet: P4, tracks: RecoTrack[], vertices: RecoVertex[]): number {
    return 0.5;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { bTag } from 'solution';
  import { presets, simulate } from 'hep/detector';
  import { reconstruct, synthetic } from 'hep/reco';
  import { rng } from 'hep/random';
  import { fromPtEtaPhiM, deltaR } from 'hep/kinematics';

  function makeJets(flavour, n, seed) {
    const r = rng(seed);
    const cfg = presets.onion;
    const out = [];
    for (let i = 0; i < n; i++) {
      const pt = 30 + 50 * r(), eta = (2 * r() - 1) * 1.5, phi = (2 * r() - 1) * Math.PI;
      const truth = synthetic.truthEventFrom(synthetic.jetParticles(r, flavour, pt, eta, phi), [0, 0, 0]);
      const det = simulate(truth, cfg, r.fork('s' + i));
      const reco = reconstruct(det, cfg, {}, truth);
      const axis = fromPtEtaPhiM(pt, eta, phi, 5);
      const jet = reco.objects.filter((o) => o.kind === 'jet').sort((a, b) => deltaR(a.p, axis) - deltaR(b.p, axis))[0];
      if (jet && deltaR(jet.p, axis) < 0.4) out.push({ jet: jet.p, tracks: reco.tracks, vertices: reco.vertices });
    }
    return out;
  }
  const B = makeJets('b', 50, 11);
  const L = makeJets('light', 50, 12);
  const scoreOf = (j) => bTag(j.jet, j.tracks, j.vertices);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  test('every score is a number between 0 and 1', () => {
    for (const j of [...B, ...L]) {
      const s = scoreOf(j);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  test('a jet with no tracks scores low', () => {
    expect(bTag({ E: 50, px: 40, py: 20, pz: 5 }, [], [{ kind: 'primary', x: 0, y: 0, z: 0, tracks: [], chi2: 0, cov: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], ndof: 0, sumPt2: 0 }])).toBeLessThan(0.2);
  });

  test('b jets score higher than light jets, on average by at least 0.4', () => {
    expect(mean(B.map(scoreOf)) - mean(L.map(scoreOf))).toBeGreaterThan(0.4);
  });

  test('at a cut of 0.5, at least half of the b jets pass and at most one light jet in ten', () => {
    const eb = B.filter((j) => scoreOf(j) > 0.5).length / B.length;
    const el = L.filter((j) => scoreOf(j) > 0.5).length / L.length;
    expect(eb).toBeGreaterThan(0.5);
    expect(el).toBeLessThan(0.1);
  });

  test('the ranking is useful: a random b jet beats a random light jet in 90 % of pairs', () => {
    const sb = B.map(scoreOf), sl = L.map(scoreOf);
    let win = 0, tie = 0;
    for (const a of sb) for (const b of sl) { if (a > b) win++; else if (a === b) tie++; }
    expect((win + 0.5 * tie) / (sb.length * sl.length)).toBeGreaterThan(0.9);
  });
solution: |
  import type { P4 } from 'hep';
  import type { RecoTrack, RecoVertex } from 'hep/reco';
  import { impactParameter } from 'hep/reco';

  export function bTag(jet: P4, tracks: RecoTrack[], vertices: RecoVertex[]): number {
    const pv = vertices.find((v) => v.kind === 'primary') ?? { x: 0, y: 0, z: 0 };
    const jpt = Math.hypot(jet.px, jet.py);
    const jeta = Math.asinh(jet.pz / jpt);
    const jphi = Math.atan2(jet.py, jet.px);
    const sig: number[] = [];
    for (const t of tracks) {
      if (t.pt < 1 || t.chi2 / Math.max(1, t.ndof) > 5) continue;
      let dphi = t.phi - jphi;
      while (dphi > Math.PI) dphi -= 2 * Math.PI;
      while (dphi <= -Math.PI) dphi += 2 * Math.PI;
      if (Math.hypot(t.eta - jeta, dphi) > 0.4) continue;
      const ip = impactParameter(t, pv, jet);
      if (Math.abs(ip.d0) > 2 || Math.abs(ip.dz) > 5) continue;
      sig.push(ip.significance);
    }
    sig.sort((a, b) => b - a);
    const s2 = sig.length >= 2 ? sig[1] : 0;
    return 1 / (1 + Math.exp(-(s2 - 3)));
  }
hints:
  - 'Select the tracks first (ΔR < 0.4 of the jet, pt, χ²/ndof, |d0| and |dz|), then compute the signed significance of each with impactParameter(track, pv, jet).'
  - 'The second-largest value after sorting in decreasing order is sig[1]. Use 0 if there are fewer than two tracks.'
  - 'The logistic function 1/(1 + exp(−(S₂ − 3))) maps S₂ = 3 to a score of 0.5. Make sure that a jet with no tracks does not return 0.5.'
```

## What the ledger loses, again

CP goes in the ledger as a symmetry the weak force violates, slightly. It was the last of the discrete symmetries of the mirror and of the exchange of matter and antimatter that looked safe. The combination of all three, **CPT**, with time reversed, holds in every quantum field theory of this kind, and has been tested to extreme precision.

::ledger-strike{stage="24" n="24.7" caption="The ledger after Chapter 24: CP is struck through in the weak column, with a note that the violation is small. What remains exact is energy, momentum, charge, colour and CPT, and so far baryon number and the three lepton numbers; Chapter 31 strikes through the last of these."}

CP violation is one of the three conditions that the physicist Andrei Sakharov listed in 1967 for a universe to start with equal amounts of matter and antimatter and end with only matter (Chapter 32). It is necessary. The amount in the CKM matrix, $J = 3\times10^{-5}$, is too small by many orders of magnitude to do the job. Either there is a further source of CP violation in the lepton sector (Chapter 31) or elsewhere, or the explanation is of a quite different kind.

## LHCb and the search for the unexpected

Where does the field go next? The heavy-flavour measurements are indirect searches. Virtual particles of any mass can appear in the loops of rare decays and of mixing, so a precise measurement tests the existence of new particles at scales beyond the reach of any collider. That was the history of charm (the loops of the $K_L$ mass difference gave its mass), and of the top (the $B^0$ oscillation of 1987).

The **LHCb** experiment was built to do this at the LHC. It is a **forward spectrometer**: not a barrel surrounding the collision point like ATLAS and CMS (Chapter 7) but a single arm covering the angles close to the beam, from pseudorapidity 2 to 5, where the pairs of b quarks produced in proton collisions are concentrated and fly in the same direction.:cite[lhcb2008] A silicon detector, the Vertex Locator, comes within a few millimetres of the beam to resolve the displaced vertices of b and c hadrons, and the flight of $B$ mesons is measured in each decay.

Among its results: the first observation, with CMS, of the extremely rare decay $B_s^0\to\mu^+\mu^-$, with a branching fraction of $(2.8^{+0.7}_{-0.6})\times10^{-9}$ in 2015, which proceeds only through loops and constrains many models of new physics at once;:cite[bsmumu2015] precise measurements of the angle $\gamma$; and, in 2019, the first observation of CP violation in the decays of charm hadrons, at the level of about 0.15 %.:cite[lhcb2019]

:::experiments
**LHCb** is one of the four large experiments of the LHC (Chapter 0), built for b and c hadrons; **Belle II** at the SuperKEKB collider in Japan, which began taking data in 2019 at a much higher luminosity than its predecessor, is the successor of Belle and works at the $\Upsilon(4S)$ like the B factories of 2001. In **ATLAS** and **CMS** the tagging of b jets is also essential: the top quark decays to a W and a b quark, so every top-quark analysis (Chapter 25) and the search for the Higgs boson decaying to a pair of b quarks (Chapter 30) depend on it. The taggers of those experiments are no longer a cut on one significance: they are neural networks, **CMS's DeepJet** and **ATLAS's DL1 family**, trained on simulated jets with, as inputs, the same ingredients as the exercise (the impact parameters of tracks, secondary-vertex properties) and many more, and they are calibrated on data, using the negative tail of the lifetime-signed significance as in the programmer's box above. The course's own tagger has a logistic function of eight such features, its weights fitted on simulated jets in the course detector; against 74 % of b jets it keeps 0.3 % of light ones.
:::

## What comes next

All six quarks are now in place except one, and it is the one whose mass breaks the pattern of the other five: the top quark, 40 times heavier than the b. Chapter 25 reconstructs it in the collisions of the LHC with the pipeline built so far, including the b-tagger of this chapter, and explains why the quark that is so heavy cannot make hadrons at all.

## Further reading

- Cabibbo's paper, and Kobayashi and Maskawa's (:cite[cabibbo1963,km1973]).
- Glashow, Iliopoulos and Maiani (:cite[gim1970]).
- The discovery papers of the J/ψ (:cite[aubert1974,augustin1974]) and the first B-factory measurements of CP violation (:cite[babar2001,belle2001]).
- The Particle Data Group's reviews of the CKM matrix and of CP violation (:cite[pdg2024]); the CKM fit groups publish the current unitarity triangle.
