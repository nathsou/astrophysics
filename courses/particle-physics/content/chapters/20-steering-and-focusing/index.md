---
number: 20
title: Steering and focusing
summary: Dipoles bend the beam, quadrupoles hold it together. Transfer matrices, the stability condition |Tr M| < 2, FODO cells, the betatron tune and its resonances, and emittance. The reader writes the tracking code that follows a proton round a ring.
duration: About 3 hours
prerequisites: [accelerating-particles]
---

A proton in the LHC that leaves the ideal orbit by an angle of 10 microradians, a hundredth of a milliradian, would travel 27 cm sideways in one turn of the 26.7 km ring if nothing pulled it back. The vacuum pipe has an inner radius of a few centimetres. Real magnets and their alignment are never perfect at the level of 10 µrad, and the protons go round of the order of 10⁸ times in a fill. Yet the beam stays in the pipe, and is a fraction of a millimetre across.

The resolution is that the protons are not kept on the ideal orbit. They oscillate about it, in both transverse directions, about 64 times per turn, and a restoring force that grows with the distance from the orbit keeps each oscillation small. Chapter 19 made a proton's *timing* stable, with a restoring force that comes from the cavity. This chapter makes its *position* stable, with a restoring force that comes from magnets. The mathematics has the same shape, a stable oscillation about a reference with a tune, a map that is iterated round the ring, and a region of stable starting conditions, but it is a different pair of variables, and there are two such pairs, one for each transverse direction.

## Bending: the dipole

A magnetic field *B* perpendicular to a particle's velocity bends its path into a circle of radius ρ, with the magnetic force *qvB* balancing the centripetal force *pv*/ρ. So *p* = *qBρ*. Expressed in the practical units of accelerator physics, for a particle of charge *e*:

:::equation{#rigidity caption="The momentum a magnetic field can hold on a circle. The product Bρ is called the magnetic rigidity."}
$$\term{p}{p}\;[\mathrm{GeV}/c] = 0.2998\;\term{B}{B}\;[\mathrm{T}]\;\term{rho}{\rho}\;[\mathrm{m}]$$

```terms
p:
  label: 'p, the momentum'
  what: 'The momentum of the particle, in GeV/c (natural units: GeV).'
  why: It is what the field has to hold on the circle. Nothing else about the particle matters to the bending of a single magnet, apart from its charge.
  effect: 6,800 GeV/c for an LHC proton in the present runs, and 450 GeV/c at injection.
B:
  label: 'B, the dipole field'
  what: The magnetic field perpendicular to the beam, in tesla.
  why: The stronger the field, the tighter the bend, so the smaller the ring for a given momentum.
  effect: 0.535 T at the LHC's injection and 8.09 T at 6.8 TeV, from the next calculation.
rho:
  label: 'ρ, the bending radius'
  what: The radius of curvature of the orbit inside a dipole, in metres.
  why: 'It is fixed by the layout of the ring: a magnet of length L bends the beam by an angle L/ρ.'
  effect: 2,804 m in the LHC, which is smaller than the ring's mean radius of 4,243 m because dipoles fill only part of the circumference.
```
:::

The number 0.2998 is the speed of light in units of 10⁹ m/s, and it is the rule *p* = 0.3 *BR* of Chapter 5, now used in the other direction: to decide how strong a magnet must be.

The LHC has 1,232 dipole magnets, each 14.3 m long (magnetic length), which together are 17.6 km, 66% of the circumference.:cite[lhc-design] Each bends the beam by 2π/1,232 = 5.1 mrad, which is 0.29°, and the radius is 14.3 m/5.1 mrad = 2,804 m. The field needed at 6.8 TeV follows from the equation.

```numeric
id: lhc-dipole-field
title: The LHC dipole field at 6.8 TeV
prompt: 'The LHC’s bending radius is ρ = 2,804 m (1,232 dipoles of 14.3 m, each bending by 2π/1232). What field, in tesla, holds a proton of 6.8 TeV/c on that radius?'
answer: 8.09
unit: T
tolerance: 0.01
hints:
  - B = p/(0.2998 ρ), with p in GeV/c.
explain: "B = 6,800 / (0.2998 × 2,804) = 8.09 T. The design energy of 7 TeV needs 8.33 T, the figure in the design report, and injection at 450 GeV needs 0.535 T: a dipole at injection runs at 7% of its top field."
```

### Why the field has to be superconducting

An iron-cored electromagnet saturates: above about 2 T the iron can no longer add to the field. At 2 T, a 6.8 TeV ring would need ρ = 11.3 km, a circumference of 71 km if every metre of it were a dipole. The LHC reaches 8 T by winding the coils from a superconductor, niobium–titanium cable, which carries current with no resistance when it is cold enough, and the field is shaped by the coil rather than by iron. The LHC cools the magnets to 1.9 K with superfluid helium, colder than the 2.7 K of the cosmic microwave background, because NbTi at 1.9 K can carry the current density the 8 T coil needs with some margin, and because superfluid helium carries heat away very well.:cite[lhc-design] The two beam pipes share one magnet: each dipole holds both, with the field pointing in opposite directions in the two bores, so that the two counter-rotating beams are both bent towards the centre of the ring.

Fermilab's Tevatron, a proton–antiproton collider that worked from 1983 to 2011, was the first synchrotron to use superconducting magnets.:cite[tevatron-legacy] The upgrade of the LHC for high luminosity (Chapter 21) will use niobium–tin for the quadrupoles next to the collision points, with a peak field of 11 to 12 T.:cite[hllhc-tdr] The rest of this chapter needs only that a dipole provides *B*.

## Why dipoles alone do not hold the beam

A ring made only of dipoles does hold the beam in one plane, but only just. In a uniform field, a proton that starts at a small angle to the ideal orbit moves on a circle of the same radius, displaced from the ideal one, and the two circles cross twice per turn: the proton makes one oscillation about the ideal orbit per turn (the tune is 1). In the vertical plane a uniform field gives no force at all, and a proton with a small vertical angle drifts away in a straight line. The early synchrotrons added a slight fall-off of the field with radius, described by a **field index** *n* between 0 and 1, which makes the field pull the proton back in both planes at once. This is **weak focusing**. It is enough to hold a beam, but the tunes are below 1 (√(1 − *n*) horizontally and √*n* vertically), so an oscillation is longer than the ring, and the beam's envelope is of the order of the ring's radius divided by the tune.

```fermi
id: weak-focusing
title: The LHC with weak focusing
prompt: 'The LHC’s mean radius is R = C/2π = 4,243 m. In a weak-focusing ring with field index n = 0.5, the betatron function is about β = R/Q with Q = √(1 − n) = 0.71. The beam’s rms width goes as √β. The LHC’s real arcs have β between about 30 and 180 m, say 100 m on average. By what factor would the beam be wider with weak focusing?'
answer: 7.7
factor: 2
hints:
  - β with weak focusing is 4,243/0.71 ≈ 6,000 m.
  - The width goes as the square root of β, for the same emittance.
explain: "√(6,000/100) = 7.7. The beam would be some eight times wider, and the magnets' good-field region, vacuum pipe and iron would all have to be eight times wider in each plane. Their cost would go up as the cross-section of the magnet; this is the problem strong focusing solved in 1952. The estimate ignores that the real machine's emittance would differ, and it assumes the same normalised emittance."
```

The fix is to add a force that grows with the distance from the axis, in both planes, and that does not depend on the ring's radius.

## A lens for charged particles: the quadrupole

A :term[quadrupole]{id=quadrupole} magnet has four poles, arranged so that the field is zero on the axis and grows linearly with the distance from it: *B*<sub>y</sub> = *g* *x*, *B*<sub>x</sub> = *g* *y*, where *g* is the field gradient in tesla per metre. A proton moving along *z* with a horizontal displacement *x* feels a force, from *q* **v** × **B**, that is proportional to *x* and points towards the axis if the field has one sign and away from it if it has the other. A proton at vertical displacement *y* feels the opposite: **a quadrupole that focuses in one plane defocuses in the other.** This is not a design defect, it is Maxwell's equations: in free space ∇ × **B** = 0 requires ∂*B*<sub>y</sub>/∂*x* = ∂*B*<sub>x</sub>/∂*y*.

Dividing the gradient by the rigidity gives the **normalised strength** *k* = *g*/(*B*ρ), in m⁻². The equation of motion of a proton in a quadrupole is *x*″ = −*kx* and *y*″ = +*ky*, where the primes are derivatives with respect to the distance *s* along the orbit, and *x*′ = d*x*/d*s* is the slope. The LHC's main quadrupoles have a design gradient of 223 T/m and a length of 3.1 m, and at 7 TeV *k* = 223/23,350 T·m = 0.00955 m⁻² (the rigidity of a 7 TeV proton is 23,350 T·m):cite[lhc-design] so the focal length of one, for a proton that passes through it quickly, is 1/(*kL*) = 34 m.

### Transfer matrices

Because a quadrupole's force is linear in *x*, the state of a proton after a magnet is a linear function of its state before. The state is the pair (*x*, *x*′), and each element of the machine is a 2×2 matrix acting on it:

- a **drift** of length *L* (nothing acts on it): *x* → *x* + *L* *x*′, so **M** = [[1, *L*], [0, 1]];
- a **thin lens** of focal length *f*: the angle changes by −*x*/*f* and the position does not, so **M** = [[1, 0], [−1/*f*, 1]];
- a **thick quadrupole** of strength *k* > 0 and length *L*: a harmonic oscillator with frequency √*k*, **M** = [[cos φ, sin φ/√*k*], [−√*k* sin φ, cos φ]] with φ = √*k* *L*; for *k* < 0, in the plane where it defocuses, the trigonometric functions are replaced by the hyperbolic ones;
- a **dipole** of length *L* and bending radius ρ: a drift in the vertical plane, and in the horizontal plane a weak focusing with *K* = 1/ρ² (tiny for the LHC, but not zero, and the library includes it).

A line of elements is the product of their matrices, with the first element acting first: **M** = **M**<sub>N</sub> ⋯ **M**<sub>2</sub> **M**<sub>1</sub>. A ring is a line whose end is joined to its start, and the **one-turn matrix** is the product over the whole ring. The turn-by-turn motion is then *nothing more* than repeated application: (*x*, *x*′)<sub>n+1</sub> = **M** (*x*, *x*′)<sub>n</sub>. Each matrix has a determinant of 1, which is a statement that the area occupied by a beam in the (*x*, *x*′) plane is preserved, as Liouville's theorem requires, and so the product has a determinant of 1 too.

### When does the motion stay bounded?

After *n* turns the state is **M**<sup>n</sup> applied to the start. Whether it stays bounded depends on the eigenvalues of **M**, which are the roots of λ² − (Tr **M**) λ + 1 = 0 (the last coefficient is the determinant, 1).

:::deeper[Why |Tr M| < 2 is the stability condition]
The two eigenvalues satisfy λ₁λ₂ = det **M** = 1 and λ₁ + λ₂ = Tr **M**.

- If |Tr **M**| < 2, the roots are a complex-conjugate pair with |λ| = 1, so λ = e<sup>±*i*μ</sup> with cos μ = Tr **M**/2. By the Cayley–Hamilton theorem, **M**<sup>n</sup> = (sin *n*μ / sin μ) **M** − (sin (*n*−1)μ / sin μ) **1**, whose entries are bounded by 1/|sin μ| times the entries of **M** and of **1**. The motion is bounded: an oscillation, by μ in phase every turn. The angle μ is the **phase advance per turn**.
- If |Tr **M**| > 2, the roots are real and one has |λ| > 1. A start along the matching eigenvector grows as λ<sup>n</sup>, and so does almost any other start. The motion is unbounded.
- If |Tr **M**| = 2, λ = ±1 twice, and **M** is either ±**1** or has a shear that makes the distance grow linearly: marginal, and in practice unstable.

So the ring is stable if and only if |Tr **M**| < 2. The same condition decides the stability of any discrete-time linear system with unit determinant.
:::

**The ring is stable in a plane if and only if |Tr M| < 2 for that plane's one-turn matrix**, and the tune in that plane is the phase advance per turn divided by 2π, μ/2π.

## Strong focusing

Take one thin focusing lens of focal length *f*, a drift of length *L*, one thin *defocusing* lens (focal length −*f*) and another drift of length *L*. This is the simplest :term[FODO cell]{id=fodo-cell}: **F**ocus, drift (**O**), **D**efocus, drift. Multiplying the four matrices, the terms in *L*/*f* in the trace cancel, and

:::equation{#fodo caption="The thin-lens FODO cell: its trace, the phase advance per cell, and the limit of stability."}
$$\operatorname{Tr}\mathbf{M} = 2 - \frac{\term{L}{L}^2}{\term{f}{f}^2}, \qquad \sin\frac{\term{mu}{\mu}}{2} = \frac{L}{2f}$$

```terms
L:
  label: 'L, the spacing'
  what: The distance between one lens and the next, in metres. The cell is 2L long.
  why: A longer drift lets a proton wander further before the next lens corrects it.
  effect: 53.45 m in the LHC's arc cell, which is 106.9 m long and has two quadrupoles.
f:
  label: 'f, the focal length'
  what: 'The focal length of each lens, in metres: 1/(kL_quad) for a quadrupole.'
  why: A shorter focal length means a stronger lens.
  effect: The cell is stable only for f > L/2. The LHC's arc cell runs at 90°, which needs f = 37.8 m.
mu:
  label: 'μ, the phase advance per cell'
  what: The angle by which the betatron oscillation advances in one cell, with cos μ = Tr M/2.
  why: It sets the oscillation's wavelength, and the tune of a ring of N identical cells is Nμ/2π.
  effect: '90° in the LHC''s arcs: a quarter of a betatron oscillation per cell. At f = L/2, μ = 180° and the cell is at its stability limit.'
```
:::

The cell is stable for *L*² < 4*f*², that is for *f* > *L*/2, with focusing and defocusing lenses of exactly equal strength. The result is surprising. A focusing lens and a defocusing lens of equal and opposite strength would cancel if they were at the same place. Separated by a drift *L* they do not: two thin lenses of focal lengths *f*₁ and *f*₂ at distance *L* have a combined focal length given by 1/*f* = 1/*f*₁ + 1/*f*₂ − *L*/(*f*₁*f*₂), which for *f*₁ = *f* and *f*₂ = −*f* is 1/*f*<sub>eff</sub> = *L*/*f*², positive, so the pair focuses. The reason is in the picture: a proton that is off axis is farther from the axis in the focusing lens, where the force is directed inwards, than in the defocusing lens, where the force is directed outwards. The force is proportional to the distance, so the inward kick is larger than the outward one. This is the principle of the alternating-gradient, or :term[strong-focusing]{id=strong-focusing}, synchrotron.

```predict
q: 'A horizontally focusing quadrupole is followed, 4 m further down the beam line, by an identical quadrupole rotated by 90°, so that it defocuses horizontally and focuses vertically. Both have focal length f = 3 m. Is the horizontal motion through the pair, repeated over many pairs, stable?'
options:
  - text: 'No: the two lenses cancel, so there is no net focusing and the beam drifts away.'
    why: 'Equal and opposite strengths cancel only for lenses at the same place. Separated by a drift, they do not.'
  - text: 'Yes, for a range of strengths: the cell matrix has Tr M = 2 − L²/f², which is 0.22 here, below 2.'
    correct: true
    why: 'With L = 4 m and f = 3 m, L²/f² = 1.78, so Tr M = 0.22. The proton is farther from the axis in the focusing lens than in the defocusing one, and the net effect is to focus. The vertical plane works the same way, with the roles of the lenses exchanged.'
  - text: Only in one of the two planes, because a quadrupole focuses in one plane and defocuses in the other.
    why: 'That is true for a single quadrupole, but with alternating quadrupoles each plane sees a focusing lens and a defocusing one, and both are stable.'
```

::alternating-gradient{n="20.1" caption="Two rays (solid and dashed) through six cells, in both planes. With alternating quadrupoles (F, D, F, D) both planes are stable and the rays oscillate: the amplitude is larger in the focusing lens. With four identical quadrupoles (F, F, F, F) the plane in which they focus may be stable, but the other plane, in which they all defocus, blows up at once. The lower plot is the trace of the cell matrix against L/f: the motion is stable in the shaded band, |Tr M| < 2."}

:::history{year=1952 title="Strong focusing" people="Nicholas Christofilos, Ernest Courant, M. Stanley Livingston, Hartland Snyder" source="Sources: Courant, Livingston and Snyder (1952); Christofilos's patent (1956); CERN's accounts of the PS."}
In 1952 Ernest Courant, M. Stanley Livingston and Hartland Snyder, at Brookhaven National Laboratory, published the principle of the strong-focusing synchrotron: a ring whose magnets have large gradients of alternating sign, focusing and defocusing in turn, so that both transverse planes are focused at once and the beam can be made much smaller than in a weak-focusing machine, and so can the magnets.:cite[courant1952] They saw that the arrangement would allow a much more powerful machine for the same cost.

The idea had already been put on paper. Nicholas Christofilos, an engineer working in Athens, had conceived the same arrangement independently and filed a patent application for it in the United States in 1950 (the patent was granted in 1956). It was not published in a journal. When the Brookhaven group learned of Christofilos's work, they acknowledged his priority.:cite[christofilos1956] The principle has remained the basis of every high-energy ring since.
:::

:::history{year=1959 title="The Proton Synchrotron" people="CERN" source="Source: CERN Courier, on the sixtieth anniversary of the PS."}
In 1952, the year of the Brookhaven paper, the provisional Council that was preparing CERN endorsed a study for a synchrotron of the new type, and in October 1953 the construction of a machine with a design energy between 20 and 30 GeV was approved. It was designed and built in 1954–59. On 24 November 1959, in the evening, it accelerated a beam to about 24 GeV for the first time, and for a short time it was the highest-energy accelerator in the world.:cite[cern-ps-60] It is a ring of 628 m with alternating gradients, whose magnets both bend and focus (combined-function magnets). It has been upgraded many times, and is the machine that, in the chain of Chapter 19, shapes the LHC's bunches.

A strong-focusing ring of the same energy as a weak-focusing one has a beam only a fraction of the size, and so its vacuum pipe and magnets are smaller and cost less per GeV. That was the economy that made the multi-GeV machines of the 1960s and, eventually, the multi-TeV ones possible.
:::

The LHC's FODO cell has the same structure, with real magnets. It is 106.9 m long and holds two quadrupoles and six dipoles (three in each half-cell), tuned to a phase advance of 90°.:cite[lhc-design] Applying the thin-lens formula, 90° needs sin 45° = *L*/2*f* with *L* = 53.45 m, hence *f* = 37.8 m. The real quadrupole, 3.1 m long, has a focal length 1/(*kL*) of 37 m at the strength that gives exactly 90° in the library's model of the cell. That strength is a gradient of 203 T/m at 7 TeV, close to the 223 T/m the magnets are designed to reach.

```numeric
id: fodo-focal
title: The focal length of the LHC's arc quadrupoles
prompt: 'The LHC arc cell is 106.9 m long and is a FODO cell (two thin lenses with spacing L = 53.45 m between them, treating each quadrupole as a thin lens). What focal length f, in metres, gives a phase advance of 90° per cell? Use sin(μ/2) = L/2f.'
answer: 37.8
unit: m
tolerance: 0.02
hints:
  - sin 45° = 0.7071.
  - f = L/(2 sin(μ/2)).
```

## Betatron oscillations, tune and β

Between quadrupoles the motion is a drift, inside them it is a harmonic oscillator whose strength varies with *s* round the ring: *x*″ + *K*(*s*) *x* = 0, with *K* periodic. This is **Hill's equation**, studied in a different context in the 19th century. Its solution is an oscillation whose amplitude and wavelength both change along the ring, and can be written as

:::equation{#betatron caption="The betatron oscillation: amplitude set by the emittance and the β function, phase advancing at the rate 1/β."}
$$x(s) = \sqrt{\term{eps}{\varepsilon}\,\term{beta}{\beta(s)}}\;\cos\!\big(\term{psi}{\psi(s)} + \psi_0\big), \qquad \psi(s) = \int_0^s \frac{ds'}{\beta(s')}, \qquad \term{Q}{Q} = \frac{\psi(C)}{2\pi}$$

```terms
eps:
  label: 'ε, the emittance'
  what: 'The constant of the motion of a proton, in metre-radians: π ε is the area of its ellipse in the (x, x′) plane. For a beam, the rms emittance of its protons.'
  why: It is the quantity that stays constant along the ring (apart from acceleration). The optics change the ellipse's shape, never its area.
  effect: The LHC's beam has a normalised emittance of 3.75 µm in the design, which is a geometric ε = 7.8 nm at 450 GeV and 0.5 nm at 6.8 TeV.
beta:
  label: 'β(s), the β function'
  what: 'A length, in metres, determined by the magnets, which describes the envelope of the oscillation: the beam''s rms size is √(εβ).'
  why: It is large where the beam is wide and its angular spread small, and small where the beam is narrow and its divergence large.
  effect: Between about 30 and 180 m in the LHC arcs, and 0.55 m at the collision points in the design (β*).
psi:
  label: 'ψ(s), the betatron phase'
  what: The phase of the oscillation along the ring, increasing by ds/β at each step.
  why: 'Where β is small, the phase advances quickly: the oscillation wavelength is about 2πβ.'
  effect: A proton at the LHC advances by about 64 full cycles per turn in the horizontal plane.
Q:
  label: 'Q, the tune'
  what: The number of betatron oscillations in one turn, ψ(C)/2π, including its integer part.
  why: It decides whether a small error adds up turn after turn (a resonance) or averages away.
  effect: About 64.3 horizontally and 59.3 vertically at the LHC, so a proton oscillates at 64.3 × 11,245 Hz = 723 kHz.
```
:::

The :term[β function]{id=beta-function} is the central object of beam optics. It is computed from the one-turn matrix, which can always be written in the form **M** = [[cos μ + α sin μ, β sin μ], [−γ sin μ, cos μ − α sin μ]] with γ = (1 + α²)/β (the matrix of a rotation in a rescaled phase space), and the β, α and γ at the start point are read off from it: β = *M*<sub>12</sub>/sin μ, α = (*M*<sub>11</sub> − *M*<sub>22</sub>)/(2 sin μ). The library's `periodicTwiss` does exactly that. Matrices then carry β, α, γ from one point to the next. For a thin-lens FODO cell, β at the focusing lens is *L*<sub>cell</sub>(1 + sin(μ/2))/sin μ and at the defocusing lens it is *L*<sub>cell</sub>(1 − sin(μ/2))/sin μ; at 90° these are 1.71 and 0.29 of the cell length, about 182 m and 31 m for the LHC cell. The library's thick-lens model gives 181 m and 31.5 m.

### Emittance

A beam of many protons is a cloud in the (*x*, *x*′) plane. Each proton goes round its own ellipse, all with the same shape, and the cloud's size is the :term[emittance]{id=emittance}: the beam's rms width is σ = √(ε β) and its rms angular spread is σ′ = √(ε γ), where γ = (1 + α²)/β is the Twiss parameter of the previous paragraph, not the Lorentz factor. **The ellipse's area, π ε, does not change** as the beam goes round the ring: at a large β the ellipse is wide and flat, at a small β it is tall and thin, and the area is the same. The emittance can be changed only by things the linear optics leaves out, such as a collimator scraping the beam, noise in a magnet, or collisions among the protons of a bunch.

There is one important exception. When a beam is accelerated, its momentum rises, and the slope *x*′ = *p*<sub>x</sub>/*p* shrinks, because the transverse momentum does not grow but the longitudinal one does. The geometric emittance therefore falls as 1/(βγ), which is called **adiabatic damping**, and the product βγ ε, the **normalised emittance**, is constant. The LHC's normalised emittance of 3.75 µm (design) is the same at 450 GeV and at 6.8 TeV; the geometric emittance falls from 7.8 nm to 0.52 nm, and the beam in the arcs shrinks from about 0.5–1.2 mm at injection to 0.12–0.31 mm.

::emittance-ellipse{n="20.2" caption="The beam in phase space. Drag β and watch the ellipse change shape while its area stays fixed; change α and it tilts. Raise the momentum from 450 GeV/c: the ellipse shrinks as 1/√(βγ) in each direction. The second button sets the optics of the collision point, β* = 0.55 m at 7 TeV: a beam 17 µm wide that diverges at 30 µrad. Chapter 21 uses this beam size to compute the luminosity."}

## Building a ring

Everything above is in the next figure. The lattice designer lets you build a cell from drifts, dipoles, quadrupoles and a sextupole, repeat it round a ring, and track protons turn by turn. It shows the trace of the one-turn matrix, the β function along the cell, the phase-space ellipses of five protons, and the tune measured from the tracking against the tune from the matrix. The first preset is the textbook FODO cell. The second is a cell whose quadrupoles have been wired to defocus: the trace is above 2, and the protons leave. The third is the LHC arc cell (the preset has only arc cells, so its tune is 51.2, not the real 64.3: the machine's straight sections are left out). The fourth adds a sextupole, which we meet in the next section.

::lattice-designer{preset="fodo" n="20.3" caption="A ring built of identical cells: the one-turn matrix, β(s), the tunes, and five protons on nested ellipses, tracked with your own tracking function once you write it (below). Try: lengthen a drift, and watch the tune and the stable range; set the quadrupoles to the wrong sign (the second preset); add a sextupole (the fourth) and raise the amplitudes, and see the ellipses lose their shape."}

Two exercises use the same cell. In both, the ring has identical FODO cells, each with two dipoles that together bend by 2π/*N*, and quadrupoles 0.4 m long. You set the focusing strengths so that the cell has the required phase advance and β.

```lattice
id: fodo-90
title: A ring of 8 cells at 90° per cell
prompt: 'Eight identical cells make a small ring. Each has two 0.4 m quadrupoles (F and D) and two 2 m dipoles, with 4 m between one quadrupole and the next. Set the quadrupole strengths so that the phase advance per cell is 90° (the ring’s tune is then 2), with β(max) = 10.3 m and β(min) = 3.2 m.'
config:
  nCells: 8
  cellDrift: 4
  quadLength: 0.4
  free: [kF, kD]
  kMax: 1.5
target:
  muDeg: 90
  tune: 2
  betaMax: 10.3
  betaMin: 3.2
par: 0.03
hints:
  - A cell with the focusing and defocusing quadrupoles of equal strength has the smallest β(max) for its phase advance.
  - At 90°, Tr M = 0. Start near k = 0.5 m⁻² and adjust.
solution: 'kF = kD = 0.56 m⁻². The ring is stable, with μ = 90.0°, Q = 2.000, β(max) = 10.28 m and β(min) = 3.20 m.'
explain: 'The quadrupoles are equal, and the cell has a phase advance of a quarter of a turn: four cells make one betatron oscillation. The dipoles add a little horizontal focusing, which is why the vertical plane, without it, has a phase advance of only 57° in this ring.'
```

```lattice
id: fodo-60
title: A longer cell at 60° per cell
prompt: 'Twelve cells, 5 m between quadrupoles of 0.4 m. Make the phase advance 60° per cell (tune 2) with β(max) = 15.1 m and β(min) = 7.3 m.'
config:
  nCells: 12
  cellDrift: 5
  quadLength: 0.4
  free: [kF, kD]
  kMax: 1.5
target:
  muDeg: 60
  tune: 2
  betaMax: 15.1
  betaMin: 7.3
par: 0.03
hints:
  - A weaker phase advance needs weaker quadrupoles, for the same cell length.
solution: 'kF = kD = 0.32 m⁻²: μ = 60.0°, β(max) = 15.07 m, β(min) = 7.29 m.'
explain: 'Both rings have the same kind of cell, and the difference in the phase advance changes the ratio β(max)/β(min) from 3.2 to 2.1 (at 90° it is larger, at 60° smaller). A large phase advance per cell gives a small β(min) but a larger spread; accelerator designers choose between these for the size of the beam, the aperture and the sensitivity to errors.'
```

## Tune, resonances and chromaticity

The tune is a fractional number of oscillations per turn, and its fractional part is the thing that matters. Suppose a magnet has a small error, a field that is slightly wrong, and every proton is kicked by it once per turn. If the tune is an integer, the proton is at the same phase of its oscillation each time it reaches the error, the kicks add with the same sign turn after turn, and the amplitude grows without limit. That is the **integer resonance**, driven by a dipole error, whose kick does not depend on *x*. A quadrupole error, whose kick is proportional to *x*, drives the **half-integer resonance**, where the same thing happens every second turn. A sextupole error, whose kick goes as *x*², drives the **third-order resonance** at tunes of 1/3 and 2/3, an octupole error the fourth-order one at 1/4, 1/2 and 3/4, and so on. With two planes, and coupling between them, the resonances are the lines

$$n\,Q_x + m\,Q_y = p,$$

for integers *n*, *m* and *p*. The **order** of the resonance is |*n*| + |*m*|. The lower the order, the stronger the effect, since a high-order resonance needs a high-order nonlinearity to drive it. The tune diagram below draws these lines in the (*Q*<sub>x</sub>, *Q*<sub>y</sub>) plane, and the working point must sit in a gap between the strong ones.

::resonance-map{n="20.4" caption="The LHC's tune diagram, near its design working point (64.3, 59.3). The lines are the resonances n Qx + m Qy = p up to the order you choose; the thick ones are low order. The shaded square is the beam's tune spread. Move the point with the sliders or by dragging: the nearest resonance, and the number of lines that cross the tune spread, update. The fractional tunes are about 0.3, between the fourth-order line at 1/4 and the third-order line at 1/3. The two integer parts differ by almost exactly 5, so the point is also close to the second-order coupling line Qx − Qy = 5, and the machine has to keep the coupling between the planes small."}

Real beams have a tune *spread*, not a single tune, for two reasons. The first is that protons of different momenta are focused differently, because a quadrupole's strength is *g*/(*B*ρ) and the rigidity grows with *p*: the tune falls as the momentum rises. The rate of change is the :term[chromaticity]{id=chromaticity}, ξ = d*Q*/(d*p*/*p*), and for a ring of quadrupoles and dipoles it is negative and of the order of −*Q* (the lattice designer's FODO ring gives −2.8 for a tune of 3.3). The second is that real magnets are not perfectly linear, so the tune depends on the amplitude. Sextupole magnets correct the chromaticity, by giving a momentum-dependent focusing, at the price of nonlinearity: it is the nonlinear terms that limit how large an amplitude stays stable (the **dynamic aperture**). The fourth preset of the lattice designer shows it: with a weak sextupole, small amplitudes go round their ellipses as before, and large ones distort and are lost.

A particle-physics consequence follows. The LHC's protons stay in for ten hours, which is 4 × 10⁸ turns. The dynamic aperture is the region in which a proton survives that many turns, and it is one of the main quantities that decide the performance of the machine.

## You write: tracking

The library's tracker, `trackThroughLattice`, is the function that the widgets of this chapter call to follow a proton round a ring. You can replace it with your own. The exercise: given a lattice (a list of elements, each of which the library can turn into a matrix with `matrixOf`), an initial position and slope, and a number of turns, return the position and slope at the start of each turn. Do the matrix multiplication yourself.

```code
id: track-lattice
title: Track a proton through a lattice
hook: machine.trackThroughLattice
prompt: |
  Implement `trackThroughLattice(lattice, x0, xp0, nTurns, plane)`. The lattice is a list of elements in beam order; `matrixOf(element, plane)`
  returns the 2×2 matrix `[a, b, c, d]` of an element in the given plane, and `'y'` flips the sign of the focusing.

  Return `{ x, xp }`: the position and the slope at the **start** of each turn, so both arrays have `nTurns` entries and entry 0 is the initial condition.
  A *thin sextupole* (`kind: 'sextupole'`, with `k2l`) is not linear: it leaves `x` alone and changes the slope by `Δx′ = −½ k2l x²`
  (in the `'y'` plane, use the opposite sign of `k2l`, as the library's one-dimensional model does). `matrixOf` returns the identity for it.
starter: |
  import { matrixOf, type Lattice, type Plane, type TrackResult } from 'hep/machine';

  export function trackThroughLattice(lattice: Lattice, x0: number, xp0: number, nTurns: number, plane: Plane = 'x'): TrackResult {
    // Multiply the matrices of the elements in beam order (the first element acts first),
    // then apply the result once per turn. A sextupole needs a kick in the middle of the turn.
    return { x: [], xp: [] };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { trackThroughLattice } from 'solution';
  import {
    fodoThin, fodoCell, repeat, oneTurnMatrix, periodicTwiss, isStable, tuneFromTurns, referenceTrackThroughLattice, apply, det,
  } from 'hep/machine';

  const DRIFT = [{ kind: 'drift', length: 2 }] as const;

  test('returns nTurns entries and starts from the initial condition', () => {
    const r = trackThroughLattice(DRIFT, 1e-3, 2e-3, 6);
    expect(r.x.length).toBe(6);
    expect(r.xp.length).toBe(6);
    expect(r.x[0]).toBe(1e-3);
    expect(r.xp[0]).toBe(2e-3);
  });

  test('a drift: the position grows by L·x′ every turn and the slope is unchanged', () => {
    const r = trackThroughLattice(DRIFT, 1e-3, 2e-3, 6);
    for (let i = 0; i < 6; i++) {
      expect(r.x[i]).toBeCloseTo(1e-3 + i * 2 * 2e-3, 12);
      expect(r.xp[i]).toBeCloseTo(2e-3, 12);
    }
  });

  test('a thin focusing lens turns a displacement into a slope', () => {
    const lens = [{ kind: 'thinQuad', kl: 0.5 }] as const;
    const r = trackThroughLattice(lens, 0.01, 0, 3);
    expect(r.x[1]).toBeCloseTo(0.01, 12);
    expect(r.xp[1]).toBeCloseTo(-0.005, 12);
  });

  test('the vertical plane sees the opposite sign of the focusing', () => {
    const lens = [{ kind: 'thinQuad', kl: 0.5 }] as const;
    const r = trackThroughLattice(lens, 0.01, 0, 3, 'y');
    expect(r.xp[1]).toBeCloseTo(0.005, 12);
  });

  test('a FODO ring follows the one-turn matrix, turn after turn', () => {
    const ring = repeat(fodoThin(4, 3), 5);
    const M = oneTurnMatrix(ring);
    const r = trackThroughLattice(ring, 2e-3, -1e-4, 25);
    let s: [number, number] = [2e-3, -1e-4];
    for (let i = 0; i < 25; i++) {
      expect(r.x[i]).toBeCloseTo(s[0], 10);
      expect(r.xp[i]).toBeCloseTo(s[1], 10);
      s = apply(M, s[0], s[1]);
    }
  });

  test('the tune measured from the tracking is the tune of the matrix', () => {
    const cell = fodoThin(4, 4); // sin(μ/2) = L/2f = 0.5, so μ = 60°
    const ring = repeat(cell, 5); // 300° per turn, tune 5/6
    const r = trackThroughLattice(ring, 1e-3, 0, 512);
    const q = tuneFromTurns(r.x, r.xp);
    const expected = periodicTwiss(oneTurnMatrix(ring)).tune;
    expect(expected).toBeCloseTo(5 / 6, 6);
    expect(Math.abs(q - expected)).toBeLessThan(2e-3);
  });

  test('an unstable lattice grows exponentially', () => {
    const ring = repeat(fodoThin(1.5, 4), 2); // L/f = 2.67 > 2
    expect(isStable(oneTurnMatrix(ring))).toBe(false);
    const r = trackThroughLattice(ring, 1e-3, 0, 12);
    expect(Math.abs(r.x[11]!)).toBeGreaterThan(100 * 1e-3);
  });

  test('phase-space area is conserved: three protons keep the area of their triangle', () => {
    const ring = repeat(fodoThin(3.5, 3), 4);
    const pts: [number, number][] = [[1e-3, 0], [0, 1e-4], [-1e-3, 2e-4]];
    const area = (p: [number, number][]) => 0.5 * ((p[1]![0] - p[0]![0]) * (p[2]![1] - p[0]![1]) - (p[2]![0] - p[0]![0]) * (p[1]![1] - p[0]![1]));
    const tracks = pts.map((p) => trackThroughLattice(ring, p[0], p[1], 31));
    const last = tracks.map((t) => [t.x[30]!, t.xp[30]!] as [number, number]);
    expect(area(last)).toBeCloseTo(area(pts), 12);
    expect(det(oneTurnMatrix(ring))).toBeCloseTo(1, 12);
  });

  test('a thin sextupole leaves x alone and kicks the slope by −½·k2l·x²', () => {
    const sext = [{ kind: 'sextupole', k2l: 10 }] as const;
    const r = trackThroughLattice(sext, 0.01, 0, 2);
    expect(r.x[1]).toBeCloseTo(0.01, 12);
    expect(r.xp[1]).toBeCloseTo(-0.5 * 10 * 1e-4, 12);
  });

  test('thick quadrupoles, dipoles and a sextupole agree with the library, in both planes', () => {
    const cell = [...fodoCell({ kF: 0.4, quadLength: 0.4, gap: 1, nDipoles: 1, dipoleLength: 2, dipoleAngle: Math.PI / 16 }), { kind: 'sextupole', k2l: 3 } as const];
    const ring = repeat(cell, 6);
    for (const plane of ['x', 'y'] as const) {
      const a = trackThroughLattice(ring, 1e-3, 5e-5, 40, plane);
      const b = referenceTrackThroughLattice(ring, 1e-3, 5e-5, 40, plane);
      for (let i = 0; i < 40; i++) {
        expect(a.x[i]).toBeCloseTo(b.x[i]!, 9);
        expect(a.xp[i]).toBeCloseTo(b.xp[i]!, 9);
      }
    }
  });
solution: |
  import { matrixOf, type Lattice, type Mat2, type Plane, type TrackResult } from 'hep/machine';

  const mul = (A: Mat2, B: Mat2): Mat2 => [
    A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3],
  ];

  export function trackThroughLattice(lattice: Lattice, x0: number, xp0: number, nTurns: number, plane: Plane = 'x'): TrackResult {
    // Split the turn into runs of linear elements (each collapsed into one matrix) and sextupole kicks.
    type Seg = { m: Mat2 } | { k2l: number };
    const segs: Seg[] = [];
    let run: Mat2 | null = null;
    for (const e of lattice) {
      if (e.kind === 'sextupole') {
        if (run) segs.push({ m: run });
        run = null;
        segs.push({ k2l: plane === 'x' ? e.k2l : -e.k2l });
      } else {
        const m = matrixOf(e, plane);
        run = run ? mul(m, run) : m; // the new element acts after the ones already in the run
      }
    }
    if (run) segs.push({ m: run });

    const x: number[] = [];
    const xp: number[] = [];
    let cx = x0;
    let cp = xp0;
    for (let turn = 0; turn < nTurns; turn++) {
      x.push(cx);
      xp.push(cp);
      for (const s of segs) {
        if ('m' in s) {
          const nx = s.m[0] * cx + s.m[1] * cp;
          cp = s.m[2] * cx + s.m[3] * cp;
          cx = nx;
        } else {
          cp -= 0.5 * s.k2l * cx * cx;
        }
      }
    }
    return { x, xp };
  }
hints:
  - 'The matrix of the whole lattice is the product Mₙ ⋯ M₂ M₁ of the elements’ matrices, so when you fold a list of elements into one matrix, each new element multiplies on the **left**.'
  - 'A sextupole cannot be part of a matrix. Split the turn into pieces: matrices between the sextupoles, and a kick at each one.'
  - 'Record (x, x′) **before** applying the turn, so that entry 0 is the initial condition and there are exactly `nTurns` entries.'
```

Once the exercise passes, the lattice designer above and the Control Room track with your code. The test that checks the tune from your tracking is the point of the lattice designer's last readout: the tune measured from the turn-by-turn positions should agree with the one from the matrix, and if it does, your tracker is right.

:::programmer
A lattice is a **fold**. Each element is a function from (*x*, *x*′) to (*x*, *x*′), and a line of elements is their composition; because every one of them is linear, the composition is a matrix, which is just a precomputed function. The matrix of the ring raised to the power *n* gives *n* turns in one step, and its eigenvalues tell you whether the iteration converges or blows up. This is the stability analysis of any discrete-time linear system (an IIR filter, or a game's physics update), with the same criterion: the eigenvalues (poles) must lie on or inside the unit circle. A matrix with a unit determinant has them on the circle, or on the real axis as a reciprocal pair, so the condition is |Tr **M**| < 2, and a stable system is marginal: it oscillates for ever, neither growing nor decaying, because there is no friction. That is the conservation of phase-space area seen from another side.
:::

:::hood[Finding a tune with a parabola]
The lattice designer measures the tune from the tracked positions, the way the machine's operators measure it from the signals of the beam-position monitors: take the Fourier transform of the turn-by-turn positions, and find the peak. Three problems arise, and `tuneFromTurns` in `hep/machine/optics.ts` deals with each. The data is finite, so the spectrum has leakage, which a Hann window reduces. The spectrum's resolution is 1/*N* for *N* turns, and a tune of 0.1667 needs better, so the data are padded with zeros to four times the length, and the peak is refined by fitting a parabola through the logarithms of the magnitudes of the three bins around the maximum (the log of a Gaussian is a parabola, and the Hann window's main lobe is close to a Gaussian):

```ts
const a = Math.log(mag(best - 1) + 1e-300);
const b = Math.log(mag(best) + 1e-300);
const c = Math.log(mag(best + 1) + 1e-300);
const denom = a - 2 * b + c;
const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
return (best + shift) / N;
```

The third problem is **aliasing**: a real signal cannot tell a tune *Q* from 1 − *Q*, since sampling once per turn can only represent frequencies up to 1/2. With positions alone, the result is folded into (0, ½]. With positions and slopes, the library builds the complex signal *x* − *i* *s* *x*′, whose spectrum is one-sided, and finds the tune in (0, 1). The tests check the recovered tune of a known ring against the matrix.
:::

:::experiments
Beam optics at CERN is calculated with **MAD-X** (Methodical Accelerator Design), a program that reads a lattice written as a list of elements, exactly as in the lattice designer, and computes the β function, the tunes, the chromaticity and the closed orbit; its successors, such as **Xsuite**, add tracking with many particles on graphics processors. The LHC has about a thousand **beam-position monitors**, electrodes around the pipe that measure where the beam passes; the tune can be measured by exciting small oscillations and Fourier-analysing their signals, as in the last box. The toy here has no coupling between the planes, no errors in the magnets and no space-charge or beam–beam forces, all of which move the tune; the real machine measures the tunes and corrects them continuously to keep the working point in the gap between the resonances.
:::

## What comes next

We can now keep a beam together, and accelerate it. A single beam going round a ring makes no particle physics. Chapter 21 brings two beams together and asks how many collisions a bunch crossing produces. The answer depends on the beam size at the collision point, which is the √(εβ*) of this chapter, and on the number of protons in each bunch, which Chapter 19's buckets hold. The same chapter also explains why the machine is so sensitive to the loss of a few protons: the energy stored in the beam.

## Further reading

- The LHC Design Report, Volume I, chapters on the magnets and optics (:cite[lhc-design]).
- Courant, Livingston and Snyder's 1952 paper, four pages long, is the first statement of strong focusing (:cite[courant1952]). The full theory of the β function and of Courant–Snyder invariants is in Courant and Snyder's 1958 paper (:cite[courant1958]).
- For the machine in practice, Evans and Bryant, "LHC Machine" (:cite[evans2008]).
