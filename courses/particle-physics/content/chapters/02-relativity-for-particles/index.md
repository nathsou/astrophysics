---
number: 2
title: Relativity for particles
summary: Four-momenta, invariant mass, boosts and detector coordinates, and a first look at real muon pairs from the LHC, in which peaks appear that no one has told you about yet.
duration: About 2 hours
prerequisites: [scales-and-units]
---

Here is a picture to look at before anything is explained. It shows 100,000 real collisions recorded by the CMS experiment at the Large Hadron Collider in 2011. Each collision produced two muons (heavy cousins of the electron, introduced in Chapter 3), and for each pair the picture plots one number on a logarithmic axis. The computation that produces that number is this chapter's subject.

::dimuon-map{n="2.1" caption="The invariant mass of 100,000 pairs of muons, from 0.3 to 300 GeV. Nothing is labelled yet. Hover to read a bin. The narrow spikes and broad humps are particles, and the reader can name none of them yet. By Chapter 24 every spike will have a name. The broad hump between 8 and 20 GeV is mostly an artefact of how these events were selected, which Chapter 27 investigates."}

If the muons were produced independently of each other, this histogram would be a smooth falling curve. It is not. There are spikes (one near 3 GeV, a cluster near 10 GeV, a tall narrow one near 91 GeV), and something that looks like a bump near 1 GeV. Each spike is a particle that existed for a fraction of a yoctosecond (10⁻²⁴ s), decayed into the two muons you see, and left its mass behind in the pair. Particle physics is, to a surprising degree, the art of reading such histograms.

The number on the horizontal axis is the **invariant mass** of the pair, and it is computed from what the detector measured: the energy and momentum of each muon. To see why that combination reveals the mass of something that left no track, we need the parts of special relativity that particle physicists use every day. They fit in a few pages.

## Energy and momentum are one thing

Newton gave a moving particle an energy ½*mv*² and a momentum *mv*. Einstein's relativity (1905) replaces both with a single four-component object, the **four-momentum**,

$$p = (E,\; p_x,\; p_y,\; p_z),$$

in which the first component is the energy and the other three are the ordinary momentum. The four numbers change together when you change your frame of reference, in the way the coordinates of a point change when you rotate your axes. There is one combination that does *not* change, the way the length of a vector does not change under rotation. In natural units (Chapter 1, with *c* = 1, so that energy, momentum and mass are all measured in GeV), it is

:::equation{#mass-shell caption="The mass is the invariant length of the four-momentum. It is the same in every frame."}
$$\term{m}{m}^2 = \term{E}{E}^2 - \term{p}{|\vec p|}^2 = \term{E}{E}^2 - p_x^2 - p_y^2 - p_z^2$$

```terms
m:
  label: 'm, the mass'
  what: The mass of the particle, measured in GeV (more precisely GeV/c², but in natural units the c drops out). It is the energy the particle has when it is at rest.
  why: It is the one property of the four-momentum that every observer agrees on, however fast they move. That is what makes it a property of the particle rather than of the observation.
  effect: The muon's mass is 0.1057 GeV, the proton's 0.938 GeV and the Z boson's 91.19 GeV.
E:
  label: 'E, the total energy'
  what: The energy of the particle, including its rest energy. For a particle at rest, E = m (Einstein's E = mc² with c = 1).
  why: Energy is the time component of the four-momentum, and it is conserved in every collision.
  effect: Raise the momentum at fixed mass and the energy rises with it. For a fast particle, E ≈ |p|.
p:
  label: '|p|, the size of the momentum'
  what: The length of the ordinary three-component momentum, |p| = √(px² + py² + pz²).
  why: It is subtracted from the energy. A particle at rest has none, and then E² = m².
  effect: When |p| is much larger than m the two terms nearly cancel, which is why computing a mass from a high-energy particle's energy and momentum is delicate (see the box on rounding below).
```
:::

This is the sentence to remember: **a particle's mass is the invariant length of its four-momentum**. Everything else in the chapter follows from it. Two special cases are worth knowing. For a particle at rest, *p* = 0 and the equation reads *E* = *m*. For a **massless** particle, such as the photon, *m* = 0 and so *E* = |*p*|; it can only move at the speed of light.

:::history{year=1908 title="Space and time are shadows" people="Hermann Minkowski, Albert Einstein" source="Sources: Einstein (1905); Minkowski (1908)."}
Einstein's 1905 paper on the electrodynamics of moving bodies gave the rules for how measurements of space and time change between observers, but it was written in the language of rods and clocks. Three years later his former teacher Hermann Minkowski recast the theory as geometry.

Speaking in Cologne on 21 September 1908, Minkowski announced that "henceforth space by itself, and time by itself, are doomed to fade away into mere shadows, and only a kind of union of the two will preserve an independent reality."[^mink] The combination of energy and momentum into a four-vector, and the invariant length *E*² − |*p*|², is that idea applied to motion. Einstein, it is said, at first dismissed the geometric version as "superfluous learnedness", and then needed it to build general relativity.:cite[einstein1905,minkowski1908]
:::

[^mink]: From the English translation of *Raum und Zeit* by W. Perrett and G. B. Jeffery, in *The Principle of Relativity* (Methuen, 1923).

## The mass of something you did not see

Now the trick. Suppose a particle of mass *M* decays into two daughters, and you can measure the energy and momentum of both. Energy and momentum are conserved, so the four-momenta of the daughters *add up to* the four-momentum of the parent:

$$p_\text{parent} = p_1 + p_2.$$

Take the invariant length of both sides. The parent's length is its mass *M*, and that does not depend on how fast the parent was going. So

:::equation{#invariant-mass caption="The invariant mass of a pair of particles: it equals the mass of whatever they came from."}
$$\term{M}{M}^2 = (\term{E1}{E_1 + E_2})^2 - |\term{p12}{\vec p_1 + \vec p_2}|^2$$

```terms
M:
  label: 'M, the invariant mass of the pair'
  what: The mass of the system formed by the two particles. If the pair came from the decay of one parent, it is that parent's mass.
  why: It is the invariant length of the summed four-momentum, so every observer, in every frame, computes the same number from the same pair.
  effect: For the muon pairs of Figure 2.1, M runs from 0.3 GeV to 300 GeV; peaks in its histogram are parent particles.
E1:
  label: 'E₁ + E₂, the summed energy'
  what: The total energy of the two daughters in whatever frame the detector sits in.
  why: Energy is conserved, so this is the parent's energy in that frame.
  effect: It depends on the frame (the parent may be moving fast). Only the combination with the momentum is invariant.
p12:
  label: 'p₁ + p₂, the summed momentum'
  what: The vector sum of the two three-momenta. Note that it is a vector sum, not a sum of lengths.
  why: Momentum is conserved, so this is the parent's momentum in that frame.
  effect: Two muons flying in nearly the same direction add to a large momentum and need more energy to balance it, so the mass they reveal is small. Two flying apart nearly cancel and give a large mass.
```
:::

The parent's mass has been computed without ever seeing the parent. The two muons of a real pair can be flying in any direction, at any speed, but if they came from one decay their combination comes out the same. That is why the spikes in Figure 2.1 are spikes: pairs that come from a Z boson all have a mass of 91 GeV, however they fly, while pairs from no common parent land wherever they land, in the smooth background.

```predict
q: 'A Z boson (91.19 GeV) decays into two muons. In one event the Z was at rest; in another it was moving at nearly the speed of light along the beam. In which event does the pair of muons have the larger invariant mass?'
options:
  - text: The moving Z, because its muons carry more energy.
    why: 'The muons do carry more energy. But the momentum they carry grows with it, and the formula subtracts it. The invariant mass is the same in every frame, and only the parent’s mass matters.'
  - text: The Z at rest, because nothing is wasted on motion.
    why: 'Nothing is “wasted”: the motion is subtracted out by the momentum term of the formula. Both events give 91.19 GeV.'
  - text: Both give 91.19 GeV.
    correct: true
    why: 'The invariant mass is the length of a four-vector, and a change of frame does not change lengths. This is the whole reason the method works on a detector in which the parent could have any speed.'
```

### Write it yourself

Here is the first piece of code in the course. The library represents a four-vector as a plain object `{ E, px, py, pz }` (type `P4`). Write the function that computes the invariant mass of a pair. Your function will draw Figure 2.1 once it passes: its result is saved, and the figure above switches to it when you tick **use my code**.

```code
id: pair-mass
title: The invariant mass of a pair
hook: kinematics.pairMass
prompt: |
  Implement `pairMass(a, b)` using the formula above: form the summed energy and the summed momentum, and return
  the square root of *E*² − |**p**|². Think about what should happen when the result under the root is very slightly
  negative because of rounding.
starter: |
  import type { P4 } from 'hep';

  export function pairMass(a: P4, b: P4): number {
    // m² = (E₁ + E₂)² − |p₁ + p₂|²
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { pairMass } from 'solution';
  import { fromMass, boost, twoBodyMomentum } from 'hep/kinematics';

  test('a Z at rest decays to two back-to-back muons: 91.19 GeV', () => {
    const k = twoBodyMomentum(91.19, 0.1057, 0.1057);
    const a = fromMass(0.1057, k, 0, 0);
    const b = fromMass(0.1057, -k, 0, 0);
    expect(pairMass(a, b)).toBeCloseTo(91.19, 6);
  });

  test('two photons of 1 GeV at 90° have m = √2 GeV', () => {
    const a = { E: 1, px: 1, py: 0, pz: 0 };
    const b = { E: 1, px: 0, py: 1, pz: 0 };
    expect(pairMass(a, b)).toBeCloseTo(Math.SQRT2, 10);
  });

  test('the answer does not depend on the frame', () => {
    const k = twoBodyMomentum(3.0969, 0.1057, 0.1057);
    const a = fromMass(0.1057, 0.6 * k, 0, 0.8 * k);
    const b = fromMass(0.1057, -0.6 * k, 0, -0.8 * k);
    for (const beta of [0, 0.5, 0.9, 0.999]) {
      expect(pairMass(boost(a, 0, 0, beta), boost(b, 0, 0, beta))).toBeCloseTo(3.0969, 6);
    }
  });

  test('two collinear massless particles have mass zero, and never NaN', () => {
    const a = fromMass(0, 0.3, 0.4, 1.2);
    const b = fromMass(0, 0.75, 1.0, 3.0);
    const m = pairMass(a, b);
    expect(Number.isNaN(m)).toBe(false);
    expect(Math.abs(m)).toBeLessThan(1e-6);
  });
solution: |
  import type { P4 } from 'hep';

  export function pairMass(a: P4, b: P4): number {
    const E = a.E + b.E;
    const px = a.px + b.px;
    const py = a.py + b.py;
    const pz = a.pz + b.pz;
    const m2 = E * E - px * px - py * py - pz * pz;
    // Rounding can make m² a tiny negative number for massless pairs: return a signed root, never NaN.
    return m2 >= 0 ? Math.sqrt(m2) : -Math.sqrt(-m2);
  }
hints:
  - The summed energy is `a.E + b.E`. The summed momentum is a vector sum: add the components first, then square.
  - '`Math.sqrt` of a negative number is `NaN`. A mass that comes out as `NaN` would vanish from a histogram without a warning.'
```

:::programmer
A four-vector is an ordinary data structure with a **checksum** built into the physics: the invariant mass is a function of the four numbers that every correct reconstruction must agree on. If you compute *m* in the lab frame and in the parent's rest frame and get different answers, you have a bug, not a discovery. Particle-physics code is full of such checks, and this one will test every generator, detector and boost in the course.
:::

## Boosts: the same event from different frames

A **boost** is the change of reference frame that Einstein's rules describe for an observer moving at a steady velocity. For a boost along *z* with velocity β (a fraction of the speed of light), and γ = 1/√(1 − β²), the four-momentum transforms as

$$E' = \gamma(E - \beta p_z), \qquad p_z' = \gamma(p_z - \beta E), \qquad p_x' = p_x,\quad p_y' = p_y.$$

The energy and the momentum along the boost mix, exactly as the two coordinates of a point mix under a rotation; the components across the boost are untouched. You can check that *E*² − |**p**|² is the same before and after.

The figure below runs the decay both ways. In the rest frame of the parent the two muons fly back to back, each with the same energy; the parent is then given momentum along the beam, and the muons, seen from the lab, are squeezed into a forward cone. Move the sliders and watch the two numbers that change (the energies, the opening angle) and the one that does not.

::two-body-boost{n="2.2" caption="A Z, a J/ψ or a Υ decays to two muons. Raise the parent's momentum: the muons crowd into the forward direction, their energies and opening angle change, and the invariant mass of the pair does not (it is exactly the parent's mass, as the method requires). At p_z = 0 the muons are back to back with equal energies."}

The two-body decay has a convenient property. In the rest frame of the parent, the daughters share the energy equally when they have equal masses, and the momentum of each follows from the masses alone:

$$|\vec p^{\,*}| = \frac{\sqrt{\left(M^2 - (m_1+m_2)^2\right)\left(M^2 - (m_1-m_2)^2\right)}}{2M}.$$

For a Z (91.19 GeV) decaying to muons (0.1057 GeV) this is almost exactly *M*/2 = 45.6 GeV: the muons are very nearly massless compared with the parent. The library function `twoBodyMomentum(M, m1, m2)` is this formula, and `twoBodyDecay` picks a random direction for the momentum.

## Where the particles go: detector coordinates

The LHC's beams run along one axis, conventionally *z*. Collisions are not at rest in the lab in any useful sense: the two colliding quarks or gluons inside the protons carry different fractions of their protons' momenta, so the collision is boosted along *z* by an amount that changes from event to event, and is unknown. Detectors are therefore built, and their data described, in variables that behave simply under a boost along *z*:

- **Transverse momentum** *p*<sub>T</sub> = √(*p*<sub>x</sub>² + *p*<sub>y</sub>²), the part of the momentum perpendicular to the beam. A boost along *z* does not change it. The two colliding partons carry no transverse momentum to speak of, so the transverse momenta of everything that comes out add up to (almost) zero, a fact Chapter 23 uses to detect neutrinos that leave no trace.
- **Azimuth** φ, the angle around the beam, from −π to π. Also unchanged by a boost along *z*.
- **Rapidity** *y* = ½ ln((*E* + *p*<sub>z</sub>)/(*E* − *p*<sub>z</sub>)). Under a boost along *z* every particle's rapidity shifts by the same amount, so *differences* in rapidity are invariants. This is the additive form of the velocity addition law.
- **Pseudorapidity** η = −ln tan(θ/2), where θ is the angle from the beam axis. For a particle much lighter than its momentum, η ≈ *y*, but η is computed from the direction alone, which is all a detector can measure cheaply.

The last formula deserves a look. At η = 0 the particle flies at 90° to the beam, straight out of the side of the detector. At η = 1 it is at 40°, at η = 2.5 (the edge of the tracking detectors of CMS and ATLAS) at 9.4°, and at η = 5 less than a degree from the beam. The scale is logarithmic because the collision's particles are spread roughly evenly in rapidity: equal intervals of η hold roughly equal numbers of particles.

The distance between two particles in the detector is measured as Δ*R* = √(Δη² + Δφ²). It is the metric of the next seven chapters: two objects are "close" if their Δ*R* is small. The library has `eta`, `phi`, `pt`, `rapidity` and `deltaR`, and `fromPtEtaPhiM` builds a four-vector from the variables the experiments store.

## Colliders and targets

Does it matter whether the beam hits a fixed target or another beam? Enormously. What is available to make new particles is not the beam's energy, but the energy in the frame in which the collision has no net momentum, the **centre-of-mass frame**. Its total energy is √*s*, where *s* = (*p*₁ + *p*₂)², the squared invariant mass of the colliding pair.

- Two equal beams of energy *E* head-on: *s* = (2*E*)², so √*s* = 2*E*. All of the beam energy is available.
- A beam of energy *E* on a proton at rest: *s* = 2*E* *m*<sub>p</sub> + 2*m*<sub>p</sub>² ≈ 2*E* *m*<sub>p</sub>, so √*s* ≈ √(2*E* *m*<sub>p</sub>). Most of the beam energy is spent on moving the wreckage forward, conserving momentum, and only the square root is left for new particles.

```fermi
id: fixed-target
title: The LHC as a fixed-target machine
prompt: The LHC collides two protons head-on, each of about 6.8 TeV, for a total √s of 13.6 TeV = 13,600 GeV. What energy of proton beam, in GeV, hitting a stationary proton (mass 0.938 GeV) would give the same √s? (Use s ≈ 2 E m_p.)
answer: 9.86e7
unit: GeV
hints:
  - The LHC's √s is 13,600 GeV, so s = 13,600² GeV².
  - Solve s = 2 E m_p for E.
explain: "E = s/(2 m_p) = 13,600² / (2 × 0.938) ≈ 1.0 × 10⁸ GeV, or 10¹⁷ eV. That is a hundred petaelectronvolts. No accelerator on Earth could reach it, while the cosmic rays that strike the atmosphere include a few this energetic (Chapter 10). Colliding beams turn an energy that only nature can reach into one that a ring of magnets can."
```

Colliders have a price, which is paid in Chapter 21: two beams crossing make far fewer collisions per second than one beam in a dense target. A collider wins only if the beams are made extraordinarily dense.

:::experiments
**CMS** (Compact Muon Solenoid) is one of the two general-purpose detectors at the LHC, the ring at **CERN** near Geneva where proton beams collide at 13.6 TeV; Chapter 0 gives the tour. The data in Figure 2.1 are a sample released on the CERN Open Data portal for education, selected from the 2011 data at √s = 7 TeV for events with two muons of opposite charge. In the experiments' software the four-vector is a class, and the same formulas are methods: ROOT's `TLorentzVector` (and its successors), or the `vector` library for Python's Awkward Array. They store (*p*<sub>T</sub>, η, φ, *m*) rather than (*E*, **p**) because those are the quantities the detector measures directly. The toy in this course does the same conversion with `fromPtEtaPhiM`.
:::

## Under the hood: why E² − p² is treacherous

The formula is exact, and on a computer it is not. A double-precision number carries 53 bits, about 16 decimal digits. Take an electron of 6,800 GeV (an LHC proton beam's energy): its mass is 0.000511 GeV, so *E* and |**p**| agree in their first 14 digits: *E* = 6800.0000000000000 000…, and *E*² − |**p**|² = 2.6 × 10⁻⁷ is the tiny difference of two numbers near 4.6 × 10⁷. Subtracting them leaves only two or three correct digits of the mass. In single precision (24 bits, 7 digits, the format that the course's event tables use to save space) the difference is **exactly zero**: the mass has vanished.

```ts
const m = 0.000511, p = 6800;
const E = Math.sqrt(p * p + m * m);
E * E - p * p;            // 2.6077e-7: true value 2.6112e-7, about 0.13 % off, and lucky
(E - p) * (E + p);        // the library's form: it needs no bigger digits than E and p have
```

The library's `mass2` uses (*E* − |**p**|)(*E* + |**p**|) for that reason: each factor is computed first, then the product, which avoids the cancellation of two large squares (the subtraction *E* − |**p**| is exact when the two are within a factor of two, by Sterbenz's lemma). But *E* itself only has 16 digits, so nothing recovers a mass that is hidden below them: the library makes this explicit, and the test suite checks the mass of a 6.8 TeV electron to 1 %, and no better. Real analysis code therefore keeps the mass and the momentum, not the energy, as the stored quantities, and computes *E* only when it needs it.:cite[goldberg1991]

## Reading the map

Go back to Figure 2.1 with the tools you now have. The horizontal axis is an invariant mass, computed by the function you wrote, from the four-momenta that CMS measured. A spike at 91 GeV is a particle with that mass. The table lists the facts to hold on to; Chapter 3 says what kind of object decays in 10⁻²⁴ seconds, and the later chapters name the peaks.

| Quantity | Symbol | Invariant under a boost along *z*? | Used for |
|---|---|---|---|
| Invariant mass of a system | *M* | Yes (a true invariant) | Finding resonances |
| Transverse momentum | *p*<sub>T</sub> | Yes | Selecting hard collisions, balancing events |
| Azimuth | φ | Yes | Direction around the beam |
| Rapidity | *y* | Shifts by a constant | Kinematics of production |
| Pseudorapidity | η | (approximately, for light particles) | Where in the detector |
| Energy, *p*<sub>z</sub> | *E*, *p*<sub>z</sub> | No | Nothing directly: combine into the above |

```numeric
id: z-width-check
title: A mass from two measured muons
prompt: 'A Z boson decays at rest to two muons. One muon is measured with E = 45.60 GeV and momentum 45.60 GeV along +x, treating it as massless for this estimate. What is the energy, in GeV, of the other muon? (Energy conservation for a Z of mass 91.19 GeV at rest.)'
answer: 45.59
unit: GeV
tolerance: 0.005
hints:
  - The Z is at rest, so its energy is its mass, 91.19 GeV.
  - The energy of the second muon is 91.19 minus the first muon's 45.60.
```

## What comes next

You can now turn two measured momenta into the mass of something that vanished, which is what a detector is for. Chapter 3 asks what the things in the spikes are: the quantum mechanics that makes a particle with a *lifetime* and a *width*, why the spikes have widths at all (every spike in the figure has a width, and the widths are physics, not just the detector's blur), and how many of each a collider makes per second. Chapter 13 will label the bumps near 1 GeV, Chapter 23 the spike at 91 GeV, and Chapter 24 the rest.

## Further reading

- Einstein's 1905 paper and Minkowski's 1908 lecture, in the bibliography below.
- The Particle Data Group's *Review of Particle Physics*, section on kinematics, for the full set of formulas (:cite[pdg2024]).
- The CERN Open Data portal's education pages, which offer the same dimuon sample with notebooks (:cite[cms-open-data]).
