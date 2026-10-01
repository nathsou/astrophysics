---
number: 17
title: Symmetry and gauge invariance
summary: Symmetries give conservation laws (Noether). Demand that a symmetry hold separately at every point in space and time, and a new field is forced into existence, with its coupling to matter fixed by the symmetry. That field is the photon for U(1), the W bosons for SU(2) and the gluons for SU(3).
duration: About 3 hours
prerequisites: [qed]
---

Chapter 16 used the photon as given: a line in a diagram, a propagator 1/*s*, a vertex with strength *e*. This chapter asks why it exists. The answer is a statement about symmetry, and it is the most productive idea of twentieth-century physics: the forces of the Standard Model are not separate inventions, one per force. Each is what a symmetry requires once you insist on it at every point.

Start with a grid of arrows. Each arrow stands for the phase of a complex number at a point; the energy of the arrangement is the cost of neighbouring arrows disagreeing. Turn every arrow by the same angle and nothing changes. Turn each by its own angle and the energy jumps. The figure lets you do both, and then shows what repairs the second.

::phase-dial{n="17.1" caption="Global and local symmetry on a grid of phases. Step 1: turn all the arrows by the same angle and the energy is unchanged (a global symmetry); turn each by its own random angle and it changes. Step 2: add a dial on every edge, the link field A, and measure differences with it. Turn each arrow by its own angle and shift each dial by the difference of the angles at its two ends (the gauge transformation button): the covariant energy and the flux through every square do not change. The link field is the photon of this toy world, and the flux through a square is its magnetic field."}

The rest of the chapter makes the figure's second step precise in the continuum, then repeats it with matrices instead of a single phase.

## Symmetry and conservation: Noether's theorem

A **symmetry** is a transformation that leaves the laws of physics, and so the equations of motion, unchanged. Doing the experiment tomorrow, or one metre to the left, or facing another way, should give the same result. Emmy Noether proved in 1918 that every continuous symmetry of the action (the quantity whose stationary value gives the equations of motion) implies a conserved quantity:

| Symmetry | Conserved quantity |
|---|---|
| shift of time, *t* → *t* + ε | energy |
| shift of position, **x** → **x** + **ε** | momentum |
| rotation of the axes | angular momentum |
| change of phase of a charged field, ψ → e<sup>iα</sup>ψ | electric charge |

The simplest case shows how the argument runs. A particle with Lagrangian *L*(*x*, *ẋ*) obeys the Euler–Lagrange equation $\frac{d}{dt}\frac{\partial L}{\partial \dot x} = \frac{\partial L}{\partial x}$. If *L* does not depend on *x* (the physics is the same everywhere along the line: a symmetry under *x* → *x* + ε), then the right side vanishes and $p = \partial L/\partial\dot x$ is constant: momentum is conserved. The theorem generalises that step to any continuous transformation, and to fields.

```predict
q: 'The laws of physics do not depend on what time it is: an experiment repeated tomorrow gives the same result. Noether’s theorem says this symmetry has a conserved quantity. Which one?'
options:
  - text: Momentum.
    why: 'Momentum goes with invariance under a shift in space: the physics is the same here as one metre to the left.'
  - text: Energy.
    correct: true
    why: 'Invariance under a shift in time is the symmetry behind energy conservation. For the same reason energy is not conserved in an expanding universe: the background depends on time, so the symmetry is absent.'
  - text: Electric charge.
    why: 'Charge goes with invariance under changes of the phase of a charged field, which is a transformation of the field, not of the clock.'
```

The last row is the one that matters for this chapter. A **complex field** ψ(*x*) has a phase. The equations of a free charged field (for instance, the Klein–Gordon field of Chapter 14 made complex, or the electron field) are unchanged if the phase is rotated by the same angle α everywhere: ψ → e<sup>iα</sup>ψ. :term[Noether's theorem]{id=noether-theorem} gives a conserved current, whose time component integrates to a conserved number, the charge.

:::deeper[The conserved charge of a complex scalar field]
Take $\mathcal L = \partial_\mu\psi^*\,\partial^\mu\psi - m^2\psi^*\psi$. Under $\psi\to e^{i\alpha}\psi$ with α constant, $\psi^*\psi$ and $\partial\psi^*\partial\psi$ are unchanged. For an infinitesimal α, $\delta\psi = i\alpha\psi$ and $\delta\psi^* = -i\alpha\psi^*$. Noether's current is $\frac{\partial\mathcal L}{\partial(\partial_\mu\psi)}\,\delta\psi/\alpha + \frac{\partial\mathcal L}{\partial(\partial_\mu\psi^*)}\,\delta\psi^*/\alpha$, which is, up to an overall sign that is a matter of convention,

$$j^\mu = i\left(\psi^*\partial^\mu\psi - \psi\,\partial^\mu\psi^*\right),\qquad \partial_\mu j^\mu = 0,\qquad Q = \int j^0\,d^3x .$$

The divergence vanishes on solutions of the field equation $(\partial^2 + m^2)\psi = 0$. A solution with time dependence e<sup>−iEt</sup> has charge density 2*E*|ψ|², positive, and one with e<sup>+iEt</sup> has the opposite sign: particles and antiparticles carry opposite charge, and the number of particles minus the number of antiparticles does not change.

The numbers can be checked on the chain of Chapter 14. Write ψ = (φ₁ + iφ₂)/√2 and evolve two real chains. The charge is $Q = \sum_i(\phi_{1,i}\,\dot\phi_{2,i} - \phi_{2,i}\,\dot\phi_{1,i})$. With equal masses the leapfrog conserves it to a part in 10⁹ while the fields evolve; with unequal masses, which break the rotation symmetry between φ₁ and φ₂, it is not conserved. The course's test suite does both.
:::

:::history{year=1918 title="Noether's theorem" people="Emmy Noether" source="Sources: Noether (1918); Kosmann-Schwarzbach (2011)."}
Emmy Noether was working at Göttingen, where she had been invited by David Hilbert and Felix Klein, and where she completed her habilitation, the qualification to teach, only in 1919. Her paper *Invariante Variationsprobleme* ("Invariant variational problems") appeared in the *Nachrichten* of the Göttingen Society of Sciences in 1918.:cite[p4-noether1918] It was written in the discussions of Hilbert and Klein about the conservation of energy in Einstein's new general theory of relativity.:cite[p4-kosmann2011]

The paper proves two theorems. The first is the one used in particle physics: to every continuous symmetry with a finite number of parameters corresponds a conserved quantity. The second is about symmetries whose parameters are *functions* of position, local symmetries, and says that they give not conservation laws but identities among the equations of motion. General relativity is such a theory, and so, as the rest of this chapter shows, are the gauge theories of the forces.
:::

## Making the symmetry local

The phase rotation of the previous section used the same angle α at every point. That is a **:term[global symmetry]{id=global-symmetry}**. It is a strange requirement: it says that an observer in Geneva and an observer on the other side of the galaxy must use the same convention for what zero phase means, though no signal can reach from one to the other at once. A more natural statement is that each point has its own freedom: ψ(*x*) → e<sup>iα(*x*)</sup>ψ(*x*) with α depending on *x*. This is a **local** symmetry, or **:term[gauge symmetry]{id=gauge-symmetry}**.

The trouble is the derivative. Write the transformed field's derivative with the product rule:

$$\partial_\mu\!\left(e^{i\alpha(x)}\psi\right) = e^{i\alpha(x)}\left(\partial_\mu\psi + i\,(\partial_\mu\alpha)\,\psi\right).$$

The extra term $i(\partial_\mu\alpha)\psi$ spoils everything that contains a derivative. The kinetic term $|\partial\psi|^2$ is not invariant. Physically, a derivative compares the field at neighbouring points, and if the phase convention differs from point to point the comparison is meaningless: the phase dial's energy is the sum of $|\psi_i-\psi_j|^2$ over neighbours, and local rotations change it.

The repair is to introduce a new field that carries the information about how to compare phases at neighbouring points, and to define a derivative that uses it. On the grid, it is the dial *A*<sub>ij</sub> on each edge, and the comparison is $\psi_i - e^{iA_{ij}}\psi_j$. In the continuum it is a vector field *A*<sub>μ</sub>, and the **:term[covariant derivative]{id=covariant-derivative}** is

:::equation{#covariant caption="The covariant derivative and the transformation of the gauge field that makes it work."}
$$\term{D}{D_\mu}\psi = \left(\partial_\mu - i\,\term{q}{q}\,\term{A}{A_\mu}\right)\psi,\qquad \psi\to e^{i\term{alpha}{\alpha(x)}}\psi,\quad A_\mu\to A_\mu + \frac1q\,\partial_\mu\alpha$$

```terms
D:
  label: 'D_μ, the covariant derivative'
  what: The derivative that compares the field at neighbouring points using the gauge field to adjust for the change of phase convention between them.
  why: It transforms in the same way as the field itself, D_μψ → e^{iα} D_μψ, so that any expression built from D_μψ and ψ with the phases cancelling is invariant.
  effect: Replacing ∂_μ by D_μ everywhere in the equations of a free charged field makes it gauge invariant, and generates the interaction with the gauge field.
q:
  label: 'q, the charge'
  what: The coupling of the field ψ to the gauge field, q = eQ for a particle of charge Q in units of the proton's charge e.
  why: It decides how strongly the phase of ψ is tied to A. A field with twice the charge feels twice the effect of A.
  effect: The symmetry does not predict the value of q; it requires that a charge exists, and that it is the same for the interaction as for the transformation.
A:
  label: 'A_μ, the gauge field'
  what: A field with four components, one per direction of spacetime, which adjusts the phase of ψ from point to point. Its quanta are the photons.
  why: 'It is the connection of the symmetry: it tells ψ how its phase convention changes between neighbouring points.'
  effect: Under a gauge transformation A_μ shifts by the gradient of the angle, so only the combination ∂_μ − iqA_μ is meaningful.
alpha:
  label: 'α(x), the local angle'
  what: The phase rotation applied at each point, an arbitrary smooth function of position and time.
  why: Allowing it to vary from point to point is what makes the symmetry local.
  effect: The same function appears in the transformation of ψ and of A; if α is constant, A does not change and the symmetry is the global one.
```
:::

Check the claim by transforming. If ψ → e<sup>iα</sup>ψ and *A*<sub>μ</sub> → *A*<sub>μ</sub> + ∂<sub>μ</sub>α/*q*, then

$$D'_\mu\psi' = \left(\partial_\mu - iqA_\mu - i\,\partial_\mu\alpha\right)\left(e^{i\alpha}\psi\right) = e^{i\alpha}\left(\partial_\mu\psi + i(\partial_\mu\alpha)\psi - iqA_\mu\psi - i(\partial_\mu\alpha)\psi\right) = e^{i\alpha}D_\mu\psi .$$

The two terms in ∂α cancel, which is exactly what the shift of *A* was chosen to do. The course's tests verify this numerically on a smooth example: the covariant derivative of the transformed field equals e<sup>iα</sup> times the original, to the accuracy of the finite differences, while the plain derivative does not.

Three consequences follow, and between them they contain the whole of QED.

**1. The interaction is not an extra assumption.** Take the free Lagrangian of a charged fermion, $\bar\psi(i\gamma^\mu\partial_\mu - m)\psi$, and replace ∂ by D. The result,

$$\mathcal L = \bar\psi(i\gamma^\mu D_\mu - m)\psi = \bar\psi(i\gamma^\mu\partial_\mu - m)\psi \;+\; q\,\bar\psi\gamma^\mu\psi\,A_\mu ,$$

contains a new term: the current $\bar\psi\gamma^\mu\psi$ times the field *A*<sub>μ</sub>, with strength *q*. That is the QED vertex of Chapter 15, the *f f̄ γ* line with strength $eQ_f$, and its form is fixed.

**2. The new field has dynamics of its own.** To describe the photon propagating, one needs a term for *A*<sub>μ</sub> alone, which is also gauge invariant. The simplest is built from the field strength $F_{\mu\nu} = \partial_\mu A_\nu - \partial_\nu A_\mu$, which does not change under the shift of *A* (the shift is a gradient, and $\partial_\mu\partial_\nu\alpha - \partial_\nu\partial_\mu\alpha = 0$). The result is $-\tfrac14F_{\mu\nu}F^{\mu\nu}$, which is Maxwell's theory: the components of *F* are the electric and magnetic fields. On the grid, the flux through a square, the sum of the dials around it, is the field strength, and is unchanged by the gauge transformation.

**3. The photon is massless.** A mass term for the photon would be $\tfrac12m^2A_\mu A^\mu$. Under the shift *A* → *A* + ∂α/*q* it changes, so it is forbidden. The masslessness of the photon is not an accident: it is protected by the symmetry. Experiments test it: the Particle Data Group quotes an upper limit on the photon mass of about 10⁻¹⁸ eV (:cite[pdg2024]), which corresponds, through the range formula of Chapter 14, to a range longer than 10¹¹ m. If the limit were ever replaced by a measured nonzero mass, local U(1) symmetry would be broken in nature, and the Higgs mechanism of Chapter 26 would be the place to look for the reason.

The word *gauge* has a curious origin, told in the history card below. What it conveys is a freedom of description: two arrangements of ψ and *A* related by a gauge transformation describe the same physics. The gauge field is a **redundancy** of notation turned into a force. Only gauge-invariant quantities are physical: |ψ|², the field strength *F*<sub>μν</sub>, and the phase accumulated around a closed loop, $\oint A\cdot dl$. The last is a rotation of ψ that cannot be removed by any local choice of angles and is what the plaquette flux of Figure 17.1 measures.

:::history{year=1918 title="Weyl's gauge idea, 1918 and 1929" people="Hermann Weyl" source="Sources: Weyl (1918); London (1927); Weyl (1929)."}
In 1918 Hermann Weyl tried to unify gravity with electromagnetism by giving every point its own freedom to choose a scale of length: a ruler transported around a loop would come back with a different length, and the difference would be the electromagnetic field.:cite[p4-weyl1918] He called the freedom *Eich*, the German word for gauge, as in the gauge of a railway track or of a measuring standard, and that is the origin of the English word. Einstein objected that if a ruler's or a clock's rate depended on its history around loops, atomic clocks of the same kind would not agree about the frequency of their spectral lines, which contradicts observation. The theory in that form was given up.

With quantum mechanics the same structure reappeared in a better place. Fritz London pointed out in 1927 that the quantity that is rescaled in Weyl's theory is, in wave mechanics, a phase.:cite[p4-london1927] In 1929 Weyl published the theory in its modern form: the freedom is the phase of the electron's wave function, the gauge field is the electromagnetic potential, and the conservation of electric charge follows from gauge invariance.:cite[p4-weyl1929] This is the content of the previous section, and the name stayed with it.
:::

## From a phase to matrices

Everything above used the group of phases e<sup>iα</sup>, called **U(1)**: the group of 1 × 1 unitary matrices. Phases commute: rotating by α and then β is the same as β and then α. Gauge theories for forces other than electromagnetism use larger groups of matrices, and the field ψ becomes a vector with several components on which the matrices act.

- **SU(2)** is the group of 2 × 2 unitary matrices with determinant 1. It acts on a pair of fields (for example the up-type and down-type members of a weak doublet, Chapter 23). It needs **three** gauge fields. (The isospin SU(2) of Chapter 12, which exchanges the up and down quarks, is a different thing: an approximate symmetry of the strong force that is not gauged. The weak SU(2) of this chapter acts on different quantum numbers and is exact before the Higgs mechanism.)
- **SU(3)** is the group of 3 × 3 unitary matrices with determinant 1. It acts on the three colours of a quark and needs **eight** gauge fields: the gluons. (Again different from the approximate flavour SU(3) of the Eightfold Way in Chapter 12, which was a pattern in the hadron masses, not a force.)

Every such group is generated by a few matrices *T*<sub>a</sub>, its **generators**: any group element near the identity is $\exp(i\sum_a\theta_aT_a)$ with small real θ<sub>a</sub>. The number of generators is the dimension of the group: one for U(1), $n^2-1$ for SU(*n*): 3 for SU(2) (the Pauli matrices divided by two) and 8 for SU(3) (the Gell-Mann matrices divided by two). There is one gauge field for each generator.

The crucial difference from U(1) is that matrices in general do not commute, and the failure is measured by the **commutator**:

:::equation{#commutator caption="The generators of a non-abelian group close under the commutator, with structure constants f_abc."}
$$[\term{T}{T_a}, T_b] = T_aT_b - T_bT_a = i\,\term{f}{f_{abc}}\,T_c$$

```terms
T:
  label: 'T_a, a generator'
  what: 'One of the n² − 1 Hermitian matrices that generate the group: the Pauli matrices σ_a/2 for SU(2), the Gell-Mann matrices λ_a/2 for SU(3). They are normalised so that Tr(T_aT_b) = δ_ab/2.'
  why: A small transformation is 1 + iθ_aT_a. Applying two small transformations in the two orders gives results that differ by the commutator.
  effect: For U(1) the single generator commutes with itself, [T, T] = 0, and the order of transformations never matters.
f:
  label: 'f_abc, the structure constants'
  what: A set of numbers, totally antisymmetric in a, b, c, that say which generator the commutator of two others is. For SU(2), f_abc is the Levi-Civita symbol (f₁₂₃ = 1). For SU(3), f₁₂₃ = 1, f₁₄₇ = ½, f₄₅₈ = √3/2, and so on.
  why: They are the same in every representation of the group, so they are properties of the group, not of the particles it acts on.
  effect: 'They decide how the gauge fields couple to each other: in the field strength they multiply a term with two gauge fields.'
```
:::

The figure computes the commutators and group elements numerically. Pick two :term[generators]{id=generator}, read off the structure constants from the matrices, and check that a group element exp(iθ*T*) is unitary with unit determinant.

::gauge-groups{n="17.2" caption="U(1), SU(2) and SU(3) as matrices. The generators are shown as matrices (the two selected are outlined). The commutator of two of them is computed from the matrices and written as a sum of generators with the structure constants f_abc. Finite elements exp(iθT_a) and exp(iφT_b) are built numerically: they are unitary and have determinant one, and for SU(2) and SU(3) the order in which two are applied matters (for U(1) it never does). The numbers of generators, 1, 3 and 8, are the numbers of gauge bosons: the photon, the three weak bosons and the eight gluons."}

When the matrices do not commute, the :term[field strength]{id=field-strength} acquires an extra term. The gauge fields are *A*<sup>a</sup><sub>μ</sub>, one per generator, and

$$F^a_{\mu\nu} = \partial_\mu A^a_\nu - \partial_\nu A^a_\mu + g\,f^{abc}A^b_\mu A^c_\nu .$$

The last term is built from the commutator. It has two consequences, both of which matter later. The energy $-\tfrac14F^a_{\mu\nu}F^{a\mu\nu}$ contains terms with three and four gauge fields: **the gauge bosons interact with each other**. A gluon carries colour charge and can emit and absorb gluons, which is the triple-gluon vertex of Chapter 15 and the origin of asymptotic freedom and confinement in Chapter 18. The W bosons carry weak charge and couple to each other and to the Z and the photon (Chapter 23). The photon, in contrast, belongs to an abelian group: *f* = 0, and the photon is electrically neutral and does not interact with itself, which is why there is no γγγ vertex.

The Standard Model is the gauge theory of the group SU(3) × SU(2) × U(1): eight gluons, three weak bosons and one more, twelve gauge bosons in all, which become the gluons, the W<sup>+</sup>, W<sup>−</sup>, Z and the photon after the symmetry between the last two factors is broken in Chapter 26. The symmetry as constructed in this chapter forbids masses for the gauge bosons, and the W and Z are heavy. That is why the story needs Chapter 26.

```numeric
id: gauge-bosons-su4
title: Gauge bosons of a larger group
prompt: 'A gauge theory is built on the group SU(4), the 4 × 4 unitary matrices of determinant 1. How many gauge bosons does it have?'
answer: 15
unit: ''
tolerance: 0.01
hints:
  - The number of generators of SU(n) is n² − 1.
explain: 'There is one gauge boson per generator, and SU(n) has n² − 1 of them: 15 for n = 4. The same rule gives 3 for SU(2) and 8 for SU(3). A group of n × n matrices has n² complex entries, the unitarity condition removes n², and the determinant condition one more.'
```

```quiz
q: 'In the phase dial, a student turns every arrow by its own random angle and leaves the link field alone. The covariant energy jumps. What would restore it?'
options:
  - text: Turning every arrow back by the same angle.
    why: 'That would restore it only if the original rotation were the same at every site. A different angle at each site has to be undone site by site, or compensated by the link field.'
  - text: 'Shifting each link variable by the difference of the angles of the two sites it joins: A_ij → A_ij + α_i − α_j.'
    correct: true
    why: 'That is the gauge transformation of the link field. It exactly cancels the effect of the rotation in the covariant difference ψ_i − e^{iA_ij}ψ_j, so the covariant energy and the flux through every square are unchanged.'
  - text: Adding more arrows to the grid.
    why: 'The number of sites plays no part. The energy depends on the differences between neighbours, and the freedom to rotate them has to be paired with a change in the link field.'
```

## A deeper look: gauge theory on a lattice

The lattice version of the phase dial is not only a picture: it is the way gauge theories are computed when perturbation theory fails. Replace the grid of arrows by a lattice of **link variables** $U_{ij} = e^{i\theta_{ij}}$, one phase per edge, which are the exponentials of the link field of Figure 17.1. The gauge-invariant object is the product of links around a closed loop, and the simplest is the **plaquette**, the product around one square, whose angle θ<sub>p</sub> is the sum of the link angles around the square, taken in the direction of travel. The action of the pure gauge theory is

$$S = \beta\sum_p\left(1 - \cos\theta_p\right),\qquad \beta = 1/g^2,$$

which for small angles is $\tfrac12\beta\sum\theta_p^2$, the sum of squared field strengths of Maxwell's theory. The quantum theory is defined by averaging over all link configurations with the weight e<sup>−S</sup>, which is what a Monte Carlo can do: propose a change to one link, accept it with probability min(1, e<sup>−ΔS</sup>), and repeat. The measurable gauge-invariant quantities are averages of products of links around loops, **:term[Wilson loops]{id=wilson-loop}**.

::lattice-gauge{n="17.3" caption="Optional deep dive: a two-dimensional U(1) lattice gauge theory by Monte Carlo, with the exact answers beside it. Small β is strong coupling: the plaquette angles are random. Large β is weak coupling: they are nearly zero. The average plaquette is compared with the exact result I₁(β)/I₀(β), where I are modified Bessel functions. Wilson loops of R × T squares have ⟨W⟩ = exp(−σRT) where σ = −ln(I₁/I₀): the logarithm falls on a straight line against the area, an 'area law'. The scan button sweeps β. A larger lattice can run on the GPU where the browser supports it; the CPU version is complete."}

In two dimensions the plaquettes are statistically independent in a suitable gauge, so the average of a Wilson loop of area *A* is just the plaquette average to the power *A*, and the **area law** ⟨*W*⟩ = e<sup>−σA</sup> holds at every coupling. The figure checks both facts against Monte Carlo. The area law is the signature of a potential energy between a pair of static charges that grows linearly with their separation: a constant force, as in a string. In QED in three space dimensions the law is a perimeter law and the force falls off; in the theory of the strong force it is the area law, which is what confinement means. Chapter 18 returns to this, with Wilson's 1974 lattice formulation as its history card.

```fermi
id: gauge-lattice-memory
title: Memory for one gluon field configuration
prompt: 'A lattice QCD calculation uses a lattice of 64 × 64 × 64 × 64 sites in four dimensions. Every site has four links in the four directions, and each link holds an SU(3) matrix, which a simple program stores as 3 × 3 complex numbers, 18 doubles of 8 bytes each. About how much memory does one configuration of the gluon field need, in gigabytes?'
answer: 9.7
unit: GB
factor: 3
hints:
  - 64⁴ = 1.68 × 10⁷ sites, with 4 links each.
  - Each link is 18 numbers of 8 bytes.
explain: "4 × 64⁴ = 6.7 × 10⁷ links, times 18 × 8 = 144 bytes, is 9.7 × 10⁹ bytes. A single configuration of the gluon field uses about ten gigabytes in this naive storage (less than half of that if only the eight real parameters of each matrix were kept), and a calculation uses thousands of configurations, each updated with many thousands of Monte Carlo sweeps. That is why lattice QCD is done on supercomputers."
```

:::programmer
A gauge theory is **comparison across frames**. The value of ψ at one point is stored in that point's own local convention, like a pointer in a separate address space or a coordinate in a local chart; to compare two such values you need a rule for translating between frames. The :term[gauge field]{id=gauge-field} is that rule, one translation (the link) per edge. A gauge transformation is a re-choice of the local frames, and a physical quantity is one that does not depend on the choice, in the way that a graph invariant does not depend on how the nodes are numbered. Programmers meet the same structure when merging replicated state: the data are what matter, the frame in which each replica stored them is bookkeeping, and the meaningful operations are those that give the same answer however the bookkeeping is chosen. The Phase dial's covariant energy is such an operation.
:::

:::hood[Gauge transformations on a grid]
The Phase dial and its tests use `hep/fields/gauge.ts`. The rule for transforming the link field is one line per direction, and it is what the figure's gauge-transformation button runs:

```ts
export function transformLinks(A: LinkField, alpha: ArrayLike<number>): void {
  const L = A.L;
  for (let y = 0; y < L; y++)
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      if (x < L - 1) A.ax[i] = A.ax[i]! + alpha[i]! - alpha[i + 1]!;
      if (y < L - 1) A.ay[i] = A.ay[i]! + alpha[i]! - alpha[i + L]!;
    }
}
```

and the covariant energy sums $|\psi_i - e^{iA_{ij}}\psi_j|^2$ over the edges, where `covDiff2` rotates the neighbour by the link angle before subtracting:

```ts
function covDiff2(f: PhaseField, i: number, j: number, A: number): number {
  const c = Math.cos(A);
  const s = Math.sin(A);
  const jr = f.re[j]! * c - f.im[j]! * s;
  const ji = f.re[j]! * s + f.im[j]! * c;
  return (f.re[i]! - jr) ** 2 + (f.im[i]! - ji) ** 2;
}
```

The test suite checks the three claims of the figure on random fields: a global rotation leaves the naive energy alone; a local rotation changes it; the combined local rotation and link transformation leave the covariant energy and every plaquette flux unchanged to rounding. Telescoping is the reason: the sum of α<sub>i</sub> − α<sub>j</sub> around a closed square is zero, since each α<sub>i</sub> is added once and subtracted once.
:::

:::experiments
Gauge invariance makes sharp predictions, and experiments test them. The photon mass limit quoted above (about 10⁻¹⁸ eV, from the Particle Data Group's compilation of limits) is one. Another is **charge conservation** itself, which Noether's theorem ties to the global symmetry: searches for the decay of an electron into a photon and a neutrino, which would violate it, set a lifetime limit longer than 10²⁶ years.:cite[pdg2024] At CERN the :term[non-abelian]{id=non-abelian} structure is tested in a different way: the triple coupling of the W bosons to the photon and the Z, which the symmetry fixes, was measured at LEP and at the LHC (Chapter 23). The coupling of three gluons is probed by the rate of three-jet events (Chapter 18).

The lattice computations of this chapter are carried out by collaborations of theorists on supercomputers: the calculation of the masses of the proton and the neutron, of the pion decay constant and of the strong coupling from first principles is the largest-scale use of gauge theory today. The generators of the experiments (Chapter 18) use none of it, but their parameters are checked against it.
:::

:::history{year=1954 title="Yang and Mills" people="Chen Ning Yang, Robert Mills" source="Sources: Yang and Mills (1954)."}
In 1954, working at Brookhaven National Laboratory, Chen Ning Yang and Robert Mills asked whether the proton–neutron isospin symmetry, which the nuclear force respects, could be made local in the way that Weyl's phase symmetry had been. A rotation in the space of the two nucleon states, chosen independently at every point, needs a gauge field with a component for each of the three generators of SU(2), and the commutator makes the field act on itself.:cite[p4-yang1954] They derived the field strength given above.

The theory had a problem: the symmetry requires the three gauge bosons to be massless, and a massless particle exchanged between nucleons would give a long-range nuclear force, which is not observed. It was not applied to a real force at the time. It was the SU(2) of the weak interactions that Glashow, Weinberg and Salam used in the 1960s (Chapter 23), the SU(3) of colour in the 1970s (Chapter 18), and the proof by 't Hooft and Veltman that such theories give finite predictions, in 1971 and 1972, that made them usable. Two decades separate the paper from the Standard Model, a long delay between a good idea and its use.
:::

## What comes next

The chapter has given the mechanism: a symmetry, made local, brings its own force with it, with the coupling fixed by the symmetry and the number of force carriers equal to the number of generators. For U(1) the result is QED. [Chapter 18](/chapters/qcd/) applies it to SU(3), with matrices in place of a phase. The gluons carry the charge they couple to, which changes the behaviour of the coupling completely: it gets weaker at high energy and stronger at low, so that quarks are free inside a proton and permanently bound in it. The area law of the last section is where that story starts.

## Further reading

- Noether's paper and Kosmann-Schwarzbach's history of the two theorems (:cite[p4-noether1918,p4-kosmann2011]).
- Weyl's 1929 paper, and Yang and Mills (1954) for the original treatment of non-abelian gauge fields (:cite[p4-weyl1929,p4-yang1954]).
- Peskin and Schroeder, chapters 15 and 16, for non-abelian gauge theory (:cite[p4-peskin1995]).
- [Appendix A](/appendix/maths/), on complex numbers and phases, and on matrices and unitarity, is the background for this chapter.
