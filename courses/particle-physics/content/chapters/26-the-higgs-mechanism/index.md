---
number: 26
title: The Higgs mechanism
summary: Why the electroweak theory forbids every mass, how a field that settles away from zero gives masses back to the W, the Z and the fermions without breaking the theory, and what the Higgs boson is.
duration: About 2½ hours
prerequisites: [symmetry-and-gauge, w-and-z]
---

By 1967 the weak and electromagnetic forces had been written as one theory (Chapter 23), and the theory had an embarrassing property. It was built on a symmetry, and the symmetry forbids every mass in it. The photon is massless, which is fine. But the W and the Z are not massless: the weak force reaches only a few thousandths of a proton's radius, and Chapter 23 measured the two bosons at 80.4 and 91.2 GeV. The electron, the quarks and the muon are not massless either. Adding the masses by hand breaks the symmetry, and with it the property that made the theory calculable. This chapter explains how the masses are put back without touching the symmetry, and what has to exist for that to work. The answer is a new field, a new particle, and a prediction that took forty-eight years to test.

## Why a mass term breaks the theory

Chapter 17 told the story of the photon as the price of a symmetry. Demand that the laws of electrodynamics be unchanged when the phase of the electron field is rotated by a different amount at every point in space and time, and a field must exist to keep the books: the photon field $A_\mu$, which transforms as $A_\mu \to A_\mu + \partial_\mu\alpha/e$ when the phase is rotated by $\alpha(x)$. The same move with larger groups gives the $W^{1,2,3}$ of SU(2) and the $B$ of U(1) (Chapter 23), and the gluons of SU(3) (Chapter 18).

A massive vector particle needs a term $\tfrac12 m^2 A_\mu A^\mu$ in the Lagrangian. Try the transformation on it:

$$\tfrac12 m^2 A_\mu A^\mu \;\to\; \tfrac12 m^2 \left(A_\mu + \tfrac1e\partial_\mu\alpha\right)\left(A^\mu + \tfrac1e\partial^\mu\alpha\right) \;\neq\; \tfrac12 m^2 A_\mu A^\mu .$$

The extra terms do not cancel. The mass term is not gauge invariant, so a theory with a bare mass for its gauge bosons is not the theory the symmetry asked for. This is not a matter of taste. A theory with explicit gauge-boson masses is not renormalisable: in loop calculations (the loops that Chapter 15 showed but did not compute) the infinities that appear cannot be absorbed into a finite number of measured parameters, and the theory loses its predictive power at high energy. The symmetry is what keeps the infinities under control.

The fermions have a related problem, and it comes from the weak force's handedness (Chapter 22). The W couples only to the **left-handed** part of each fermion field. In the electroweak theory the left-handed electron and its neutrino form a doublet under SU(2), a pair that the symmetry rotates into each other, and the right-handed electron is a singlet that the symmetry leaves alone. A mass term for a fermion is

$$m\bar\psi\psi = m\left(\bar\psi_L\psi_R + \bar\psi_R\psi_L\right),$$

which joins a left-handed field to a right-handed one. Joining a doublet to a singlet is not allowed by SU(2): the product changes when the symmetry is applied. The two halves also carry different weak hypercharge, so the U(1) forbids the term as well. A symmetric theory of W, Z, photon, electrons and quarks has no masses in it at all.

:::key[The problem in one sentence]
The measured masses of the W, the Z and the charged fermions are not allowed by the gauge symmetry of the theory that describes their interactions. Either the symmetry is wrong, or the masses must come from somewhere that does not break it.
:::

## A symmetric law with an asymmetric state

The escape is an old idea from solid-state physics. A symmetry of the **laws** is not necessarily a symmetry of the **state**. Balance a pencil on its point: the equations that govern it are symmetric under rotation about the vertical axis, there is no preferred direction of fall, and yet the pencil falls in *some* direction. Whichever it chooses, the choice breaks the symmetry of the situation that the laws describe. A block of iron is another example. Above 1043 K the magnetic moments of its atoms point in random directions and the block has no overall magnetisation, which is the symmetric state. Below it the moments line up in some direction, which nothing in the laws selected. The laws are still rotationally symmetric, and every direction is equally good, but the state in which the block sits has picked one. This is :term[spontaneous symmetry breaking]{id=spontaneous-symmetry-breaking}.

The same thing is possible for a field. Suppose the energy of a complex scalar field $\phi$ (a field with a single value at each point, which can be complex, unlike the electromagnetic field, which points in a direction) has the form

:::equation{#hat caption="The potential energy of the Higgs field: a Mexican hat. It depends only on |φ|, so it is symmetric under a rotation of the phase of φ, but its lowest points are on a circle, not at the centre."}
$$\term{V}{V(\phi)} \;=\; -\,\term{mu2}{\mu^2}\,\left|\term{phi}{\phi}\right|^2 \;+\; \term{lam}{\lambda}\,\left|\phi\right|^4$$

```terms
V:
  label: 'V(φ), the potential energy density'
  what: The energy stored in the field, per unit volume, when the field has the value φ everywhere. It is what the vacuum would cost in energy if the field were held at that value.
  why: A field settles where its potential energy is lowest, just as a ball settles at the bottom of a bowl. The shape of V decides what the empty vacuum looks like.
  effect: For μ² > 0 the shape is a Mexican hat, with a bump at φ = 0 and a circular valley around it.
mu2:
  label: 'μ², the mass-squared parameter'
  what: A constant with the dimensions of mass squared. The sign in front of it is chosen negative here, so that the centre of the potential is a hill rather than a bowl.
  why: It sets the depth and the size of the hat. With μ² < 0 the potential would be an ordinary bowl and nothing would break.
  effect: The radius of the valley grows with μ. The Higgs boson's mass is mH² = 2μ², so μ = 88.5 GeV.
phi:
  label: 'φ, the Higgs field'
  what: A complex scalar field. In the real theory it has four real components, arranged as two complex numbers, but the hat is easiest to see with one complex number, which is a point on a plane.
  why: It is the field whose value in the vacuum is not zero. Everything else that has a mass feels it.
  effect: Moving φ away from the valley's circle costs energy. Moving it round the circle costs none.
lam:
  label: 'λ, the self-coupling'
  what: A dimensionless constant that measures how strongly the field interacts with itself. It multiplies the fourth power of the field and must be positive, otherwise the energy would be unbounded below.
  why: It stops the potential from falling away to minus infinity far from the centre, and it sets how steep the walls of the hat are.
  effect: Once the Higgs mass is measured, λ = mH²/(2v²) = 0.129, small enough that calculations in powers of λ converge.
```
:::

Every term of this potential has the same symmetry: replacing $\phi$ by $e^{i\theta}\phi$ for any angle θ changes nothing, because $|\phi|$ does not change. For $\mu^2 < 0$ the potential is a bowl and its lowest point is $\phi = 0$, which is also symmetric. For $\mu^2 > 0$ the point $\phi = 0$ is at the top of a hill. The lowest energy is on the circle

$$|\phi|^2 = \frac{\mu^2}{2\lambda} = \frac{v^2}{2}.$$

The vacuum is the state of lowest energy, so in the vacuum the field sits *somewhere on this circle*. Which point is arbitrary, and every point is equivalent, but it has to be one of them, and once it is chosen the rotational symmetry of the vacuum is gone. The constant $v = \mu/\sqrt\lambda$ is the :term[vacuum expectation value]{id=vacuum-expectation-value} of the field, written "vev": the value the field has in empty space. It is measured, and it is large:

$$v = (\sqrt2\,G_F)^{-1/2} = 246.22\ \text{GeV}.$$

The second form is not a definition but a measurement. Fermi's constant $G_F$ (Chapter 22) is the strength of the weak force at low energy, and it is known to a part in $10^6$ from the muon's lifetime. In the theory it equals $1/(\sqrt2 v^2)$, so the muon's lifetime tells you $v$. The Higgs field, unlike every other field in the Standard Model, is not zero in empty space, and the scale of its value, 246 GeV, is the only scale in the electroweak theory.

```predict
q: 'A ball rests at a point in the valley of the hat (the circle of lowest energy). You give it a small push. Which statement is right?'
options:
  - text: Every direction of push makes it oscillate, at the same frequency, about the point where it started.
    why: 'Only a push up the side of the hat (across the valley) meets a restoring force. A push along the valley meets none, because the valley is level all the way round.'
  - text: A push across the valley makes it oscillate; a push along the valley makes it drift round the circle with no restoring force.
    correct: true
    why: 'The curvature of the potential is large across the valley and zero along it. The first motion is a massive mode (the Higgs boson); the second is a massless one (a Goldstone boson). The figure shows both, and the next section explains why the second one matters.'
  - text: Nothing oscillates, because the ball is at the lowest point and there is no force.
    why: 'There is no force at the lowest point, but a push sends the ball away from it, and the shape of the valley then decides what happens. Across the valley the ball is pulled back.'
```

::mexican-hat{n="26.1" caption="The Mexican hat, V(φ) = −μ²|φ|² + λ|φ|⁴, with a damped ball on it (real parameters: v = 246.22 GeV, λ = 0.129). Start at the top, where the ball is balanced and the symmetry holds: it rolls off in an arbitrary direction. Kick it across the valley (radial) and it oscillates, which is the Higgs boson; kick it along the valley (angular) and it keeps going, which is the Goldstone mode. Slide the strength of the hat through zero and the valley disappears: the symmetric phase."}

## Goldstone's massless boson, and how to get rid of it

The two kinds of motion in the figure are the two kinds of excitation of the field. Write the field near the valley as $\phi = (v + h)\,e^{i\theta}/\sqrt2$, with $h$ the distance from the circle and $\theta$ the angle round it. Substituting into the potential, the $h$ field has a mass and the $\theta$ field has none:

$$m_h^2 = 2\lambda v^2 = 2\mu^2, \qquad m_\theta^2 = 0.$$

A quantum of $h$ is a particle with a mass, and it is the :term[Higgs boson]{id=higgs-boson}. A quantum of $\theta$ is a massless spin-0 particle, a :term[Goldstone boson]{id=goldstone-boson}. Jeffrey Goldstone showed in 1961 that this is a general rule: whenever a continuous symmetry of the laws is broken by the state, there is a massless particle for each broken direction.:cite[goldstone1961] Nothing has to be added; it is forced by the broken symmetry.

On its own this would be a disaster. The massless Goldstones have never been seen, and a theory in which the symmetry were merely broken would predict them. The resolution is what happens when the broken symmetry is a **gauge** symmetry. In a gauge theory the field $\theta$ is not a separate physical particle, because a gauge transformation can rotate it away: the angle round the valley is the very thing the gauge symmetry allows you to choose differently at each point. The degree of freedom does not vanish. The gauge boson absorbs it.

Count degrees of freedom. A massless spin-1 particle such as the photon has two polarisation states (the electric field can point in either of two directions perpendicular to the motion). A massive spin-1 particle has three: it can also be polarised along its direction of motion, a :term[longitudinal polarisation]{id=longitudinal-polarisation}. The Goldstone boson supplies that third state. The gauge boson "eats" the Goldstone and becomes massive, and the angle $\theta$ has become the extra polarisation of a particle that now has mass. The physical content is conserved: a massless vector plus a massless scalar becomes a massive vector.

The real Higgs field has four real components (a complex doublet under SU(2), $\phi = (\phi^+, \phi^0)$). The electroweak symmetry, SU(2)×U(1), has four generators, and the vacuum leaves one combination of them unbroken: the one that is electric charge, because the vacuum must not carry charge (a charged vacuum would make the photon massive). Three symmetries are broken, so there are three Goldstone bosons, and they are absorbed by exactly the three particles that get a mass: $W^+$, $W^-$ and $Z$. One real component is left over. It is the Higgs boson. The photon stays massless because the symmetry that protects it is untouched.

| Field content before | After the vacuum picks a point | Particle | Mass |
|---|---|---|---|
| 4 real components of the Higgs doublet | 3 become the longitudinal states of W⁺, W⁻, Z | W⁺, W⁻, Z | 80.37, 80.37, 91.19 GeV |
| | 1 is the radial excitation | Higgs boson H | 125.2 GeV |
| W¹, W², W³, B (two polarisations each) | W⁺, W⁻, Z (three each); the combination that remains is the photon (two) | γ | 0 |

### The masses of the W and the Z

The price of the new field is that it couples to the gauge fields, through the same covariant derivative that Chapter 17 used to make the theory symmetric. Put the vacuum value of the field into the kinetic term $|D_\mu\phi|^2$ and there appear terms that look exactly like mass terms for the gauge bosons. They are not added by hand; they come from the field's value, and the symmetry is intact at the level of the Lagrangian, because the original expression is invariant and only the *solution* is not. With $g$ the coupling of SU(2) and $g'$ that of U(1):

:::equation{#vmass caption="The W and Z masses follow from the vacuum value of the Higgs field and the gauge couplings."}
$$\term{mW}{m_W} = \tfrac12\,\term{g}{g}\,\term{v}{v}, \qquad \term{mZ}{m_Z} = \tfrac12\,\sqrt{g^2 + \term{gp}{g'}^2}\;v = \frac{m_W}{\cos\theta_W}$$

```terms
mW:
  label: 'mW, the W boson mass'
  what: The mass of the W⁺ and of the W⁻, 80.369 GeV.
  why: It is the coupling of the W to the vacuum value of the Higgs field. A W is heavy to the extent that it interacts with the field's vacuum value.
  effect: Doubling v at fixed g doubles the mass. The range of the weak force, ħc/(mW c²), is 2.5 × 10⁻¹⁸ m.
g:
  label: 'g, the SU(2) coupling'
  what: The strength with which the W fields couple to left-handed fermions. It is related to the electric charge by e = g sin θW.
  why: The gauge boson's mass is the product of how strongly it couples to the Higgs field and the field's size.
  effect: With e and sin²θW from Chapter 23, g = 0.649 at the Z mass. The value inferred from the measured mW is 0.653, the small difference coming from loop corrections.
v:
  label: 'v, the vacuum expectation value'
  what: The value of the Higgs field in empty space, 246.22 GeV.
  why: It is the one scale of the electroweak theory. Every mass that comes from the Higgs mechanism is a dimensionless coupling times v.
  effect: Measured from the muon lifetime, v = (√2 GF)^(−1/2).
mZ:
  label: 'mZ, the Z boson mass'
  what: The mass of the Z boson, 91.188 GeV.
  why: The Z is the combination of W³ and B that does not couple to electric charge, so its mass involves both couplings.
  effect: It is heavier than the W by the factor 1/cos θW, about 13 %.
gp:
  label: "g′, the U(1) coupling"
  what: The strength of the hypercharge field B's coupling to fermions.
  why: The Z mixes the SU(2) and U(1) fields, and so its mass depends on both couplings.
  effect: With g and g′ fixed by the measured masses, the weak mixing angle is tan θW = g′/g.
```
:::

The photon is the orthogonal combination of $W^3$ and $B$, and its mass is exactly zero, because the Higgs vacuum value is neutral. The ratio $m_W/m_Z = \cos\theta_W$ is a **prediction** of the simplest version of the mechanism, in which the Higgs is a doublet. Chapter 23 measured $\sin^2\theta_W$ from neutral-current scattering and then predicted the W and Z masses from it; the 1983 discoveries confirmed those predictions, and the ratio of the measured masses still gives $\sin^2\theta_W = 1 - (m_W/m_Z)^2 = 0.2232$.

:::deeper[From |Dφ|² to the mass terms]
Take the Higgs doublet in the gauge where the three Goldstone components have been rotated away, $\phi = (0,\,(v + h)/\sqrt2)^T$. The covariant derivative is $D_\mu = \partial_\mu - i\tfrac{g}{2}\tau^a W^a_\mu - i\tfrac{g'}{2}B_\mu$, where $\tau^a$ are the Pauli matrices and the hypercharge of the doublet is 1. For the lower component,

$$|D_\mu\phi|^2 = \tfrac12(\partial h)^2 + \frac{(v+h)^2}{8}\left[ g^2\left(W^1_\mu W^{1\mu} + W^2_\mu W^{2\mu}\right) + \left(g W^3_\mu - g' B_\mu\right)^2 \right].$$

Define $W^\pm = (W^1 \mp i W^2)/\sqrt2$ and $Z = (gW^3 - g'B)/\sqrt{g^2+g'^2}$. Then the bracket times $v^2/8$ is $\tfrac{g^2v^2}{4}W^+_\mu W^{-\mu} + \tfrac12\cdot\tfrac{(g^2+g'^2)v^2}{4}Z_\mu Z^\mu$. Comparing with the standard form $m_W^2 W^+W^- + \tfrac12 m_Z^2 ZZ$ gives $m_W = gv/2$ and $m_Z = \sqrt{g^2+g'^2}\,v/2$. The orthogonal combination $A \propto g'W^3 + gB$ does not appear: it is massless.

The same expression contains the Higgs boson's couplings to the W and Z. Expanding $(v+h)^2 = v^2 + 2vh + h^2$, the term linear in $h$ is $\frac{g^2 v}{4} h\,W^+W^- \cdot 2$ in the normalisation above, that is $\frac{2m_W^2}{v}\,h\,W^+_\mu W^{-\mu}$, and $\frac{m_Z^2}{v}\,h\,Z_\mu Z^\mu$ for the Z. The coupling of the Higgs boson to a gauge boson is proportional to the **square** of that boson's mass, divided by $v$.
:::

A quick check that the numbers are not arbitrary. The code in the library computes the electromagnetic coupling at the Z mass, $\alpha(m_Z) = 1/128.96$, so $e = \sqrt{4\pi\alpha} = 0.3134$, and the effective weak mixing angle $\sin^2\theta_W = 0.2315$. Then $g = e/\sin\theta_W = 0.649$ and $m_W = g v/2 = 79.9$ GeV, against the measured 80.37 GeV: a difference of 0.6 %. Nothing has been fitted. The remaining difference is the size of the loop corrections that Chapter 23 described, and its precise value is one of the most sensitive tests of the whole framework.

```numeric
id: g-from-mw
title: The SU(2) coupling from the W mass
prompt: Using mW = gv/2 with mW = 80.369 GeV and v = 246.22 GeV, what is g?
answer: 0.6528
unit: ''
tolerance: 0.005
hints:
  - Solve for g, g = 2 mW / v.
explain: 'g = 2 × 80.369 / 246.22 = 0.6528. Dividing e = 0.3134 by this gives sin θW = 0.480, so sin²θW = 0.230 from the mass alone, close to the value measured at the Z pole.'
```

### Why the W needs the Higgs: a hint from unitarity

There is a second, independent argument that something like the Higgs boson has to exist, and it is the reason the LHC was designed with its energy. The longitudinal polarisation of a W has a vector that grows with the W's energy: for a W of energy $E$ and mass $m$ the polarisation vector is about $E/m$ in size. Scattering longitudinal W's off each other then gives an amplitude that grows as the square of the energy, $E^2/v^2$. A probability cannot exceed 1, and this growth would violate the bound (:term[unitarity]{id=unitarity}) at energies of order a TeV. A theory that only had the W and Z, with masses added by hand, would stop making sense there.

In the Higgs mechanism the longitudinal W *is* the Goldstone boson, and at high energy it behaves like one. The diagrams that exchange the Higgs boson cancel the growing term. In 1977 Benjamin Lee, Chris Quigg and Harry Thacker turned this into a bound: if the Higgs boson is the only thing doing the cancelling, it cannot be heavier than about a TeV, or the scattering becomes strong there anyway.:cite[leequiggthacker1977] Their condition gives $m_H^2 \lesssim 8\pi\sqrt2/(3G_F)$, which is 1.0 TeV, or 710 GeV if the amplitude is required to stay below one half, the usual stricter form. The argument says that **either** a Higgs boson, **or** something else that restores unitarity, has to appear below about a TeV. It is one of the arguments for building a collider that could reach the TeV scale.

## The Higgs boson

The Higgs boson is what is left of the field. It is neutral, has no spin, and is its own antiparticle. Its mass is not predicted: $m_H = \sqrt{2\lambda}\,v$, and $\lambda$ is a free parameter, which is why it had to be looked for over a range of masses. Its measured value, 125.2 GeV, fixes $\lambda = m_H^2/(2v^2) = 0.129$ and $\mu = m_H/\sqrt2 = 88.5$ GeV. The depth of the hat, $\mu^4/4\lambda = m_H^2 v^2/8$, is $1.19\times10^8$ GeV$^4$, which is about $(104\ \text{GeV})^4$.

The shape of the hat is not free once $m_H$ and $v$ are known. Expanding the potential around the vacuum, with $\phi = (v+h)/\sqrt2$ and $\mu^2 = \lambda v^2$,

$$V(h) = \tfrac12\,m_H^2\,h^2 + \lambda v\,h^3 + \tfrac14\lambda\,h^4 + \text{const}.$$

The first term is the Higgs mass. The second and third are the Higgs boson interacting with itself: a Higgs can split into two, or two scatter. Both strengths follow from $m_H$ and $v$ alone, so **the Standard Model predicts the self-coupling** of the Higgs boson. Whether it is right is one of the open questions that Chapter 30 returns to, and it is the only test of the shape of the potential that is not the *existence* of the hat.

::potential-slice{n="26.2" caption="The potential along the real direction, seen from the vacuum at h = 0 (real numbers: m_H = 125.2 GeV, v = 246.22 GeV). The white curve is the sum of the three terms; switch on the pieces to see them. The parabola is the Higgs mass, the cubic term makes the curve steeper on the right than on the left, and the quartic term closes the walls. The second valley, on the left, is the same vacuum seen at the opposite point of the brim of the hat. The dashed vertical line at h = −v is φ = 0, the top of the hat."}

### Couplings are proportional to mass

The Higgs field has a value everywhere, and every particle that gets its mass from it couples to the boson $h$ in proportion to that mass. Two rules cover the whole Standard Model. For a fermion of mass $m_f$ the coupling is $m_f/v$. For a gauge boson it is $2m_V^2/v$. The heavier the particle, the stronger the coupling, and this is what the experiments test: the Higgs boson decays to the heaviest particle that is light enough, and it does not decay to the electron, in any measurable number.

## Fermion masses: the Yukawa terms

A fermion's mass term is forbidden because it joins a doublet to a singlet. But the Higgs field is a doublet. The product of a left-handed doublet $\bar\psi_L$, the Higgs doublet $\phi$ and a right-handed singlet $\psi_R$ is invariant under SU(2): the doublet in $\phi$ absorbs the doublet in $\psi_L$. The term is

$$-\,y_f\,\bar\psi_L\,\phi\,\psi_R + \text{(the Hermitian conjugate)},$$

and the coupling $y_f$ is called a :term[Yukawa coupling]{id=yukawa-coupling}, after Hideki Yukawa's idea (Chapter 14) that particles interact by exchanging a scalar field. (For the up-type quarks the same construction uses the charge-conjugate of the doublet.) When $\phi$ is replaced by its vacuum value, the term becomes a mass term:

:::equation{#yukawa caption="A fermion's mass is its Yukawa coupling times the vacuum value of the Higgs field, divided by √2."}
$$\term{mf}{m_f} = \frac{\term{y}{y_f}\,\term{v2}{v}}{\sqrt2}, \qquad\text{so}\qquad y_f = \frac{\sqrt2\,m_f}{v}$$

```terms
mf:
  label: 'm_f, the fermion mass'
  what: The mass of an electron, a quark or another fermion. Measured, and listed in the particle table.
  why: It is the coefficient of ψ̄ψ once the Higgs field takes its vacuum value, and so it is the energy of the fermion at rest.
  effect: The top quark is 172.6 GeV and the electron 0.511 MeV. The ratio is 3.4 × 10⁵.
y:
  label: 'y_f, the Yukawa coupling'
  what: A dimensionless number, one for each fermion, that measures how strongly the fermion couples to the Higgs field.
  why: It is a free parameter of the Standard Model, because the theory has no equation that gives it. Each of these is a separate measured number.
  effect: The top quark has y ≈ 0.99, of order 1. The electron has 2.9 × 10⁻⁶.
v2:
  label: 'v, the vacuum expectation value'
  what: 246.22 GeV, the same constant as in the W mass.
  why: The Yukawa coupling multiplies the field, and the field has the value v/√2 in the vacuum.
  effect: "A fixed scale. Every fermion mass in the Standard Model is a pure number times 174 GeV."
```
:::

This is a real change from what came before. The theory now contains a separate number for every fermion mass, each of which the theory itself cannot calculate. The electron has $y = 2.9\times10^{-6}$, the muon $6.1\times10^{-4}$, the tau $1.0\times10^{-2}$, the bottom quark $2.4\times10^{-2}$, and the top quark $0.991$. All but the last are small, and the top Yukawa is so close to 1 that many physicists suspect it means something. The Higgs mechanism gives a way to *have* masses. It says nothing about *why* the electron is lighter than the top by a factor of 340,000, and it is silent about the pattern of the three generations. That is the flavour puzzle, and it is unsolved (Chapter 32).

::mass-spectrum{n="26.3" caption="Every mass in the Standard Model on one logarithmic axis, from the course's particle table. Each fermion mass is a measured input; the W, Z and Higgs masses follow from g, g′, λ and v. The bottom scale shows the Yukawa coupling y = √2 m/v that would give a fermion that mass. The neutrinos are a band, not a measurement: the lightest is unknown, and the heaviest is at least about 0.05 eV from oscillations and at most about 0.8 eV from direct limits. The Standard Model as presented here gives them no mass at all, and Chapter 31 returns to them."}

:::warning
The Higgs mechanism explains the masses of the **fundamental** particles. It does not explain most of the mass of ordinary matter. A proton has a mass of 938 MeV, but its three valence quarks (up, up, down) have masses that add to 9 MeV, about 1 %. Nearly all the rest is the energy of the gluon field and of the quarks' motion inside the proton, which is QCD (Chapter 18). The proton's mass does depend on the quark masses, but only at the level of a few per cent. Switching the Higgs field off would leave protons and neutrons almost as heavy, while it would leave the electron, which gets all its mass from the Higgs field, massless.
:::

## The superconductor analogy, and what it is an analogy for

The idea did not come from nowhere. In a superconductor, pairs of electrons condense into a single quantum state that fills the material. That state breaks the gauge symmetry of electromagnetism (the phase of the condensate has a preferred value), and it has a consequence that experimenters had known for thirty years before the theory caught up: a magnetic field cannot penetrate a superconductor beyond a thin layer, of the order of tens of nanometres. The field is expelled, which is the Meissner effect.

In the language of this chapter, the magnetic field has a finite range inside the superconductor, and a force with a finite range is carried by a massive particle (Chapter 14: range $= \hbar c/mc^2$). The photon has acquired a mass **inside the material**. With a penetration depth of 50 nm, the photon's effective mass is $197.3\ \text{MeV fm}/5\times10^7\ \text{fm} \approx 4$ eV. Nothing has been added to electromagnetism: the photon field has absorbed a Goldstone-like mode of the condensate, exactly as the W and Z absorb the Higgs field's three Goldstones. Yoichiro Nambu analysed the broken gauge symmetry of the superconductor in 1960, and Philip Anderson pointed out in 1963 that the same thing could happen to a relativistic gauge field in the vacuum.:cite[nambu1960,anderson1963]

It is worth being exact about what the analogy does and does not say. The analogy is **about the mechanism**: a condensate that breaks a gauge symmetry gives a gauge field a mass and a finite range, without breaking the symmetry of the laws. It is **not** an analogy for how particles feel the field. You will sometimes read that particles acquire mass by "wading through" the Higgs field like a body in treacle. That is a different picture and it is wrong in the one respect that matters: a medium that resisted motion would slow particles down, and the vacuum's Higgs field does not exert drag. A particle that feels the field moves at a constant velocity, as it would with no field, but its dynamics are those of something with a mass. The superconductor has electrons in it, and a lattice, and a temperature. The Higgs field is the vacuum itself, with no material behind it.

```fermi
id: weak-range
title: How far does the weak force reach?
prompt: A force carried by a particle of mass m has a range of about ħc/(mc²) (Chapter 14). Using mW = 80.4 GeV and ħc = 0.1973 GeV·fm, estimate the range of the weak force, in metres.
answer: 2.455e-18
unit: m
factor: 3
hints:
  - ħc/m = 0.1973 GeV·fm / 80.4 GeV, in femtometres. Then 1 fm = 10⁻¹⁵ m.
explain: "0.1973 / 80.4 = 2.45 × 10⁻³ fm = 2.5 × 10⁻¹⁸ m. That is about 1/340 of the proton's radius (0.84 fm), and explains why the weak force is weak at the energies of nuclear physics. A process at 1 GeV does not resolve this distance and sees only a contact interaction of strength GF, the constant of Fermi's theory. GF/√2 = g²/(8 mW²) is the same statement: the W's mass sets the strength at low energy."
```

:::history{year=1964 title="Three papers in three months" people="Robert Brout, François Englert, Peter Higgs, Gerald Guralnik, Carl Hagen, Tom Kibble" source="Sources: Englert and Brout (1964); Higgs (1964a, 1964b); Guralnik, Hagen and Kibble (1964); Anderson (1963); Nambu (1960)."}
In 1964 three groups published, within about three months of each other in the same journal, the mechanism that gives gauge bosons mass without breaking the gauge symmetry. François Englert and Robert Brout's paper was published on 31 August 1964 in *Physical Review Letters* 13, 321.:cite[englert1964] Peter Higgs, working in Edinburgh, had first published a short paper in *Physics Letters* on how the Goldstone bosons could be removed in a gauge theory,:cite[higgs1964a] and a second, in *Physical Review Letters* 13, 508, which appeared on 19 October and which states explicitly that the theory predicts a massive scalar particle.:cite[higgs1964b] Gerald Guralnik, Carl Hagen and Tom Kibble at Imperial College published on 16 November, in the same volume, page 585.:cite[guralnik1964] The three papers reached the mechanism by somewhat different routes, and they are usually taken together. The massive scalar, the particle that came to bear Higgs's name, is the one that the Higgs paper spells out.

The prize for the discovery of the particle went to Englert and Higgs in 2013 (Chapter 30); Brout had died in 2011 and the prize is not awarded posthumously. The mechanism had to wait for two more steps before it was a theory of the weak force: Steven Weinberg (1967) and Abdus Salam (1968) applied it to the electroweak group and the leptons,:cite[weinberg1967] and Gerard 't Hooft and Martinus Veltman proved in 1971–72 that the broken theory is renormalisable (Chapter 23).:cite[thooft1971,thooftveltman1972] The superconductor had been the precedent all along: Nambu's 1960 paper and Anderson's 1963 paper describe the same phenomenon in the language of condensed matter, and the authors of the 1964 papers knew it.
:::

:::programmer
Spontaneous symmetry breaking is an old pattern in computing. A random-number generator whose algorithm treats all seeds alike is **symmetric**: no seed is special. A run of it, however, **has** a seed, and the run is not symmetric. Nothing in the algorithm chose the seed, and any other would have been equally valid. The vacuum is a run of the laws of physics: the symmetry belongs to the algorithm, and the state is one seed.

The other half of the story is **gauge fixing**. The three Goldstone components can be rotated away by a choice of variables, leaving $\phi = (0, (v+h)/\sqrt2)$: the **unitary gauge**, the physicist's name for a canonical form. A calculation is easier to do in it, all the physical particles are manifest, and the answer does not depend on the choice, in the way the result of a program does not depend on whether a polynomial is held as coefficients or as values at points. The photon's mass being zero in it is a sign that the choice is consistent and not that the symmetry is gone.
:::

:::hood[The ball on the hat, in code]
The figure does not use a pre-drawn animation. The ball's motion is integrated by `HatBall` in `src/lib/hep/fields/higgs.ts`, in dimensionless variables (the position $z = \phi/(v_0/\sqrt2)$, so that the brim is at $|z| = 1$, and time in units of $1/m_H$). The potential is $U(z) = |z|^4/4 - s|z|^2/2$, where $s = \mu^2/\mu_0^2$ is the strength of the hat (negative for a bowl), so the acceleration is $\ddot z = \tfrac12(s - |z|^2)\,z - \gamma\dot z$: a force that points outwards where $|z|^2 < s$ and inwards beyond. The integrator is a velocity-Verlet step, with the friction applied as a half-step factor on each side, so that with no friction it is the ordinary velocity-Verlet step:

```ts
step(dt: number): void {
  const d = Math.exp((-this.gamma * dt) / 2);
  this.vre *= d;  this.vim *= d;                     // half a step of friction
  let [ax, ay] = this.acc(this.re, this.im);
  this.vre += 0.5 * dt * ax;  this.vim += 0.5 * dt * ay;   // half kick
  this.re += dt * this.vre;   this.im += dt * this.vim;    // drift
  [ax, ay] = this.acc(this.re, this.im);
  this.vre += 0.5 * dt * ax;  this.vim += 0.5 * dt * ay;   // half kick
  this.vre *= d;  this.vim *= d;                     // half a step of friction
}
```

Two checks are in the tests. A ball started at the top and left alone settles on the circle $|z|^2 = s$, at a random angle, because its start was slightly off-centre. And radial oscillations at $s = 1$ have angular frequency 1 in these units, which is the statement that they oscillate at $m_H$, while round the valley the restoring force vanishes (the Goldstone mode).
:::

:::experiments
The Higgs sector enters every Monte Carlo generator as two numbers. **Pythia** and **MadGraph5_aMC@NLO** (the two generators most used by ATLAS and CMS, Chapter 0) take the Higgs mass and a choice of **input scheme** for the electroweak parameters. The common one starts from $G_F$, $m_Z$ and the electromagnetic coupling, and computes the rest, including $v$ and $m_W$, at tree level, exactly as this chapter did; different schemes differ by higher-order terms, and the spread between them is one of the uncertainties quoted on predictions. The course's `hep/sm` module does the same: $v$ is computed from $G_F$ and the W mass from the gauge couplings. The couplings of the Higgs boson to the W, the Z and each fermion, which this chapter derived, are what ATLAS and CMS measure in Chapter 30, and the single most precise test of the framework so far is the **ratio** of the W and Z masses to the measured weak mixing angle.
:::

```quiz
q: 'How many of the four real components of the Higgs doublet are absorbed by the W and Z bosons?'
options:
  - text: One, the radial one, which becomes the Higgs boson.
    why: 'The radial component is the one that is not absorbed. It is the Higgs boson.'
  - text: Three, one for each of W⁺, W⁻ and Z, which gain a longitudinal polarisation each.
    correct: true
    why: 'Three of the four symmetries are broken (SU(2)×U(1) has four generators and electric charge is unbroken), so there are three Goldstones, and each is eaten by one of the three massive gauge bosons. The fourth component is the Higgs boson. The photon keeps two polarisations.'
  - text: All four, and the Higgs boson is something else.
    why: 'There would be nothing left. The Higgs boson is the radial excitation of the same field, and it is what the absorption does not remove.'
```

```numeric
id: v-from-gf
title: The vacuum value from the muon lifetime
prompt: 'The muon lifetime gives Fermi’s constant, GF = 1.1664 × 10⁻⁵ GeV⁻². Compute v = (√2 GF)^(−1/2), in GeV.'
answer: 246.22
unit: GeV
tolerance: 0.001
hints:
  - 'First √2 × GF = 1.6495 × 10⁻⁵ GeV⁻². Then take the inverse square root.'
explain: 'v = (1.4142 × 1.1664 × 10⁻⁵)^(−1/2) GeV = (1.6495 × 10⁻⁵)^(−1/2) = 246.2 GeV. A measurement of how long a muon lives, in a laboratory, is a measurement of the vacuum value of a field.'
```

```numeric
id: top-yukawa
title: The top quark's Yukawa coupling
prompt: 'With mt = 172.57 GeV and v = 246.22 GeV, compute yt = √2 mt/v.'
answer: 0.9912
unit: ''
tolerance: 0.005
hints:
  - 'y = √2 × 172.57 / 246.22.'
explain: 'y_t = 1.4142 × 172.57 / 246.22 = 0.991. It is the only fermion whose coupling to the Higgs field is of order 1. Chapter 30 uses the top quark again: the Higgs boson is produced mostly through a loop of top quarks, and its coupling to the top can be measured through the process ttH.'
```

## What comes next

The Higgs boson exists if this chapter is right, and the mechanism is a prediction: a particle of spin 0, neutral, with couplings proportional to mass and an unknown mass. The next chapters go looking for it. The rate at which a Higgs boson is produced in a proton–proton collision is about one in a few billion, and [Chapter 27](/chapters/a-needle-in-a-haystack/) asks how a detector that can record a thousand events a second finds those. [Chapter 28](/chapters/the-statistics-of-discovery/) asks how to tell a small excess from a fluctuation. [Chapter 29](/chapters/finding-the-higgs/) runs the whole pipeline to find the peak at 125 GeV, and [Chapter 30](/chapters/measuring-the-higgs/) measures what the boson does once it has been found.

## Further reading

- The three 1964 papers: Englert and Brout; Higgs; Guralnik, Hagen and Kibble (:cite[englert1964,higgs1964b,guralnik1964]). They are short and readable.
- Nambu's 1960 paper and Anderson's 1963 paper, for the superconductor side (:cite[nambu1960,anderson1963]).
- Lee, Quigg and Thacker on the Higgs mass and unitarity (:cite[leequiggthacker1977]).
- The Particle Data Group's *Review of Particle Physics*, which has a review of the Higgs boson and the electroweak model with current values (:cite[pdg2024]).
