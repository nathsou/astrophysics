---
number: 23
title: W and Z
summary: Fermi's contact interaction is the low-energy shadow of three heavy particles. A single angle ties the weak force to electromagnetism and predicts their masses. They were found in 1983 by looking for what was missing, and a decade later a scan of the Z at LEP showed that there are three kinds of light neutrino.
duration: About 3 hours
prerequisites: [the-weak-force, qed, symmetry-and-gauge, colliding-beams]
---

Go back to the muon pairs of Chapter 2. With the peaks that Chapter 13 explained marked, the one that stands highest above the continuum is still unnamed. It sits at 91 GeV.

::dimuon-map{reveal="rho,phi,z" n="23.1" caption="The invariant mass of 100,000 real muon pairs from CMS, as in Chapter 2. The ρ, ω and φ were named in Chapter 13. The narrow peak at 91 GeV is the Z boson, produced when a quark and an antiquark from the two protons annihilate into it, and decaying to two muons. Its width here is the Z's natural width of 2.5 GeV combined with the detector's resolution. The J/ψ, ψ(2S) and Υ peaks near 3 and 10 GeV are still unmarked: Chapter 24 names them."}

A Z boson is 97 times as heavy as a proton and lives for $2.6\times10^{-25}$ s. It is one of the three carriers of the weak force. This chapter is about why they must exist, how their masses were predicted before anyone had seen one, how they were found in 1983 by looking for what was *missing* from a collision, and how, six years later, a scan across the Z at the LEP collider counted the neutrinos of the universe.

## A heavy messenger

Chapter 22 ended with Fermi's constant $G_F = 1.166\times10^{-5}$ GeV⁻² and the observation that it sets an energy scale, $G_F^{-1/2} = 293$ GeV. A force that acts at a point at low energy, and cannot do so at 300 GeV, is a force with a **carrier** that is heavy. Chapter 14 gave the rule: a force carried by a particle of mass $m$ has a range of $\hbar c/mc^2$. The weak force is weak because its range is short, and short because its carriers are heavy.

If the carrier of the charged weak current is a particle $W$ of mass $m_W$ coupled to each fermion with strength $g$, then two currents interacting at low energy exchange it, and the exchange adds a propagator $1/(q^2 - m_W^2)$ to the amplitude (Chapter 14). For momentum transfer much smaller than $m_W$ this is the constant $-1/m_W^2$: a contact interaction, with

$$\frac{G_F}{\sqrt2} = \frac{g^2}{8\,m_W^2}.$$

That is Fermi's theory, derived as an approximation. For a coupling $g$ of about the strength of electromagnetism's, and $G_F^{-1/2} = 293$ GeV, the mass comes out near 80 GeV. The range of such a force is $\hbar c/m_W = 0.1973\ \text{GeV·fm}/80.4\ \text{GeV} = 2.5\times10^{-3}$ fm, or $2.5\times10^{-18}$ m, several hundred times smaller than a proton. The weak interaction is not feeble in itself; at distances comparable to its range it is about as strong as electromagnetism. It looks feeble at the distances of ordinary decays because the amplitude is suppressed by $(E/m_W)^2$ and the rate by the fourth power of that.

The charged carriers are two particles, $W^+$ and $W^-$. They are what turns a down-type quark into an up-type one and a charged lepton into its neutrino.

## One theory for two forces

A neutral carrier is needed too, for a reason that comes from the structure of the theory and not from any experiment. Chapter 17 built the electromagnetic force from a local phase symmetry, U(1), and said that the weak force has the structure of SU(2), the symmetry of rotations of a two-component object. In SU(2) there are three carriers, not two: $W^1$, $W^2$ and $W^3$, of which the first two combine into the charged $W^\pm$. The third is neutral.

In 1961 Sheldon Glashow noticed that the neutral carrier of SU(2) could not be the photon: the photon couples to left-handed and right-handed electrons alike, and the SU(2) carriers couple only to left-handed ones (Chapter 22). The way out is a second symmetry, U(1)$_Y$, with its own carrier $B$ and its own coupling $g'$, and a **mixture**. The two neutral fields $W^3$ and $B$ rotate into the photon and a heavy neutral partner:

$$\gamma = \sin\theta_W\,W^3 + \cos\theta_W\,B, \qquad Z = \cos\theta_W\,W^3 - \sin\theta_W\,B.$$

The rotation angle $\theta_W$ is the **weak mixing angle**. The photon is the combination that stays massless (Chapter 26 explains how the other three become massive), and its coupling to electric charge is $e = g\sin\theta_W = g'\cos\theta_W$. There were three couplings, $e$, $g$ and $g'$. There are now two independent numbers, $g$ and the angle.

:::history{year=1961 title="Three people, one theory, three papers" people="Sheldon Glashow, Steven Weinberg, Abdus Salam" source="Sources: Glashow (1961); Weinberg (1967); Salam (1968); Nobel Foundation (1979)."}
In 1961 Sheldon Glashow wrote down the group SU(2) × U(1) for the weak and electromagnetic forces together and the mixing of the two neutral carriers, but could not give the carriers masses without spoiling the theory.:cite[glashow1961] In 1967 Steven Weinberg, and in 1968 Abdus Salam, independently supplied the missing step, the spontaneous breaking of the symmetry by the Higgs mechanism of Chapter 26, in a model of the leptons.:cite[weinberg1967,salam1968] The three shared the 1979 Nobel Prize in Physics.:cite[nobel1979]

At first the papers drew little attention. The theory predicted a neutral weak current that had not been seen, and nobody could say whether it made sense as a quantum theory: its infinities might not be removable.
:::

:::history{year=1971 title="The infinities can be removed" people="Gerard 't Hooft, Martinus Veltman" source="Sources: 't Hooft (1971); 't Hooft and Veltman (1972); Nobel Foundation (1999)."}
In 1971 Gerard 't Hooft, a student of Martinus Veltman at Utrecht, showed that the infinities of the electroweak theory could be removed, as those of quantum electrodynamics can (Chapter 16).:cite[thooft1971] With Veltman's methods of regularising the calculations the theory was shown to be **renormalisable**,:cite[thooft1972] which means that it gives finite, unambiguous predictions at every order. From then on its predictions, the neutral current and the masses of the W and the Z, had to be taken seriously. They shared the 1999 Nobel Prize in Physics.:cite[nobel1999]
:::

The theory fixes the masses. With the Higgs mechanism of Chapter 26, the W and the Z get their masses in a fixed ratio set by the angle, and everything is tied to $G_F$ and the electromagnetic coupling $\alpha$.

:::equation{#ew-masses caption="The tree-level masses of the W and Z, from three measured numbers: Fermi's constant, the electromagnetic coupling and the weak mixing angle."}
$$\term{mW}{m_W} = \frac{\term{A}{A}}{\sin\term{theta}{\theta_W}}, \qquad \term{mZ}{m_Z} = \frac{A}{\sin\theta_W\cos\theta_W}, \qquad A = \left(\frac{\pi\,\term{alpha}{\alpha}}{\sqrt{2}\,\term{GF}{G_F}}\right)^{1/2}$$

```terms
mW:
  label: 'm_W, the W mass'
  what: 'The mass of the charged carriers, 80.37 GeV (measured).'
  why: 'It is the carrier''s mass that makes the weak force short-ranged, and, through G_F/√2 = g²/8m_W², what gives the weak interaction its strength at low energy.'
  effect: 'With sin²θ_W = 0.2312 the formula gives 77.5 GeV when α is taken at zero momentum transfer and 80.2 GeV when it is taken at the Z scale.'
mZ:
  label: 'm_Z, the Z mass'
  what: 'The mass of the neutral carrier, 91.19 GeV (measured).'
  why: 'It is heavier than the W by the factor 1/cos θ_W, because the Z is the mixture that is not the photon.'
  effect: 'Larger mixing angle, heavier Z relative to the W: m_W/m_Z = cos θ_W at tree level.'
A:
  label: 'A, a scale made of α and G_F'
  what: 'A = (πα/√2 G_F)^½, an energy of 37.3 GeV for α = 1/137.04.'
  why: 'It is the one combination of the two measured couplings that has the dimension of a mass. Every tree-level mass of the theory is A divided by a function of the angle.'
  effect: 'With α evaluated at the Z scale, 1/127.95, A grows to 38.6 GeV.'
theta:
  label: 'θ_W, the weak mixing angle'
  what: 'The angle by which the neutral fields W³ and B are rotated into the photon and the Z. sin²θ_W is about 0.231.'
  why: 'It is the one free number of the electroweak theory that has to be measured. Neutrino scattering, the asymmetries at LEP and the ratio of the W and Z masses all give it, and they must agree.'
  effect: 'Every neutral-current rate depends on it, and so do the W and Z masses.'
alpha:
  label: 'α, the electromagnetic coupling'
  what: '1/137.036 at zero momentum transfer, and larger at higher energy (Chapter 16): about 1/128 at the Z mass.'
  why: 'The theory''s coupling is the one that applies at the scale of the process, so the Z mass needs α at 91 GeV and not at zero.'
  effect: 'Using 1/137 instead of 1/128 lowers the predicted masses by 3 %.'
GF:
  label: 'G_F, Fermi’s constant'
  what: '1.1664 × 10⁻⁵ GeV⁻², from the muon lifetime (Chapter 22).'
  why: 'It is the measured strength of the weak force at low energy.'
  effect: 'Together with α it fixes the energy scale A.'
```
:::

::weak-mixing{n="23.2" caption="One angle, several predictions. Left: the tree-level masses of the W and the Z from α, G_F and sin²θ_W (the formulas above), against the measured ones. Choose α at the Z scale and set sin²θ_W near 0.231, the value that LEP's asymmetries give: both masses come out within 0.4 % of the measured ones, which is better than a tree-level formula deserves. Right: the ratio of neutral-current to charged-current events in neutrino and antineutrino scattering on an isoscalar target, from the quark-model formula, against the same angle. A few per cent in the angle moves the neutral-current rate by tens of per cent."}

The calculation is tree level, and radiative corrections of a few per cent apply. Most of the gap between 77.5 and 80.2 GeV in the first row of the figure is the running of $\alpha$ from 1/137 to 1/128. The rest of the corrections is smaller and partly cancels in the masses. That is a fortunate accident, not a feature of the method: precision tests of the theory (Chapter 25) are about the corrections that are left.

:::fermi[Where did the W have to be found?]
A proton–antiproton collision of total energy $\sqrt{s} = 540$ GeV, the energy of the first collider that could do it, makes a W when a quark from one proton and an antiquark from the other carry a product of momentum fractions $x_1x_2 = m_W^2/s = (80.4/540)^2 = 0.022$. At rest in the centre-of-mass frame, $x_1 = x_2 = 0.15$. Chapter 13 gave the distribution of partons. A valence quark with 15 % of the proton's momentum is common (the valence distributions peak between a tenth and a fifth of it), and in the course's parton distributions, at the scale of the W mass, an up quark at $x = 0.15$ is about ten times more probable than an up antiquark at the same $x$, which can only come from the sea. That is why the collider used antiprotons, which carry valence antiquarks, and not protons.
:::

## The neutral current

The theory made a prediction that no one had looked for: a **neutral current**. Alongside the charged weak current, which changes the electric charge of a fermion by one unit (a neutrino into an electron, a down quark into an up), there should be a current that does not. A neutrino should be able to hit a nucleon, scatter, and leave as a neutrino, giving some of its energy to the debris. The Z would carry the interaction. The coupling of the Z to each fermion is fixed by the angle, and in the language of Chapter 22 it is

$$g_L = T_3 - Q\sin^2\theta_W, \qquad g_R = -Q\sin^2\theta_W,$$

with $T_3$ the third component of weak isospin of the left-handed fermion (+½ for a neutrino or an up-type quark, −½ for a charged lepton or a down-type quark), $Q$ the charge, and $g_R$ for the right-handed one, which has no $T_3$.

| Fermion | $Q$ | $g_L$ | $g_R$ |
|---|---|---|---|
| ν | 0 | +0.500 | 0 |
| e⁻ | −1 | −0.269 | +0.232 |
| u | +⅔ | +0.346 | −0.154 |
| d | −⅓ | −0.423 | +0.077 |

The table is computed by `zCouplings` in `hep/sm` with $\sin^2\theta_W = 0.2315$. A neutrino couples only to the left-handed side. A charged fermion couples to both sides, with different strengths, so the Z interaction violates parity (the left and right couplings differ) but, unlike the charged current, not maximally. The difference between $g_L$ and $g_R$ is what the asymmetries at LEP measure.

:::history{year=1973 title="Muonless neutrino events in a bubble chamber" people="The Gargamelle collaboration (Hasert et al.)" source="Sources: Hasert et al. (1973a, 1973b, 1974); CERN."}
Gargamelle was a bubble chamber (Chapter 5) filled with about 12 cubic metres of heavy freon, CF₃Br, 4.8 metres long and 2 metres across, built in France by the CEA at Saclay and operated at CERN on a beam of neutrinos from the Proton Synchrotron. A neutrino that hits a nucleus in a **charged-current** interaction produces a muon (for a muon neutrino) and a spray of hadrons. A neutral current gives no muon: only a spray of hadrons that appears in the liquid from nowhere, with no incoming track, since neutrinos leave none.

In 1973 the collaboration reported such events, hadrons without a muon or electron, in a neutrino beam and in an antineutrino beam, and a single event of an antineutrino scattering off an electron: a lone electron track starting in the liquid.:cite[hasert1973a,hasert1973b] The principal worry was neutrons: a neutron made by a neutrino interaction in the shielding outside the chamber can enter it and make a spray of hadrons that looks the same. The collaboration made the case that it could not account for the rate, and the full study gave the ratio of neutral-current to charged-current events as $0.21 \pm 0.03$ for neutrinos and $0.45 \pm 0.09$ for antineutrinos, for events above a threshold in hadron energy.:cite[hasert1974] The result was announced at CERN on 19 July 1973.:cite[cern2013nc]

The measured ratios are not in the figure above, because the threshold changes what the formula must be compared with. But they are the right order of magnitude for a theory whose single angle was, for the first time, measured.
:::

## Finding the carriers

With the angle in hand, the theory put the W and the Z at masses of order 80 and 90 GeV, and the question was how to make them. In 1973 no accelerator was close. The beam of a fixed-target machine is wasted on the recoil (Chapter 2). A proton–proton collider was already working, the Intersecting Storage Rings at CERN with $\sqrt{s}$ of at most 63 GeV, and was far too weak.

The idea that settled it was to use the biggest ring that CERN had, the 7 km Super Proton Synchrotron (SPS), which accelerated protons to 400 GeV for fixed-target experiments, and make it collide protons with **antiprotons** in the same vacuum pipe, circulating in opposite directions in the same magnets (the antiproton has the opposite charge, so the same field guides it the other way round). Each beam at 270 GeV gave $\sqrt{s} = 540$ GeV. The machine was called the **SppS**, the Super Proton–Antiproton Synchrotron. Its first collisions came in the early summer of 1981.:cite[cern-ppbar]

Antiprotons are made by firing protons at a metal target, and come out at all angles with a wide spread of energies, in a number that is a tiny fraction of the number of protons fired. A beam like that cannot be stored as it is. A ring's magnets can hold a beam only if the particles' transverse offsets and angles stay small (Chapter 20), and the antiprotons are far too hot. Squeezing them is what **stochastic cooling** does.

:::history{year=1972 title="Cooling a beam by measuring a sample of it" people="Simon van der Meer, Carlo Rubbia" source="Sources: van der Meer (1972); Nobel Foundation (1984)."}
In 1972 Simon van der Meer, an engineer at CERN, described a way of reducing the spread of a stored beam of particles without a cold wall to absorb it. A pick-up electrode measures the average transverse position of the particles in a short slice of the beam. A signal travels across the ring, faster than the particles, to a kicker which nudges the slice back toward the centre by an amount proportional to the measured average. Since the sample contains only a few particles, the average carries information about each of them, and the correction is on average in the right direction. The mixing of the ring shuffles the particles between slices from turn to turn, so the next sample is a different one.:cite[vandermeer1972]

Carlo Rubbia proposed using it, in the mid-1970s, to accumulate antiprotons for collisions with protons, and led UA1, the experiment that used the antiprotons to find the carriers. Van der Meer and Rubbia shared the Nobel Prize in Physics in 1984 "for their decisive contributions to the large project, which led to the discovery of the field particles W and Z".:cite[nobel1984]
:::

The principle fits in a few lines of arithmetic, and a toy can run it.

::stochastic-cooling{n="23.3" caption="A toy of stochastic cooling. 2,000 particles have random transverse offsets. Each turn, particles are grouped in samples of s, the average offset of each sample is measured, and each particle in it is corrected by −g times that average. The solid line is the rms offset of the simulated beam, the dashed line is (1 − 2g/s + g²/s) to the power turns/2, the prediction for independent samples. At g = 1 the variance falls by a factor 1 − 1/s per turn: cooling a beam of N particles takes a time proportional to the number in a sample, so the real systems use an enormous bandwidth, which means very small samples, and cool for hours. Set g above 2 and the beam heats up instead."}

The antiprotons were accumulated, in the Antiproton Accumulator at CERN, over many hours, cooled until the beam was dense and narrow, and then sent to the SPS.:cite[nobel1984]

### What the detectors looked for

Two general-purpose detectors were built round the collision points, each in an underground hall of the SPS ring: **UA1** (Underground Area 1), led by Rubbia, and **UA2**, led by Pierre Darriulat. In a collision of a quark and an antiquark the W would be produced and decay at once, to an electron and a neutrino among other things. The electron is a track and a shower. The neutrino is nothing: it goes through the detector without leaving a trace.

How do you detect something that leaves no trace? By conservation of momentum. Chapter 2 said that the colliding partons carry no transverse momentum to speak of, so the transverse momenta of everything that comes out add to zero. Add up the transverse momenta of every particle the detector sees. If the sum is not zero, something left unseen, carrying the opposite transverse momentum. The **missing transverse momentum**, written $\vec p_T^{\,\text{miss}}$, is minus that sum:

$$\vec p_T^{\,\text{miss}} = -\sum_{i\,\in\,\text{visible}} \vec p_{T,i}.$$

It is a vector in the transverse plane. It is computed only in the two transverse directions, because the longitudinal momentum of the colliding partons is unknown (a quark with 15 % of a proton's momentum meets an antiquark with 3 %: the collision is boosted along the beam by an unknown amount) and because particles that go down the beam pipe escape through the ends of the detector.

:::programmer
Missing momentum is **negative space**: you know it from what is not there. A message queue works the same way when it detects a lost packet from a gap in sequence numbers, and a checksum reveals corruption by a mismatch. The conservation law is the checksum. Its value is exactly zero in the full truth, so any residual is evidence, and its direction tells you where the missing piece went. The cost is that the check is only as good as the completeness of the sum. A single jet that misses the detector, or a single badly measured calorimeter cell, makes a false residual, which is why hermetic coverage (Chapter 7) matters.
:::

In 1983 UA1 reported six events with an isolated high-energy electron and a large missing transverse momentum balancing it, and UA2 reported four. These were the first W bosons.:cite[ua1w1983,ua2w1983] UA2 measured the mass as 80 GeV, with an uncertainty of about +10 and −6.:cite[ua2w1983] A few months later the Z, which decays to a pair of electrons or muons with no neutrino, was found: UA1 saw four events with an electron pair and one with a muon pair, and UA2 followed with eight events with an electron pair.:cite[ua1z1983,ua2z1983]

:::history{year=1983 title="Six events, then four, and the Z a few months later" people="The UA1 and UA2 collaborations" source="Sources: Arnison et al. (UA1, 1983a, 1983b); Banner et al. (UA2, 1983); Bagnaia et al. (UA2, 1983); CERN."}
The UA1 paper on the W, published in *Physics Letters B* on 24 February 1983, described six events with an isolated electron of large transverse momentum and large missing transverse momentum; UA2's, published on 17 March, described four.:cite[ua1w1983,ua2w1983] The first announcements of the W had been made at CERN in January. The Z was announced on 1 June 1983, on the basis of four electron pairs and one muon pair in UA1, with UA2's eight electron pairs following.:cite[ua1z1983,ua2z1983,cern-uaw]

The masses agreed with the predictions of the Standard Model. The task that followed was to measure them to a fraction of a per cent, and then to ask whether anything in the theory was missing. In 1984 Rubbia and van der Meer received the Nobel Prize in Physics.:cite[nobel1984]
:::

### The transverse mass and the Jacobian edge

The W's mass cannot be computed as in Chapter 2: the neutrino's momentum along the beam is unknown. What can be computed is a quantity that uses only the transverse part, the **transverse mass** of the charged lepton and the missing momentum:

:::equation{#mt caption="The transverse mass of a lepton and a neutrino: it never exceeds the mass of the W they came from."}
$$\term{mT}{m_T}^2 = 2\,\term{ptl}{p_T^{\ell}}\,\term{ptn}{p_T^{\nu}}\,\bigl(1-\cos\term{dphi}{\Delta\phi}\bigr)$$

```terms
mT:
  label: 'm_T, the transverse mass'
  what: 'A mass computed from transverse momenta only. It equals the W mass when the two particles come out in the transverse plane and is smaller when they do not.'
  why: 'It can be computed at a hadron collider. The edge of its distribution, at m_W, is the signature of the W.'
  effect: 'A W at rest, with the lepton and the neutrino back to back in the plane, gives m_T = m_W exactly.'
ptl:
  label: 'p_T of the charged lepton'
  what: 'The transverse momentum of the electron or muon, measured in the tracker.'
  why: 'It is one of the two measured quantities in the formula, and the better measured one.'
  effect: 'A lepton with half the W mass of transverse momentum is the largest it can have for a W at rest.'
ptn:
  label: 'p_T of the neutrino'
  what: 'The magnitude of the missing transverse momentum, which stands for the neutrino.'
  why: 'It is the other measured quantity, and the one with the larger uncertainty, since it is the sum of everything else in the event.'
  effect: 'A hard recoil from the W''s own production smears it.'
dphi:
  label: 'Δφ, the azimuthal angle between them'
  what: 'The angle in the transverse plane between the lepton and the missing momentum.'
  why: 'A W at rest gives Δφ = π, and then 1 − cos Δφ = 2.'
  effect: 'A W that decays with the lepton and neutrino close together in azimuth has a small transverse mass.'
```
:::

:::deeper[Why the transverse mass never exceeds the mass]
For massless particles the true mass is $m^2 = 2E_\ell E_\nu - 2\vec p_\ell\cdot\vec p_\nu = 2p_T^\ell p_T^\nu(\cosh\Delta\eta - \cos\Delta\phi)$, where $\Delta\eta$ is the pseudorapidity difference of Chapter 2. The hyperbolic cosine is at least 1, so $m^2 \ge 2p_T^\ell p_T^\nu(1-\cos\Delta\phi) = m_T^2$. The neutrino's pseudorapidity, which is what the missing information is, enters only through $\cosh\Delta\eta$, and dropping it can only lower the result. The transverse mass is a lower bound on the mass, saturated when $\Delta\eta = 0$.

The same geometry gives the other signature. For a W at rest, the lepton's transverse momentum is $p_T = (m_W/2)\sin\theta^*$, where $\theta^*$ is its angle to the beam in the W's frame. The distribution of $\cos\theta^*$ is $(1+\cos^2\theta^*)$ summed over the two charges, and $\mathrm{d}p_T/\mathrm{d}\cos\theta^* \to 0$ as $\theta^* \to 90°$. So the density in $p_T$ is the density in $\cos\theta^*$ times the inverse of that derivative, $\frac{3}{4}(1+c^2)\,\frac{4p_T}{m_W^2\,c}$ with $c = \sqrt{1 - 4p_T^2/m_W^2}$, which diverges as $p_T \to m_W/2$. It is an integrable singularity (the area is 1), and a very visible one: a **Jacobian peak**.
:::

The lepton's transverse momentum has a peak at $m_W/2$ and an edge beyond it, and the transverse mass has an edge at $m_W$. Both are blurred by the W's own transverse momentum, which comes from the gluons that the quarks radiate before they annihilate, by the W's width of 2 GeV, and by the resolution with which the missing momentum is measured.

::w-transverse{n="23.4" caption="Simulated W → μν events from the course generator (truth level, with a parton shower; the detector is represented by a Gaussian smearing of the missing momentum). Left: the muon's transverse momentum and the missing transverse momentum, with the analytic Jacobian peak for a W at rest. Right: the transverse mass, with its edge at the W mass. Switch between the SppS (proton–antiproton at 540 GeV) and the LHC (proton–proton at 13 TeV), and raise the resolution parameter to see the edge dissolve. When you have solved the exercises below, tick *use my code* and the figure runs your missing-momentum and transverse-mass functions."}

### Write it yourself

Two small functions turn what a detector sees into the W's signature. The reference ones are in `hep/reco` and `hep/kinematics`; the figure above uses yours once they pass.

```code
id: missing-pt
title: Missing transverse momentum
hook: reco.missingPt
prompt: |
  Implement `missingPt(objects)`. Given the four-momenta of everything the detector saw (a list of `{ E, px, py, pz }`),
  return the missing transverse momentum as a vector `{ x, y }`: **minus** the sum of the transverse momenta. Only the
  components across the beam count. Remember what you know about the longitudinal ones.
starter: |
  import type { P4 } from 'hep';

  export function missingPt(objects: P4[]): { x: number; y: number } {
    // minus the vector sum of (px, py)
    return { x: 0, y: 0 };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { missingPt } from 'solution';
  import { generate } from 'hep/gen';
  import { rng } from 'hep/random';
  import { boost } from 'hep/kinematics';

  test('one visible particle: the missing momentum is minus its transverse momentum', () => {
    const m = missingPt([{ E: 60, px: 30, py: -40, pz: 25 }]);
    expect(m.x).toBeCloseTo(-30, 10);
    expect(m.y).toBeCloseTo(40, 10);
  });

  test('nothing seen: nothing missing, and no NaN', () => {
    const m = missingPt([]);
    expect(Math.abs(m.x)).toBeLessThan(1e-12);
    expect(Math.abs(m.y)).toBeLessThan(1e-12);
  });

  test('momenta add as vectors: two balanced jets and a lone muon', () => {
    const jets = [
      { E: 55, px: 50, py: 10, pz: 20 },
      { E: 60, px: -45, py: -5, pz: -30 },
      { E: 30, px: 0, py: -12, pz: 27 },
    ];
    const m = missingPt(jets);
    expect(m.x).toBeCloseTo(-5, 10);
    expect(m.y).toBeCloseTo(7, 10);
  });

  test('a boost along the beam does not change it', () => {
    const objs = [
      { E: 55, px: 50, py: 10, pz: 20 },
      { E: 30, px: -3, py: -12, pz: 27 },
    ];
    const a = missingPt(objs);
    const b = missingPt(objs.map((p) => boost(p, 0, 0, 0.7)));
    expect(b.x).toBeCloseTo(a.x, 8);
    expect(b.y).toBeCloseTo(a.y, 8);
  });

  test('W → μν events: the missing momentum is the neutrino', () => {
    const r = rng(41);
    for (let i = 0; i < 25; i++) {
      const ev = generate('pp->W->munu', { sqrtS: 13000 }, r);
      const visible = [];
      let nx = 0, ny = 0;
      for (const p of ev.particles) {
        if (p.status !== 'final') continue;
        const a = Math.abs(p.pdg);
        if (a === 12 || a === 14 || a === 16) { nx += p.p.px; ny += p.p.py; } else visible.push(p.p);
      }
      const m = missingPt(visible);
      expect(m.x).toBeCloseTo(nx, 6);
      expect(m.y).toBeCloseTo(ny, 6);
    }
  });
solution: |
  import type { P4 } from 'hep';

  export function missingPt(objects: P4[]): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const o of objects) {
      x -= o.px;
      y -= o.py;
    }
    return { x, y };
  }
hints:
  - 'Start with x = 0 and y = 0 and subtract each object’s px and py. The longitudinal momentum pz plays no part.'
  - 'An empty list should give zero, and a loop that subtracts does that for free.'
```

```code
id: transverse-mass
title: The transverse mass
hook: kinematics.transverseMass
prompt: |
  Implement `transverseMass(lepton, met)` for a charged lepton (a four-vector) and the missing transverse momentum
  (a vector `{ x, y }`):

  m_T² = 2 p_T(ℓ) |p_T^miss| (1 − cos Δφ),

  where Δφ is the angle in the transverse plane between the two. You do not need `Math.atan2`: the cosine of the angle
  between two 2-D vectors is their dot product over the product of their lengths. Think about what should happen if the
  missing momentum is zero, and about rounding that makes a nearly collinear pair come out very slightly negative under
  the root.
starter: |
  import type { P4 } from 'hep';

  export function transverseMass(lepton: P4, met: { x: number; y: number }): number {
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { transverseMass } from 'solution';
  import { transverseMass as reference, fromPtEtaPhiM } from 'hep/kinematics';
  import { generate } from 'hep/gen';
  import { rng } from 'hep/random';

  test('back to back, 40 GeV each: m_T = 80 GeV, the W mass', () => {
    const lep = fromPtEtaPhiM(40, 0.3, 0.0, 0.0);
    expect(transverseMass(lep, { x: -40, y: 0 })).toBeCloseTo(80, 8);
  });

  test('at right angles: m_T = √2 × 40', () => {
    const lep = fromPtEtaPhiM(40, -1.1, 0.0, 0.0);
    expect(transverseMass(lep, { x: 0, y: 40 })).toBeCloseTo(Math.SQRT2 * 40, 8);
  });

  test('collinear: zero, and never NaN', () => {
    const lep = fromPtEtaPhiM(35, 0.5, 1.0, 0.0);
    const met = { x: 20 * Math.cos(1.0), y: 20 * Math.sin(1.0) };
    const m = transverseMass(lep, met);
    expect(Number.isNaN(m)).toBe(false);
    expect(Math.abs(m)).toBeLessThan(1e-3);
  });

  test('no missing momentum: zero', () => {
    const lep = fromPtEtaPhiM(35, 0.5, 1.0, 0.0);
    expect(transverseMass(lep, { x: 0, y: 0 })).toBeCloseTo(0, 10);
  });

  test('agrees with the library on 200 random inputs, whatever the azimuths', () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const lep = fromPtEtaPhiM(10 + 60 * r(), 4 * r() - 2, 12 * r() - 6, 0.1);
      const met = { x: 80 * r() - 40, y: 80 * r() - 40 };
      expect(transverseMass(lep, met)).toBeCloseTo(reference(lep, met), 8);
    }
  });

  test('W → μν events: m_T never exceeds the mass of the lepton–neutrino system', () => {
    const r = rng(3);
    let top = 0;
    for (let i = 0; i < 300; i++) {
      const ev = generate('pp->W->munu', { sqrtS: 13000 }, r);
      let mu = null, nu = null;
      for (const p of ev.particles) {
        if (p.status !== 'final') continue;
        if (Math.abs(p.pdg) === 13) mu = p.p;
        if (Math.abs(p.pdg) === 14) nu = p.p;
      }
      const m2 = (mu.E + nu.E) ** 2 - (mu.px + nu.px) ** 2 - (mu.py + nu.py) ** 2 - (mu.pz + nu.pz) ** 2;
      const mt = transverseMass(mu, { x: nu.px, y: nu.py });
      expect(mt).toBeLessThan(Math.sqrt(m2) + 1e-6);
      top = Math.max(top, mt);
    }
    // an edge near the W mass: some events come close to it
    expect(top).toBeGreaterThan(75);
  });
solution: |
  import type { P4 } from 'hep';

  export function transverseMass(lepton: P4, met: { x: number; y: number }): number {
    const ptl = Math.hypot(lepton.px, lepton.py);
    const etm = Math.hypot(met.x, met.y);
    if (ptl === 0 || etm === 0) return 0;
    // cos Δφ from the dot product: no atan2, and no wrapping of the angle needed
    const cos = (lepton.px * met.x + lepton.py * met.y) / (ptl * etm);
    const m2 = 2 * ptl * etm * (1 - cos);
    return Math.sqrt(Math.max(0, m2));
  }
hints:
  - 'In two dimensions, cos Δφ = (a · b)/(|a| |b|). That avoids the angle altogether, and its wrap-around at ±π.'
  - 'If either vector has zero length the cosine is 0/0: return 0 before dividing.'
  - '`Math.sqrt` of a tiny negative number is NaN. Clamp the argument at zero.'
```

## The Z at LEP

The Z is a spike on a smooth background. At a hadron collider it is one of many things happening. In an electron–positron collider tuned to its mass, it is nearly everything.

**LEP**, the Large Electron–Positron collider, was the 27 km ring at CERN that Chapter 21 described. From 1989 to 1995 it ran with the energy of the beams adjusted to sit on and around the Z, with a total collision energy of about 91 GeV, and four experiments recorded the collisions: **ALEPH** (Apparatus for LEp PHysics), **DELPHI** (DEtector with Lepton, Photon and Hadron Identification), **L3** (named for the third letter of intent submitted for LEP) and **OPAL** (Omni-Purpose Apparatus for LEP). In all they recorded about 17 million Z decays: 15.5 million into quarks and 1.7 million into charged leptons.:cite[lepewwg2006]

At the peak the cross-section of $e^+e^-\to Z\to$ anything is enormous by the standards of Chapter 16. The cross-section for $e^+e^-\to\mu^+\mu^-$ by photon exchange alone at 91 GeV is $86.8\ \text{nb}\,\text{GeV}^2/s = 0.010$ nb. At the Z peak its height is 2.0 nb, about 190 times larger. The Z is a resonance, and the cross-section as a function of energy follows a Breit–Wigner shape (Chapter 3), the one the Z's width of 2.5 GeV sets.

:::equation{#lineshape caption="The Z lineshape for the hadronic final state, without radiation: a Breit–Wigner peak whose height and width are set by the partial widths."}
$$\term{sigma}{\sigma_\text{had}}(s) = \term{sigma0}{\sigma^0_\text{had}}\;\frac{s\,\Gamma_Z^2}{(s-m_Z^2)^2 + s^2\Gamma_Z^2/m_Z^2},\qquad \sigma^0_\text{had} = \frac{12\pi}{m_Z^2}\,\frac{\term{Gee}{\Gamma_{ee}}\,\Gamma_\text{had}}{\term{GZ}{\Gamma_Z}^2}$$

```terms
sigma:
  label: 'σ_had(s), the hadronic cross-section'
  what: 'The cross-section for e⁺e⁻ to produce hadrons, as a function of the squared centre-of-mass energy s.'
  why: 'It is the measured curve. Its position gives m_Z, its width Γ_Z and its height σ⁰.'
  effect: 'At the peak, √s = m_Z, it equals σ⁰ (before radiation).'
sigma0:
  label: 'σ⁰_had, the peak cross-section'
  what: 'The height of the peak, 41.5 nb for the real Z, before the effect of radiation.'
  why: 'It depends on the total width as 1/Γ_Z², so a measurement of the height measures the width, once the partial widths for the visible decays are known.'
  effect: 'An extra invisible decay channel lowers the peak: with one more neutrino species, by 12 %.'
Gee:
  label: 'Γ_ee, the width for Z → e⁺e⁻'
  what: 'The partial width for the decay to an electron pair, 83.4 MeV at leading order. The same for μ and τ.'
  why: 'It appears squared in the cross-section, once for the Z being made from e⁺e⁻ and once for its decaying to the final state, divided by the total width.'
  effect: 'It is measured from the leptonic cross-section and the shape.'
GZ:
  label: 'Γ_Z, the total width'
  what: 'The sum of all partial widths, 2.4955 GeV, the inverse of the lifetime.'
  why: 'It sets the width of the peak, and, through σ⁰ ∝ 1/Γ², its height.'
  effect: 'Γ_Z = Γ_had + 3Γ_ℓℓ + N_ν Γ_νν: each neutrino species adds Γ_νν = 0.166 GeV.'
```
:::

The total width is the sum of the partial widths of everything the Z decays to. It decays into a pair of charged leptons (3.4 % each), into quark pairs, which show up as hadrons (about 70 %), and into neutrino pairs (about 6.7 % each), which leave no trace in the detector:

$$\Gamma_Z = \Gamma_\text{had} + 3\,\Gamma_{\ell\ell} + N_\nu\,\Gamma_{\nu\nu}, \qquad \Gamma_{\nu\nu} = \frac{G_F\,m_Z^3}{12\sqrt2\,\pi} = 166\ \text{MeV}.$$

The partial widths for the visible final states can be counted. The hadronic width is the sum over the quarks, and can be read from the cross-section of hadron production. The leptonic one from the lepton pairs. The width of the peak then tells $\Gamma_Z$, and the **invisible width** is the difference between that and everything counted, $\Gamma_\text{inv} = \Gamma_Z - \Gamma_\text{had} - 3\Gamma_{\ell\ell}$. It is the sum over every particle that couples to the Z and is not detected. If neutrinos of a new, fourth kind exist, with a mass below half of the Z's, the Z decays to them too. The invisible width counts them. Divided by the width predicted for one species it gives the number of species: $N_\nu = \Gamma_\text{inv}/\Gamma_{\nu\nu}$.

```predict
q: 'Suppose there were a fourth kind of light neutrino, coupled to the Z like the other three. What would happen to the Z peak in the hadronic cross-section, compared with three neutrinos?'
options:
  - text: The peak would be higher and narrower, since there is another way for the Z to be made.
    why: 'The Z is made by e⁺e⁻ annihilation, whose probability does not change. A new decay channel does not make more Z’s. It only gives each Z another way to die, so the total width goes up, and the resonance gets broader.'
  - text: The peak would be lower and broader.
    correct: true
    why: 'The total width goes up by 0.166 GeV (from 2.495 to 2.661 GeV). A broader resonance is a shorter-lived one, and the peak height goes as 1/Γ_Z² when the visible widths are unchanged: it falls to about 88 % of its value, a 12 % drop. The fall is easy to measure: it is much more than the statistical error of a scan with millions of events.'
  - text: Nothing visible, since the new neutrinos cannot be seen.
    why: 'They cannot be seen directly, but they change the total width, and the total width is what the shape of the peak measures. This is the point of the method: a decay you cannot see shows up in the lifetime of the thing that decays.'
```

::counting-neutrinos{n="23.5" caption="SIMULATED, LEP-like data. The points are pseudo-data: a scan across the Z at seven energies, with luminosities like LEP's, in which the hadronic cross-section comes from the course generator for exactly three light neutrino species, and the numbers of events are Poisson-fluctuated. Nothing here is LEP data. The curves are the generator's prediction for 2, 3 and 4 species. At the LEP-like amount of data the error bars are far smaller than the dots: switch the hypothesis to 4 and the lower panel shows the points missing it by about 12 % at the peak. Slide the amount of data down to a thousandth of the full set, which is about what the first weeks of LEP in 1989 had, and the three hypotheses are still apart. Raise the luminosity error that the analysis does not know about, and N_ν is pulled away from 3 by a shift comparable to the whole quoted uncertainty. The generator uses leading-order widths, so Γ_Z, σ⁰ and the peak are those of the course's model, not exactly LEP's. The radiative peak (30 nb) lies well below the 41 nb of the pole cross-section (dotted line): initial-state radiation lowers and broadens the visible peak."}

Three features of the figure are worth taking away.

The **radiation**: the visible peak is lower than the cross-section the formula gives. An electron or positron that radiates a photon before the annihilation reaches the Z with less energy. Events that would have sat on the peak are moved to a lower effective energy, where the cross-section is smaller, and events above the peak are moved down onto it. The net effect is a peak lowered by about a quarter and a long tail on its high side. The visible peak in the generator is about 30 nb and the pole cross-section $\sigma^0$ is 41.5 nb in the LEP combination; the analyses correct for the radiation, which is a calculation that can be done accurately, to reach $\sigma^0$.

The **luminosity**: the height of the peak is a cross-section, number of events divided by luminosity (Chapter 3), and the luminosity of the colliding beams has to be measured too. LEP measured it by counting Bhabha scattering at small angles, $e^+e^-\to e^+e^-$ (Chapter 16), whose cross-section is known from QED. A relative error of 0.1 % on the luminosity gives an error of 0.1 % on $\sigma^0$, hence about 0.05 % on $\Gamma_Z$, which is 1.2 MeV, and 0.007 on $N_\nu$. In the simulation, that is the shift that the slider produces. The statistical error of the scan is a few thousandths, so the luminosity is as important as the Z's millions of decays.

The **independence**: the number of species is fixed by the height and the width together. If the normalisation is left free (the toggle in the figure), only the shape of the peak counts, and the answer is less precise but does not depend on the luminosity. The two measurements agree.

:::history{year=1989 title="The first weeks of LEP" people="The ALEPH, DELPHI, L3 and OPAL collaborations" source="Sources: CERN; Mele (2015); the LEP Electroweak Working Group (2006)."}
LEP's first collisions were recorded on 13 August 1989. On 13 October 1989, at a seminar at CERN, the four experiments presented their first results, from only a few weeks of data: the first lineshape, and a count of the light neutrino species. The values in the experiments' first papers were 3.27 ± 0.30 for ALEPH, from about 3,000 hadronic decays,:cite[aleph1989] and 2.4 ± 0.6 (DELPHI), 3.42 ± 0.48 (L3) and 3.1 ± 0.4 (OPAL), each consistent with three, and together disfavouring two and four.:cite[mele2015] The SLC collider at Stanford, whose Mark II detector also took data on the Z that autumn, gave a result consistent with these.:cite[mele2015]

After 1995 the four experiments had recorded about 17 million Z decays. The combination of their results, by the LEP Electroweak Working Group in 2006, is $N_\nu = 2.9840 \pm 0.0082$.:cite[lepewwg2006] In 2020 two corrections to the luminosity calculation (one for the effect of the electromagnetic field of one beam on the other, and one for the Bhabha cross-section itself) moved the number to $2.9963 \pm 0.0074$.:cite[voutsinas2020,janot2020] The move, which is larger than the old uncertainty, is a lesson in systematic uncertainties that Chapter 28 uses.
:::

You can reproduce the calculation with three numbers, which are published pole values: $\sigma^0_\text{had} = 41.541$ nb, the ratio of hadronic to leptonic width $R_\ell = \Gamma_\text{had}/\Gamma_{\ell\ell} = 20.767$, and the mass $m_Z = 91.1876$ GeV. Solve the formula for $\sigma^0$ for the ratio of the invisible and leptonic widths,

$$\frac{\Gamma_\text{inv}}{\Gamma_{\ell\ell}} = \sqrt{\frac{12\pi R_\ell}{m_Z^2\,\sigma^0_\text{had}}} - R_\ell - 3,$$

and divide by the Standard Model's value for one neutrino species, $\Gamma_{\nu\nu}/\Gamma_{\ell\ell} = 1.991$.

```numeric
id: neutrino-count
title: Counting neutrinos from three published numbers
prompt: 'Use σ⁰_had = 41.541 nb, R_ℓ = 20.767 and m_Z = 91.1876 GeV, with 1 GeV⁻² = 0.38938 mb = 3.8938 × 10⁵ nb. Compute Γ_inv/Γ_ℓℓ = √(12π R_ℓ / (m_Z² σ⁰)) − R_ℓ − 3 and divide by 1.991 (the SM ratio Γ_νν/Γ_ℓℓ) to get the number of light neutrino species.'
answer: 2.984
unit: ''
tolerance: 0.01
hints:
  - 'σ⁰ in GeV⁻² is 41.541 / 3.8938 × 10⁵ = 1.0668 × 10⁻⁴. m_Z² = 8315.2 GeV².'
  - '12π × 20.767 = 782.9, divided by 8315.2 × 1.0668 × 10⁻⁴ = 0.8870, gives 882.6; its square root is 29.71.'
  - 'Γ_inv/Γ_ℓℓ = 29.71 − 20.767 − 3 = 5.94.'
explain: 'Γ_inv/Γ_ℓℓ = 5.940, and 5.940/1.991 = 2.984. With the Standard Model’s own ratio for Γ_νν/Γ_ℓℓ at leading order (1.989) the answer is 2.986; the combined LEP result, 2.9840 ± 0.0082, is the careful version of this calculation. The conclusion: three, and not four, or two. Cosmology reaches the same number by another route: the astrophysics course’s [Big Bang chapter](/astrophysics/ch/big-bang/) counts light neutrino species from the amount of helium that formed in the first minutes.'
```

```fermi
id: z-per-second
title: Z bosons per second at LEP
prompt: 'At the Z peak the visible hadronic cross-section was about 30 nb. LEP’s luminosity at that energy was of the order of 2 × 10³¹ cm⁻² s⁻¹ (1 nb = 10⁻³³ cm²). How many hadronic Z decays per second did one LEP experiment see at the peak?'
answer: 0.6
unit: s⁻¹
factor: 3
hints:
  - 'rate = σ L.'
  - '30 nb = 3 × 10⁻³² cm².'
explain: 'σL = 3 × 10⁻³² cm² × 2 × 10³¹ cm⁻² s⁻¹ = 0.6 per second: about one hadronic Z every couple of seconds at each of the four collision points, one for each experiment. A year of continuous running is 3 × 10⁷ s; accelerators run a fraction of that, and at lower luminosity than the best, which is why the total over six years, 17 million decays summed over four experiments, is millions and not billions. The same arithmetic at the LHC gives a much higher rate, with a much smaller fraction of the collisions being Zs (Chapter 27).'
```

## The W mass today

The masses of the W and Z are now measured to better than a tenth of a per cent. The Z mass comes from the lineshape, $m_Z = 91.1880$ GeV with an uncertainty of 2 MeV, the best-measured of the quantities in this chapter. The W mass is harder, since the W is made at hadron colliders, where only the transverse mass and the lepton's transverse momentum are available, and since the quantity of interest is the position of an edge. The particle table (the Particle Data Group's 2024 value) has $m_W = 80.3692 \pm 0.0133$ GeV.:cite[pdg2024]

In 2022 the CDF experiment at the Fermilab Tevatron measured 80.4335 ± 0.0094 GeV, higher than the Standard Model's prediction (about 80.36 GeV) by seven standard deviations of its own uncertainty.:cite[cdf2022] The ATLAS and CMS experiments at the LHC then measured 80.3665 ± 0.0159 GeV (2024) and 80.3602 ± 0.0099 GeV (2024), both consistent with the Standard Model and with each other.:cite[atlas2024,cms2024] The CDF measurement stands unexplained, and a large effort is going into understanding what differs between the experiments. It is a measurement of an edge in a histogram to about one part in 10⁴, and the uncertainties are the ones Chapter 28 describes: modelling of the W's production, of the parton distributions and of the detector response.

:::hood[Sampling a resonance: the Breit–Wigner by inverse transform]
Both the generator's Z and its W have a mass distribution that follows a Breit–Wigner (Chapter 3). The library draws it with the inverse of the cumulative distribution, which for this shape is a tangent, and truncates it by squeezing the uniform random number into the part of the cumulative distribution that lies inside the allowed window:

```ts
export function breitWigner(r: Rng, mass: number, width: number, lo = -Infinity, hi = Infinity): number {
  const cdf = (x: number) => 0.5 + Math.atan((x - mass) / (width / 2)) / Math.PI;
  const a = Number.isFinite(lo) ? cdf(lo) : 0;
  const b = Number.isFinite(hi) ? cdf(hi) : 1;
  const u = a + (b - a) * r();
  return mass + (width / 2) * Math.tan(Math.PI * (u - 0.5));
}
```

One uniform number gives one mass. Truncation costs nothing: no rejected draws. A real Breit–Wigner has such heavy tails that it has no mean and no variance, so the cut matters: the 91 GeV peak's tails reach down to the continuum of Figure 23.1. In the matrix-element generator the same mapping is used inside the integration (a change of variable that makes the integrand flat in the Breit–Wigner variable), which is why the resonance is sampled well however narrow it is.

The missing momentum is as simple as it sounds. Here is the library's reference for the function you wrote:

```ts
export function missingPt(objects: P4[]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const o of objects) { x -= o.px; y -= o.py; }
  return { x, y };
}
```

What is not simple is what goes into it: in `reconstruct`, `metFromEvent` forms a four-vector for every calorimeter cell, with the transverse energy $E/\cosh\eta$ pointing along the cell's azimuth, adds the muons' momenta (which deposit almost nothing in the calorimeters), and passes the list through the hook `reco.missingPt`. The result is the reconstructed missing momentum that the W analysis of Chapter 29's pipeline uses.
:::

:::experiments
The real analyses of the W mass fit **templates**. ATLAS, CMS and CDF take the distributions of the lepton's transverse momentum and of the transverse mass, generate millions of simulated W events for a range of assumed W masses with generators and a detector simulation (Chapter 0's tools: Pythia or POWHEG for the generation, Geant4 for the detector), and find the mass for which the simulated histogram matches the data best, with a likelihood fit like the ones of Chapter 28. The detector's response to the lepton's momentum is calibrated on the Z peak, whose mass is known from LEP to 2 MeV: the Z → μμ peak in Figure 23.1 plays the role of the ruler. The dominant uncertainties come from the parton distributions and from the model of the W's own transverse momentum, both of which the course's generator also treats only roughly.

The **LEP Electroweak Working Group**, which combined the four experiments' Z measurements, and the **Gfitter** and **ZFitter** groups, which compare them with the Standard Model's predictions, appear again in Chapter 25.
:::

## What comes next

Everything so far treated the W as coupling an up-type quark to its own generation's down-type partner, and the neutrino to its own charged lepton. That is not quite what happens: the W also couples the up quark to the strange quark, with a strength reduced by a factor of about 0.22. Chapter 24 follows that thread: the mixing of generations, the discovery of the charm and bottom quarks, and a source of the asymmetry between matter and antimatter. Chapter 25 turns to the heaviest particle of the Standard Model, the top quark, whose effects on the W and Z masses were visible before it was seen.

## Further reading

- The papers of Glashow, Weinberg and Salam (:cite[glashow1961,weinberg1967,salam1968]), and 't Hooft's (:cite[thooft1971]).
- The UA1 and UA2 discovery papers of 1983 (:cite[ua1w1983,ua2w1983,ua1z1983,ua2z1983]).
- The LEP Electroweak Working Group's report, *Precision electroweak measurements on the Z resonance* (:cite[lepewwg2006]).
- The Particle Data Group's electroweak review (:cite[pdg2024]).
