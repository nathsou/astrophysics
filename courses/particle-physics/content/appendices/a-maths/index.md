---
number: A
title: Maths primers
summary: Complex numbers and phases, vectors and matrices, the calculus the course uses, probability and statistics in a page, Fourier intuition, and Lagrangians in brief.
---

Short refreshers, in the order the course needs them. Each section says where it is first used. None is a course in itself: if a topic is new to you, the references at the end of the appendix are the next step.

## Complex numbers and phases

A complex number is *z* = *x* + i*y*, with i² = −1. Its **modulus** is |*z*| = √(*x*² + *y*²), its **conjugate** *z*\* = *x* − i*y*, and |*z*|² = *zz*\*. The exponential form uses Euler's formula,

$$e^{i\theta} = \cos\theta + i\sin\theta,$$

so that a complex number is *z* = *r* e^{iθ} with modulus *r* and **phase** θ. Multiplying adds phases and multiplies moduli. In quantum mechanics (Chapter 3) the state of a particle is described by a complex **amplitude**, the probability of an outcome is the squared modulus of the amplitude, and what you can change without changing any probability is the overall phase. That last sentence is the germ of gauge symmetry (Chapter 17). Where amplitudes from different routes add, their phases decide whether they reinforce or cancel: the interference of Chapter 3.

```numeric
id: a-complex
title: Modulus of a complex amplitude
prompt: 'What is |z| for z = 3 + 4i?'
answer: 5
tolerance: 0.001
```

## Vectors and matrices

A **vector** has components, a length and a direction. The dot product is **a**·**b** = *a*<sub>x</sub>*b*<sub>x</sub> + *a*<sub>y</sub>*b*<sub>y</sub> + *a*<sub>z</sub>*b*<sub>z</sub> = |**a**||**b**| cos θ. A **matrix** is a table of numbers that turns vectors into vectors, (*M***v**)<sub>i</sub> = Σ<sub>j</sub> *M*<sub>ij</sub>*v*<sub>j</sub>. Applying one matrix after another is matrix multiplication, which, unlike multiplication of numbers, depends on the order (*AB* ≠ *BA* in general).

Three ideas recur:

- **Rotations** are matrices that keep lengths: in two dimensions, R(θ) = [[cos θ, −sin θ], [sin θ, cos θ]]. Chapter 2's boosts are the same idea in spacetime: matrices that keep *E*² − |**p**|².
- **Eigenvectors.** If *M***v** = λ**v**, the vector **v** is an *eigenvector* of *M* and λ its *eigenvalue*. A **stable** lattice of magnets (Chapter 20) is one whose one-turn matrix has eigenvalues of modulus 1; the quark-mixing matrix of Chapter 24 is diagonalised to find its physical content.
- **Unitary matrices**, which satisfy *U*†*U* = 1 (*U*† is the conjugate transpose), are the complex version of rotations: they preserve the total probability, Σ|amplitude|² = 1. The CKM matrix of Chapter 24 and the neutrino mixing matrix of Chapter 31 are unitary.

The three **Pauli matrices**, σ<sub>x</sub> = [[0, 1], [1, 0]], σ<sub>y</sub> = [[0, −i], [i, 0]], σ<sub>z</sub> = [[1, 0], [0, −1]], describe the spin of an electron (Chapter 3). The special unitary groups SU(2) and SU(3) of Chapters 12 and 17 are the sets of unitary matrices of determinant 1 in two and three dimensions.

## Calculus

Derivatives and integrals are used in their plain form. Four facts carry most of the course.

- **Exponentials.** The solution of d*N*/d*t* = −*N*/τ is *N*(*t*) = *N*<sub>0</sub> e^{−*t*/τ}. It is the law of radioactive decay and of the decay of every unstable particle (Chapter 3), and of the absorption of a beam in matter (Chapter 6).
- **Small angles.** For small θ, sin θ ≈ θ, cos θ ≈ 1 − θ²/2 and tan θ ≈ θ. More generally the Taylor series *f*(*x*) ≈ *f*(0) + *f*′(0)*x* + ½*f*″(0)*x*² turns a hard function into a polynomial when the variable is small.
- **The Gaussian integral** ∫ e^{−*x*²/2σ²} d*x* = σ√(2π). It normalises the Gaussian distribution and appears in every uncertainty estimate.
- **Partial derivatives.** ∂*f*/∂*x* is the derivative with respect to *x* with the other variables held fixed. Fields (Chapter 14) are functions of space and time, and their equations are built from ∂/∂*t* and ∂/∂*x*.

## Probability and statistics in a page

Particle physics is a statistical science: a single collision tells you little, and a million tell you a lot.

- **Expectation and variance.** The mean of a random quantity *x* is ⟨*x*⟩ and its variance is ⟨(*x* − ⟨*x*⟩)²⟩. The standard deviation σ is the square root of the variance. For *N* independent measurements, the uncertainty on their mean is σ/√*N*.
- **Gaussian.** The normal distribution with mean μ and width σ, *f*(*x*) = e^{−(*x*−μ)²/2σ²}/(σ√(2π)), is what sums of many small effects converge to (the central limit theorem). About 68 % of values lie within ±1σ, 95 % within ±2σ, and 99.7 % within ±3σ.
- **Poisson.** When events occur independently at an average rate, the number counted in a fixed time has the Poisson distribution, *P*(*n*; μ) = μⁿ e^{−μ}/*n*!, with mean μ and variance μ. So counting *N* events has an uncertainty of √*N*. This is the source of the error bars on every histogram in the course (Chapters 3 and 28).
- **Likelihood.** The likelihood of a model is the probability of the observed data given the model's parameters. Maximising it fits the parameters; the width of its peak gives their uncertainties (Chapter 28).
- **Error propagation.** If *f* depends on independent quantities with uncertainties σ<sub>i</sub>, then σ_f² = Σ(∂*f*/∂*x*<sub>i</sub>)² σ<sub>i</sub>².
- **Breit–Wigner.** The shape of the mass distribution of an unstable particle (Chapter 3) is the *Cauchy* or Breit–Wigner distribution, *f*(*m*) ∝ 1/((*m* − *M*)² + Γ²/4), whose tails are far heavier than a Gaussian's.

```numeric
id: a-poisson
title: Counting statistics
prompt: A search counts 400 events in a window. By how much, as a fraction of the count, is the count uncertain (one standard deviation, Poisson)?
answer: 0.05
tolerance: 0.01
explain: "σ = √400 = 20, and 20/400 = 5 %. To halve the relative uncertainty you need four times as many events."
```

## Fourier intuition

Any reasonable function can be written as a sum of waves of different frequencies. A short pulse needs many frequencies and a long wave needs few: the width in time Δ*t* and the spread in frequency Δ*f* obey Δ*t* Δ*f* ≳ 1/(4π). The same relation links position and wave number, Δ*x* Δ*k* ≥ ½, and with *p* = ħ*k* it becomes the Heisenberg uncertainty principle of Chapter 3. It also explains why the natural width of a resonance and its lifetime are two sides of the same fact (Γ τ = ħ), and why a detector with fine position resolution needs to see high-momentum particles.

## Lagrangians in brief

Mechanics can be restated as a principle: out of all paths from A to B, the particle takes the one that makes the **action** *S* = ∫ *L* d*t* stationary, where *L* = *T* − *V* is the kinetic energy minus the potential energy. The resulting equation, the Euler–Lagrange equation d/d*t* (∂*L*/∂*q̇*) = ∂*L*/∂*q*, reproduces Newton's second law. Its power is that it carries over unchanged to fields: for a scalar field φ(*x*, *t*), a **Lagrangian density**

$$\mathcal{L} = \tfrac12 (\partial_t\phi)^2 - \tfrac12 (\nabla\phi)^2 - \tfrac12 m^2\phi^2$$

gives the Klein–Gordon equation, whose solutions are waves with *E*² = *p*² + *m*² (Chapter 14). Symmetries of the Lagrangian correspond to conserved quantities (Noether's theorem, Chapter 17), and interactions are added as further terms. The whole Standard Model is one Lagrangian; Chapters 14 to 26 build it up a term at a time.

## Further reading

- For the physics-flavoured mathematics, any first-year text such as Riley, Hobson and Bence, *Mathematical Methods for Physics and Engineering* (Cambridge).
- For statistics, G. Cowan, *Statistical Data Analysis* (Oxford, 1998), and the statistics chapters of the Particle Data Group's *Review of Particle Physics* (:cite[pdg2024]).
- The [astrophysics course's primers](/astrophysics/ch/primer-vectors/) on vectors, functions, calculus and waves cover the same ground at a gentler pace.
