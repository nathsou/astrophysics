---
number: 15
title: Feynman diagrams
summary: Each term in the perturbation series of a scattering is a graph with lines for particles and vertices for interactions. The chapter shows how to read one, how to count its powers of the coupling, how the enumerator of the course finds them all, and what a diagram does not mean.
duration: About 2½ hours
prerequisites: [fields-and-particles]
---

Chapter 14 built fields, quanta and the propagator, and left a question open: given two particles that arrive, interact and leave, how do you compute the probability of what leaves? The answer, found in the late 1940s, is a recipe of drawings. You draw every graph with the right external lines that the interaction terms allow. Each graph stands for one term of a series, and there are rules for turning the drawing into a number. Below is the simplest one for the simplest process of this part of the course: an electron and a positron annihilate into a photon, which becomes a muon and an antimuon.

::feynman{process="e+ e- > mu+ mu-" forces="qed" n="15.1" caption="The one tree diagram of e⁺e⁻ → μ⁺μ⁻ in QED. Time runs from left to right. A straight line with an arrow is a fermion, and an arrow pointing back against the flow of time is an antifermion, so the incoming positron is drawn as an electron going backwards. The wavy line is a photon. Each dot is a vertex where an electron line and a photon line meet. The photon carries the whole energy of the collision and is never observed."}

This chapter explains how to read that picture, what it is worth, and, equally important, what it is *not*. Chapter 16 will turn the drawing into a cross-section.

## The grammar: lines and vertices

A :term[Feynman diagram]{id=feynman-diagram} is a graph. Its **external lines** are the particles that come in and go out, and they are the only part a detector sees. Its **internal lines** join :term[vertices]{id=vertex} to each other. Its **vertices** are the interaction terms of Chapter 14: the points where lines meet. The grammar is short.

- **Lines.** A straight line with an arrow stands for a fermion (a quark or a lepton), and the arrow marks the flow of the fermion number. A fermion line, followed forwards in time, is a particle; followed backwards against the arrow, it is the antiparticle. A wavy line is a photon, a W or a Z boson, a curly line a gluon, and a dashed line a Higgs boson (the conventions of this course; other books vary).
- **Vertices.** A vertex is one term in the interaction. In QED there is only one: a fermion line comes in, a fermion line of the same type goes out, and a photon line is attached. The Standard Model has more, listed below.
- **Conservation at a vertex.** Energy and momentum flow into a vertex equal those flowing out. Electric charge, baryon number and each lepton number are conserved at every vertex, and so is the fermion arrow: one fermion line goes in and one goes out.

That is enough to decide whether a vertex is allowed. A photon may join an electron to an electron, and not an electron to a muon (lepton flavour) or an electron to a proton (charge and baryon number). The library's `checkVertex` does this check and returns the reason in words, and the sketchpad below uses it.

| Vertex | Interaction | Strength at each vertex |
|---|---|---|
| f f̄ γ | electromagnetic | $e\,Q_f$ with $e=\sqrt{4\pi\alpha}$ |
| q q̄ g | strong | $g_s=\sqrt{4\pi\alpha_s}$ |
| g g g, g g g g | strong (gluon self-coupling, Chapter 18) | $g_s$, $g_s^2$ |
| f f̄ Z, f f′ W | weak | of order $e$ (Chapter 23) |
| W W γ, W W Z | electroweak | of order $e$ |
| f f̄ H | Higgs (Yukawa) | $\sqrt2\,m_f/v$, proportional to the fermion mass (Chapter 26) |

The vertices that do *not* exist matter as much as those that do. There is no γγγ vertex, because the photon carries no electric charge and so has nothing to couple to. There is no Z or photon vertex that turns one flavour of quark into another. There is no vertex for a quark turning into a lepton. The diagram enumerator in the library is nothing more than these rules, applied exhaustively.

## From drawing to number

Each part of the diagram stands for a factor in the amplitude **M**, a complex number whose squared modulus is (proportional to) the probability of the process. The table is the set of Feynman rules of QED. The *form* of each is worth knowing even though this chapter will not evaluate them (Chapter 16 does).

:::equation{#amplitude caption="The amplitude of e⁺e⁻ → μ⁺μ⁻ by photon exchange: one factor per external line, one per vertex, one for the internal photon."}
$$i\mathcal M = \underbrace{\left[\bar v(p_2)\,(-ie Q_e\,\gamma^\mu)\,u(p_1)\right]}_{\text{electron side}}\;\term{prop}{\frac{-i\,g_{\mu\nu}}{q^2}}\;\underbrace{\left[\bar u(k_1)\,(-ie Q_\mu\,\gamma^\nu)\,v(k_2)\right]}_{\text{muon side}},\qquad \term{q2}{q^2} = (p_1+p_2)^2 = s$$

```terms
prop:
  label: 'the photon propagator'
  what: The factor for the internal photon line, −i g_μν / q². It is the massless case of the propagator 1/(q² + m²) of Chapter 14, written for a particle with a polarisation index.
  why: Every internal line gives one propagator, and it depends only on the momentum q flowing through the line.
  effect: It falls as 1/s at large energy. That single factor is where the 1/s in σ = 4πα²/3s comes from.
q2:
  label: 'q², the momentum flowing through the photon'
  what: The square of the four-momentum of the virtual photon. Here it is the whole energy of the collision, q² = s = (p₁ + p₂)².
  why: Energy and momentum are conserved at each vertex, so the photon carries the total momentum of the incoming pair.
  effect: For a photon exchanged between two electrons, q² is negative (a spacelike line). For annihilation it is positive, and the line is off shell because the massless photon would need q² = 0.
```
:::

Read the equation from left to right, as a sentence. On the left the incoming electron (*u*, with momentum *p*<sub>1</sub>) and incoming positron (*v̄*, *p*<sub>2</sub>) meet at a vertex, where a factor of *e* times the electron's charge $Q_e = -1$ appears, together with a matrix γ<sup>μ</sup> that carries the spin information. The virtual photon carries the propagator. On the right the pair of muons is made at another vertex. Every vertex contributes one power of the coupling *e*. The spinors $u$, $v$ describe the spin state of each external fermion, and summing over all the spin states and averaging over the initial ones turns the amplitude into a cross-section; Chapter 16 does it with helicity amplitudes.

The phases in these rules are conventions (other books put the *i* and the minus sign elsewhere), and only the modulus of the final sum matters.

## Counting the powers of the coupling

The great use of the rules is that the *power* of the coupling in a diagram can be read off without calculating anything. Each vertex contributes one factor of the coupling to the amplitude: *e* in QED, $g_s$ in QCD. A diagram with *V* cubic vertices has an amplitude proportional to $e^V$, and its contribution to a rate, which is the amplitude squared, to $e^{2V} = (4\pi\alpha)^V$. **The rate is of order α<sup>V</sup>.**

For e⁺e⁻ → μ⁺μ⁻ there are two vertices, so the rate is of order α². That is the α² of the cross-section σ = 4πα²/3s in Chapter 16. Adding a photon radiated from any line adds a vertex, so e⁺e⁻ → μ⁺μ⁻γ is of order α³: each extra photon costs one more power of α ≈ 1/137.

How many vertices does a diagram need? Count the ends of lines. Let the diagram be connected and have *n* external lines, *V* cubic vertices, *I* internal lines and *L* loops. Each vertex has three line-ends; each internal line has two ends at vertices; each external line one. So 3*V* = 2*I* + *n*. A graph's number of independent loops is $L = I - V + 1$ (Euler). Eliminating *I*:

:::equation{#order caption="The power of the coupling in a connected diagram with cubic vertices: n external lines and L loops."}
$$\term{V}{V} = \term{n}{n} - 2 + 2\,\term{L}{L}$$

```terms
V:
  label: 'V, the number of vertices'
  what: How many times the interaction term appears in the diagram. Each appearance gives one factor of the coupling e (or g_s) in the amplitude.
  why: The size of a diagram, relative to others of the same process, is fixed by V and the propagators.
  effect: The rate of the diagram is proportional to α^V.
n:
  label: 'n, the number of external lines'
  what: The number of particles, incoming and outgoing, in the process.
  why: A tree diagram of n external lines has exactly n − 2 vertices with cubic couplings, however it is drawn.
  effect: Adding a final-state particle adds one power of the coupling to the amplitude, so the rate loses one power of α.
L:
  label: 'L, the number of loops'
  what: The number of independent closed circuits in the diagram. A tree has L = 0; a box diagram has L = 1.
  why: A loop is a line that returns to itself, through extra vertices. Each closed circuit needs two more vertices than the tree has.
  effect: Every loop costs two more powers of the coupling in the amplitude, so one more power of α in the rate.
```
:::

For a :term[tree diagram]{id=tree-diagram} (*L* = 0) this says *V* = *n* − 2: four lines, two vertices; five lines, three; and so on, regardless of which tree it is. For a diagram with a quartic vertex, such as the four-gluon vertex, a vertex with *d* lines counts as $d - 2$ powers (a quartic vertex is of order $g_s^2$), and the formula still holds. The library's `diagramOrder` computes exactly this. The exercise at the end of the chapter asks you to write it.

```fermi
id: diagrams-orders-needed
title: How many orders of α/π to reach a part in 10¹²?
prompt: 'Each extra loop in QED brings roughly a factor α/π = 1/(137.036 π) ≈ 2.3 × 10⁻³. The electron’s magnetic moment, the subject of Chapter 16, is measured with an uncertainty of about 10⁻¹³ in the number g. About how many powers of α/π must a theorist compute before the next term is smaller than 10⁻¹²?'
answer: 4.56
factor: 1.5
unit: orders
hints:
  - Solve (α/π)ⁿ = 10⁻¹² for n, by taking logarithms.
explain: "ln(10⁻¹²) / ln(2.32 × 10⁻³) = −27.63 / −6.06 = 4.56. So about five orders are needed, which is what theorists have done: the electron's g − 2 has been computed to five loops, the tenth order in the coupling e (Chapter 16). Chapter 16 gives the number of diagrams at each of those orders."
```

## Trees and loops

A **tree** diagram has no closed circuit. It is the leading term in the series for a process, and for a scattering, the only one that needs no integration. A **:term[loop]{id=loop-diagram}** diagram has a closed circuit of internal lines. Because energy and momentum flow round the loop unconstrained, the loop momentum is integrated over all values, and the integrals can diverge. The way to handle those divergences (renormalisation) is sketched in Chapter 16 and not derived in this course. Their observable effects are real and are found in Chapter 16: the magnetic moment of the electron, the Lamb shift and the running of α.

The library enumerates one-loop diagrams of small processes, and this is what it finds for the process of Figure 15.1.

::diagram-gallery{process="e+ e- > mu+ mu-" forces="qed" loops n="15.2" caption="All the one-loop diagrams of e⁺e⁻ → μ⁺μ⁻ in the library, without corrections on the external legs: two vertex corrections, two boxes and ten bubbles in the photon line (a loop of each charged fermion, and the W). Each is of order α⁴ in the rate: two more powers of α than the tree. Their sum is what the theory predicts for the next correction; the bubbles give the running of α in Chapter 16, and the vertex corrections are what give the electron its anomalous magnetic moment."}

The three kinds have names that recur through the course.

- **:term[Vacuum polarisation]{id=vacuum-polarisation}**: a loop in the middle of the photon line. The photon briefly becomes a fermion–antifermion pair, which annihilates back. It screens the charge of the source and makes α grow with energy (Chapter 16).
- **Vertex correction**: a photon exchanged across a vertex. It corrects the coupling of the electron to the photon and is responsible for the electron's anomalous magnetic moment α/2π (Chapter 16).
- **Self-energy**: a photon emitted and absorbed by the same line. It changes the apparent mass of the fermion and is the origin of the Lamb shift.

Whether loops are important depends on the size of α. For QED, α = 1/137 and the series converges fast enough to be useful to a part in 10¹²; for the strong force at low energy, α<sub>s</sub> is of order one, and the series is useless, which is why Chapter 18 needs a different approach there.

:::programmer
A Feynman series is a **truncated power series** in a small parameter, the same idea as a Taylor expansion with an error term of the next order. The tree diagram is the first term and each loop order adds a correction suppressed by α. The analogy has an unusual twist: Dyson argued in 1952 that the series in α, taken to all orders, does not converge, but is an *asymptotic* series. Terms first fall, and eventually grow. The best accuracy is reached by stopping at the smallest term, and for QED that term is far below anything measurable.:cite[p4-dyson1952] It resembles a numerical series whose partial sums improve up to a point and then get worse: you truncate at the order where the error stops shrinking.
:::

## What a diagram is, and what it is not

A diagram is easy to misread, because it looks like a picture of something happening. It is not. This list is the most important one in the chapter.

1. **It is a term in a sum, not an event.** The amplitude is the *sum* of all diagrams with the right external lines, to the order you want. Nature does not choose one. You cannot say which diagram "happened" in a given event, any more than you can say which slit a photon passed through in an interference experiment.
2. **Diagrams interfere.** Amplitudes add, then the sum is squared. In Bhabha scattering (Chapter 16) the annihilation and the scattering diagram interfere, and the interference term is a third, separate contribution to the cross-section, with its own sign. Probabilities of diagrams are not added.
3. **Lines are not trajectories.** The straight lines of the drawing do not show where a particle goes. An internal line represents a propagator, which integrates over all paths and all orderings in time. A diagram contains both time orderings of a vertex pair, for example the electron emitting a photon before the positron does, and the other way round. The antiparticle drawn as a particle moving backwards in time is a bookkeeping statement about the signs of momenta; nothing travels backwards.
4. **Internal lines are not observed.** A photon line inside a diagram is a virtual photon in the sense of Chapter 14: an off-shell propagator, never in a detector.
5. **The shape of the drawing does not matter.** Two diagrams with the same lines joined to the same vertices are the same diagram, however they are drawn. What matters is the *topology*, and the library's `canonicalForm` decides whether two drawings are the same graph.
6. **The expansion depends on the approximation.** A diagram exists only in a perturbative expansion. The same physics at strong coupling, where the series does not converge, has no useful diagram expansion, but it is still physics: a lattice calculation of Chapter 14's kind needs none.

### Crossing

If you turn a diagram on its side, you get a different process that is given by the same function. The rule is called **:term[crossing]{id=crossing}**: an incoming particle of momentum *p* is equivalent, in the amplitude, to an outgoing antiparticle of momentum −*p*. The diagram is unchanged; only the direction in which you read it differs. So e⁺e⁻ → μ⁺μ⁻ (an electron and a positron annihilating, read along the photon) and e⁻μ⁻ → e⁻μ⁻ (an electron scattering from a muon by exchanging a photon, read across it) are one diagram, read in two ways.

::feynman{process="e- mu- > e- mu-" forces="qed" n="15.3" caption="Electron–muon scattering by photon exchange. It is the diagram of Figure 15.1 rotated through 90°: the muon line that was outgoing is now read in the other direction. Annihilation e⁺e⁻ → μ⁺μ⁻ is the s-channel of this amplitude (the photon carries q² = s), and scattering is the t-channel (q² = t, negative). The same formula, with s and t exchanged, gives both cross-sections: the spin-averaged squared amplitude of e⁻μ⁻ → e⁻μ⁻ is 2e⁴(s² + u²)/t², and of e⁺e⁻ → μ⁺μ⁻ is 2e⁴(t² + u²)/s²."}

The kinematic variables in those formulas are the **:term[Mandelstam variables]{id=mandelstam}**, for a process with incoming momenta $p_1, p_2$ and outgoing $k_1, k_2$:

$$s = (p_1+p_2)^2,\qquad t = (p_1-k_1)^2,\qquad u = (p_1-k_2)^2,\qquad s+t+u = \sum m^2 .$$

For massless particles $s + t + u = 0$. The same crossing relates Compton scattering (γe⁻ → γe⁻), pair annihilation (e⁺e⁻ → γγ) and pair production (γγ → e⁺e⁻): one amplitude, three physical processes. The library confirms that each has two tree diagrams in QED; `crossing(d, 'in', i)` moves a leg across the arrow of a diagram and returns the diagram of the crossed process.

## Draw them yourself

The sketchpad below is the course's rule-checker. Choose a process, then draw lines between the points and assign particles to them. Each vertex is checked against the table above, and the reasons a vertex fails are given in words. When you have drawn every diagram, it says so.

::diagram-sketchpad{process="e+ e- > mu+ mu-" forces="qed,weak" n="15.4" caption="The diagram sketchpad. The answer key is the complete set of tree diagrams of the process that the vertex rules allow, enumerated by the same code that checks your drawing. With only QED there is one diagram for e⁺e⁻ → μ⁺μ⁻. With the weak force switched on there are two, since the Z boson can also carry the pair: a line of the same type as the photon's, with a mass of 91 GeV (Chapter 23). Try e+ e- > e+ e- (Bhabha): you should find two in QED, and four with the Z."}

```predict
q: 'A photon is radiated in the process e⁺e⁻ → μ⁺μ⁻γ, by photon exchange alone. Before you open the sketchpad, how many tree diagrams do you expect?'
options:
  - text: Two, with the photon radiated by the outgoing muon or the outgoing antimuon.
    why: 'Those are two of them (final-state radiation). The incoming electron and positron can radiate, too (initial-state radiation), before they annihilate.'
  - text: Four, with the photon radiated by the electron, the positron, the muon or the antimuon.
    correct: true
    why: 'Each of the four charged external lines can emit the photon, and in each case the rest of the diagram is the s-channel diagram of Figure 15.1. The count is confirmed by the enumerator, and agrees with the rule that a tree with five external lines has three vertices.'
  - text: Five, including one in which the photon comes off the virtual photon.
    why: 'There is no such diagram. The photon has no electric charge, so there is no vertex with three photon lines; the virtual photon cannot emit another photon.'
```

:::challenge[Four diagrams, not five]
A photon can be radiated in the final state of e⁺e⁻ → μ⁺μ⁻. Draw every tree diagram of **e⁺e⁻ → μ⁺μ⁻γ** in QED. You should find four: the photon is radiated from the incoming electron, the incoming positron, the outgoing muon or the outgoing antimuon. Then try to draw a fifth, with the photon coming off the virtual photon. The sketchpad refuses it. There is no vertex with three photon lines, because the photon has no charge to couple to, so the virtual photon cannot emit a photon. (At the level of loops there is a further reason: a loop of charged fermions with three photon ends vanishes, which is Furry's theorem, a consequence of the symmetry between particles and antiparticles.)
:::

```diagram
id: qed/ee-mumugamma
title: Radiation in e⁺e⁻ → μ⁺μ⁻γ
prompt: Draw every tree diagram of e⁺e⁻ → μ⁺μ⁻γ, using photon exchange only.
process: e+ e- > mu+ mu- gamma
answer: all
config: { forces: [qed] }
explain: 'Four diagrams: the photon comes off the incoming e⁻, the incoming e⁺, the outgoing μ⁻ or the outgoing μ⁺. In the first two it is initial-state radiation, which lowers the energy of the collision that reaches the virtual photon; in the last two, final-state radiation. A fifth, with the photon coming off the virtual photon, does not exist: there is no γγγ vertex.'
```

```diagram
id: qed/bhabha
title: Bhabha scattering
prompt: Draw the tree diagrams of e⁺e⁻ → e⁺e⁻ with photon exchange only.
process: e+ e- > e+ e-
answer: all
config: { forces: [qed] }
explain: 'Two diagrams: the s-channel, where the pair annihilates into a photon that makes a new pair, and the t-channel, where the electron and the positron exchange a photon and are deflected. They interfere (Chapter 16).'
```

## Under the hood: generating the diagrams

The enumerator does not search for drawings. It builds every tree from the vertex rules, in a way that produces each one exactly once. The idea is the one used to count binary trees. Treat *all* legs as incoming (crossing makes this possible: an outgoing e⁻ is an incoming e⁺), take the last leg as the root, and ask: *what can the vertex at the root look like?* It has two or three other lines leaving it, and each of those is either an external leg or the root of a smaller tree over a subset of the remaining legs. The code enumerates those subsets with the bit-mask idiom for listing the subsets of a set:

```ts
// k = 2: {low ∪ s, the rest}
for (let s = rest; ; s = (s - 1) & rest) {
  const b1 = low | s;     // the block containing the lowest leg
  const b2 = mask ^ b1;   // the other block
  if (b2) tryBlocks([b1, b2]);
  if (s === 0) break;
}
```

Because the block that contains the lowest leg is always the first one, each split of the legs is tried once. `tryBlocks` then asks the rule table `matchVertex` which particles can run on the lines joining the blocks to the root, and recurses, with results cached by (set of legs, particle on the root line). The result is a list of labelled trees, which `realise` turns into diagrams. A canonical form, which relabels the vertices in a fixed order, removes duplicates from graphs that differ only in how their vertices are numbered, and the **symmetry factor** of a diagram (1/2 for a gluon bubble, 1/*n*! for *n* identical final-state photons) comes from counting the graph's automorphisms.

The counts grow quickly with the number of external lines, which is the reason to have a program for it: e⁺e⁻ → μ⁺μ⁻ has 1 diagram in QED; with one photon, 4; with two, 20. For gluons the series goes 4 (gg → gg), 25 (gg → ggg) and 220 (gg → gggg). The last numbers are known results (quoted in the standard literature on multi-gluon amplitudes), and the course's tests check them.

:::experiments
The programs that do this at CERN are **matrix-element generators**: **MadGraph** (used through its MadGraph5_aMC@NLO version) and **Sherpa** with its own matrix-element generators (Comix, AMEGIC) enumerate the diagrams of a process from the Standard Model's vertex rules, exactly as above. They also evaluate the amplitude of each diagram numerically with helicity methods and sum them, and they handle processes with many final-state particles, where the number of diagrams reaches the tens of thousands. Recursion relations (Berends–Giele) are used to avoid listing the diagrams at all, because their cost grows much more slowly than the number of diagrams. The course's `hep/diagrams` generates the trees for the sketchpad and for the challenge above; `hep/gen` uses the final formulas of the diagrams, not a diagram-by-diagram sum.
:::

:::history{year=1948 title="Feynman's diagrams at the Pocono conference" people="Richard Feynman, Julian Schwinger" source="Sources: Schweber, QED and the Men Who Made It (1994); Feynman (1949)."}
By 1947 the problem was clear. Quantum electrodynamics gave finite answers at the lowest order and infinite ones at the next. In June 1947 the Shelter Island conference heard of the measured Lamb shift (Chapter 16) and started the work that let the infinities be absorbed into the mass and charge of the electron. Julian Schwinger and, independently in Japan, Sin-Itiro Tomonaga had found a way of doing this that kept the equations consistent with relativity at every step. It was a formidable formalism, worked out with operators.

At the conference at the Pocono Manor Inn in Pennsylvania, from 30 March to 1 April 1948, Schwinger gave a long lecture on his method, and Richard Feynman presented a different one, in which the terms of the series were pictured as paths and the lines drawn as diagrams. By the accounts of participants, collected in Schweber's history, the audience found Feynman's talk hard to follow and objected to it: Bohr, in particular, thought that the picture of particle paths contradicted the uncertainty principle. The accounts differ in detail; the talk is generally described as a failure.:cite[p4-schweber1994] The diagrams reached print in two papers by Feynman in 1949, *The theory of positrons* and *Space-time approach to quantum electrodynamics*.:cite[p4-feynman1949a,p4-feynman1949b]
:::

:::history{year=1949 title="Dyson shows that the three theories are one" people="Freeman Dyson, Richard Feynman, Julian Schwinger, Sin-Itiro Tomonaga" source="Sources: Dyson (1949); Nobel Foundation (1965)."}
The diagrams spread through Freeman Dyson. In 1949 Dyson published two papers showing that the methods of Tomonaga, Schwinger and Feynman are equivalent, and translating Feynman's diagrams into rules that other physicists could apply without the path picture. He also argued that the infinities can be absorbed, to every order, into the mass and charge of the electron.:cite[p4-dyson1949a,p4-dyson1949b]

Feynman, Schwinger and Tomonaga shared the Nobel Prize in Physics in 1965 for their work on quantum electrodynamics; Dyson was not among them.:cite[p4-nobel1965] The rules of this chapter, with their propagators and vertices, are the form in which the three formulations are used today.
:::

## What comes next

You can now read a diagram, count its powers of α, list all the diagrams of a process and say what the list means. [Chapter 16](/chapters/qed/) uses the simplest diagram of all, Figure 15.1, to compute a cross-section: σ = 4πα²/3s and the 1 + cos²θ angular distribution, derived with helicity amplitudes. It then looks at what the loops of Figure 15.2 do: they move α with energy, and they give the electron its anomalous magnetic moment.

## Exercises

```code
id: diagrams-coupling-order
title: The order of a diagram in the coupling
prompt: |
  A diagram is given as a graph: a list of node kinds (`'in'`, `'out'` for external legs and `'vertex'`) and a list of edges, each a pair of node indices. Write `couplingOrder(g)`, returning

  - `vertices`: the number of interaction vertices,
  - `loops`: the number of independent loops, from Euler's formula *loops = edges − nodes + connected components*,
  - `amplitude`: the power of the coupling in the amplitude. A vertex where *d* lines meet contributes *d − 2* powers (a cubic vertex one, a quartic vertex two),
  - `rate`: the power of α in the rate (amplitude squared), since $e^{2k} = (4\pi\alpha)^k$.

  Your function is checked against the library's `diagramOrder` on every tree diagram of several processes and on the one-loop diagrams of e⁺e⁻ → μ⁺μ⁻.
starter: |
  export interface Graph {
    nodes: ('in' | 'out' | 'vertex')[];
    edges: [number, number][];
  }

  export function couplingOrder(g: Graph): { vertices: number; loops: number; amplitude: number; rate: number } {
    // 1. count the vertices
    // 2. loops = edges − nodes + components (a union–find over the edges gives the components)
    // 3. amplitude = Σ over vertices of (degree − 2); rate = amplitude
    return { vertices: 0, loops: 0, amplitude: 0, rate: 0 };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { couplingOrder } from 'solution';
  import * as d from 'hep/diagrams';

  const E = 11, MU = 13, GAMMA = 22, G = 21;

  // a diagram of the library as a plain graph
  function graph(dg: d.Diagram) {
    const index = new Map(dg.nodes.map((n, i) => [n.id, i]));
    return {
      nodes: dg.nodes.map((n) => n.kind),
      edges: dg.edges.map((e) => [index.get(e.from)!, index.get(e.to)!] as [number, number]),
    };
  }

  test('e+ e- -> mu+ mu-: two vertices, no loops, α² in the rate', () => {
    const g = {
      nodes: ['in', 'in', 'out', 'out', 'vertex', 'vertex'] as ('in' | 'out' | 'vertex')[],
      edges: [[0, 4], [1, 4], [4, 5], [5, 2], [5, 3]] as [number, number][],
    };
    expect(couplingOrder(g)).toEqual({ vertices: 2, loops: 0, amplitude: 2, rate: 2 });
  });

  test('a box diagram has four vertices and one loop', () => {
    // e- e+ -> mu- mu+ through two photons: the square e-, mu-, mu+, e+ (vertices 4..7)
    const g = {
      nodes: ['in', 'in', 'out', 'out', 'vertex', 'vertex', 'vertex', 'vertex'] as ('in' | 'out' | 'vertex')[],
      edges: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 7], [7, 6], [6, 4]] as [number, number][],
    };
    const o = couplingOrder(g);
    expect(o.vertices).toBe(4);
    expect(o.loops).toBe(1);
    expect(o.rate).toBe(4);
  });

  test('a quartic vertex counts twice (gg -> gg by the contact term)', () => {
    const g = { nodes: ['in', 'in', 'out', 'out', 'vertex'] as ('in' | 'out' | 'vertex')[], edges: [[0, 4], [1, 4], [4, 2], [4, 3]] as [number, number][] };
    expect(couplingOrder(g)).toEqual({ vertices: 1, loops: 0, amplitude: 2, rate: 2 });
  });

  test('every tree diagram of several QED processes agrees with diagramOrder', () => {
    const processes: [number[], number[]][] = [
      [[-E, E], [-MU, MU]],
      [[-E, E], [-E, E]],
      [[-E, E], [-MU, MU, GAMMA]],
      [[-E, E], [-MU, MU, GAMMA, GAMMA]],
      [[E, GAMMA], [E, GAMMA]],
    ];
    for (const [ini, fin] of processes) {
      for (const dg of d.enumerateTreeDiagrams(ini, fin, { forces: ['qed'] })) {
        const ref = d.diagramOrder(dg);
        const mine = couplingOrder(graph(dg));
        expect(mine.loops).toBe(0);
        expect(mine.amplitude).toBe(ref.total);
        expect(mine.rate).toBe(ref.alpha);
        expect(mine.amplitude).toBe(ini.length + fin.length - 2);
      }
    }
  });

  test('gluon trees include the four-gluon vertex and are still of order n − 2', () => {
    for (const dg of d.enumerateTreeDiagrams([G, G], [G, G, G], { forces: ['qcd'] })) {
      const mine = couplingOrder(graph(dg));
      expect(mine.amplitude).toBe(3);
      expect(mine.amplitude).toBe(d.diagramOrder(dg).total);
    }
  });

  test('one-loop diagrams of e+ e- -> mu+ mu-: four vertices and one loop each', () => {
    const list = d.enumerateOneLoopDiagrams([-E, E], [-MU, MU], { forces: ['qed'] });
    expect(list.length).toBeGreaterThan(10);
    for (const dg of list) {
      const mine = couplingOrder(graph(dg));
      expect(mine.loops).toBe(1);
      expect(mine.vertices).toBe(4);
      expect(mine.amplitude).toBe(d.diagramOrder(dg).total);
    }
  });
solution: |
  export interface Graph {
    nodes: ('in' | 'out' | 'vertex')[];
    edges: [number, number][];
  }

  export function couplingOrder(g: Graph): { vertices: number; loops: number; amplitude: number; rate: number } {
    const n = g.nodes.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
    const degree = new Array<number>(n).fill(0);
    for (const [a, b] of g.edges) {
      parent[find(a)] = find(b);
      degree[a]!++;
      degree[b]!++;
    }
    const components = new Set(g.nodes.map((_, i) => find(i))).size;
    let vertices = 0;
    let amplitude = 0;
    g.nodes.forEach((kind, i) => {
      if (kind === 'vertex') {
        vertices++;
        amplitude += degree[i]! - 2;
      }
    });
    const loops = g.edges.length - n + components;
    return { vertices, loops, amplitude, rate: amplitude };
  }
hints:
  - 'A vertex with d lines contributes d − 2 powers of the coupling: 1 for a cubic vertex, 2 for a quartic one. Count the degree of each node from the edge list.'
  - 'Euler: loops = E − N + C. A tree has C = 1 and E = N − 1, so loops = 0. For the components, merge the two ends of every edge in a union–find and count the roots.'
```

```quiz
q: 'In e⁺e⁻ → μ⁺μ⁻ by photon exchange, the electron and the positron meet at a vertex and the photon travels to another. Which statement about the photon is right?'
options:
  - text: The photon is a real particle that exists for a short time between the two vertices, and a fast enough detector could catch it.
    why: 'The internal photon is off shell (q² = s, not 0), so it is not a particle in the sense of the final state, and no detector registers it. Chapter 14 explains what “virtual” does and does not mean.'
  - text: The photon line stands for a factor −i g_μν/q² in the amplitude, which enters the sum of all diagrams.
    correct: true
    why: 'Exactly: an internal line is a propagator. It contributes the factor 1/s to the amplitude and so the 1/s of the cross-section.'
  - text: The diagram shows the path taken by the particles, and the probability of the process is the probability that they take it.
    why: 'The lines are not trajectories. The amplitude is a sum over all diagrams, and the probability is the square of the sum, not a sum of probabilities of paths.'
```

```numeric
id: diagrams-rate-ratio
title: Suppression of an extra photon by the couplings alone
prompt: 'Taking only the powers of the coupling into account, and ignoring phase space, logarithms and propagators, by what factor is the rate of e⁺e⁻ → μ⁺μ⁻γ smaller than that of e⁺e⁻ → μ⁺μ⁻? Give 1/α for α = 1/137.036.'
answer: 137.036
tolerance: 0.001
hints:
  - The tree diagrams of μ⁺μ⁻γ have one more vertex than those of μ⁺μ⁻, so the rate has one more power of α.
explain: "One more vertex, one more power of α: the factor is α = 1/137, so the rate is about 137 times smaller from the couplings alone. In practice the ratio is not exactly α: the extra photon can be soft, which enhances the rate by logarithms, and phase space and propagators matter too. The couplings fix only the power."
```

## Further reading

- Feynman's two 1949 papers, and Dyson's, for the original presentations (:cite[p4-feynman1949a,p4-feynman1949b,p4-dyson1949a,p4-dyson1949b]).
- S. S. Schweber, *QED and the Men Who Made It* (1994), for the history of the three formulations, including the Pocono conference (:cite[p4-schweber1994]).
- Peskin and Schroeder, *An Introduction to Quantum Field Theory*, chapters 4 and 5, for the derivation of the rules from the Lagrangian (:cite[p4-peskin1995]).
- The course's `hep/diagrams` README lists the vertex table and the diagram counts that the tests verify.
