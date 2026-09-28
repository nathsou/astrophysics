---
number: 21
title: Euler’s formula and five colours
summary: V − E + F = 2, its many proofs and its many counterexamples — Lakatos’s story of how mathematics learns by refutation. Then maps and colours; Kempe’s famous flawed proof of the four-colour theorem, and Heawood’s rescue of five.
duration: About 3 hours
prerequisites: [invariants, induction]
theorems: [Euler’s formula V − E + F = 2, There are exactly five Platonic solids, The five-colour theorem (Heawood, 1890)]
techniques: [induction on edges, counterexamples and monster-barring, double counting, Kempe chains]
---

Count the corners, edges and faces of a cube: $8$, $12$ and $6$. Of a tetrahedron: $4$, $6$, $4$. Of an octahedron: $6$, $12$, $8$. Is there a pattern? In 1750 Euler wrote to Goldbach that for every solid bounded by flat faces,
$$V - E + F = 2,$$
where $V$, $E$ and $F$ count the vertices, edges and faces. It is one of the most beautiful formulas in mathematics — and one of the most instructive, because it is *not quite true*.

::polyhedra

The Platonic solids obey it. The picture frame gives $0$; the two tetrahedra joined at a corner give $3$. What does that mean for Euler's “theorem”?

## Proofs and refutations

In his book *Proofs and Refutations*, the philosopher Imre Lakatos imagined a classroom arguing about exactly this question.:cite[lakatos] A pupil offers a proof. Others produce counterexamples — the frame, the twin tetrahedra, a cube with a cubical hole inside, star-shaped polyhedra. Some want to bar these “monsters”: *that's not a polyhedron!* Others want to list exceptions. The most productive response is to look back at the proof, find the step that fails for the monster, and turn the hidden assumption behind that step into an explicit hypothesis — what Lakatos called **lemma incorporation**. The theorem gets sharper; the concept of polyhedron gets a definition.

Lakatos was describing real history. Euler stated the formula without a satisfactory proof. Legendre gave one in 1794 and Cauchy another in 1813; in the same year Simon Lhuilier published the picture frame and other counterexamples, and the nineteenth century spent decades working out exactly what the formula is about. The answer, once found, is clean: it is a theorem about **connected planar graphs**.

## Euler's formula for plane graphs

Remove one face of a polyhedron and stretch the rest flat, like a rubber sheet: the vertices and edges become a network drawn in the plane without crossings, and the removed face becomes the unbounded region outside. So polyhedra that can be flattened this way are examples of **plane graphs**: points joined by curves that meet only at their ends. A plane graph divides the plane into **faces**, including the outer one.

:::theorem{name="Euler’s formula" who="Euler; Cauchy; and others" year="1750–1813"}
For every connected graph drawn in the plane without crossings, with $V$ vertices, $E$ edges and $F$ faces (counting the outer face),
$$V - E + F = 2 .$$
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Delete edges that lie on a cycle, one at a time. Each deletion merges two faces into one, so $E$ and $F$ both drop by $1$ and $V - E + F$ doesn't change. When no cycles are left, the graph is a tree, with one face and $V - 1$ edges: $V - (V - 1) + 1 = 2$.
:::
:::level[Proof]
Induction on the number of edges $E$, for connected plane graphs.

If the graph has no cycle, it is a **tree**. A tree with $V$ vertices has $V - 1$ edges (induction: a tree with at least two vertices has a leaf — follow a path as far as it goes — and removing a leaf and its edge leaves a tree), and it has just one face, since there is no closed curve to enclose anything. So $V - E + F = V - (V - 1) + 1 = 2$.

Otherwise, pick an edge $e$ that lies on a cycle. The cycle is a closed curve, so (by the Jordan curve theorem) the faces on the two sides of $e$ are different: one inside the cycle, one outside. Deleting $e$ merges them into one face and keeps the graph connected (the rest of the cycle still joins the ends of $e$). The new graph has $E - 1$ edges and $F - 1$ faces, so by induction $V - (E - 1) + (F - 1) = 2$, which is $V - E + F = 2$.
:::
::::

The picture frame fails because it can't be flattened into a plane graph: it has a hole. For a surface with $g$ holes the formula becomes $V - E + F = 2 - 2g$, and the number $2 - 2g$, the **Euler characteristic**, turned out to be the first invariant of topology — a quantity that doesn't change under stretching (Chapter 20's idea again). The twin tetrahedra fail because their surface is not a single connected sheet away from the shared vertex. Each monster, taken seriously, taught something.

## What the formula forces

Euler's formula is a strong constraint, and combining it with a little counting gives surprising theorems. The first goes back to Book XIII of Euclid.

:::theorem{name="The five Platonic solids" who="Theaetetus; Euclid XIII.18"}
There are exactly five convex polyhedra whose faces are all congruent regular polygons with the same number meeting at every vertex: the tetrahedron, cube, octahedron, dodecahedron and icosahedron.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If every face has $p$ sides and every vertex has $q$ edges, counting edge-ends two ways gives $pF = 2E = qV$. Put this into Euler's formula: $\frac1p + \frac1q > \frac12$. There are only five pairs $(p, q)$ of whole numbers at least $3$ that satisfy this.
:::
:::level[Proof]
Let each face have $p \ge 3$ sides and each vertex degree $q \ge 3$. Each edge borders two faces and has two ends, so $pF = 2E$ and $qV = 2E$. Substituting $V = \frac{2E}{q}$ and $F = \frac{2E}{p}$ into $V - E + F = 2$ and dividing by $2E$:
$$\frac1q + \frac1p = \frac12 + \frac1E > \frac12 .$$
If $p, q \ge 3$ and both were at least $4$, or one were at least $6$, the left side would be at most $\frac12$. The solutions are $(p, q) = (3, 3), (3, 4), (4, 3), (3, 5), (5, 3)$, and each determines $E$, hence $V$ and $F$: the tetrahedron, octahedron, cube, icosahedron and dodecahedron. Each of the five exists, as the widget shows (the dodecahedron is the icosahedron's dual).
:::
::::

The same double counting shows that plane graphs can't have too many edges.

:::corollary
A simple connected plane graph with $V \ge 3$ vertices has at most $3V - 6$ edges. Hence the complete graph on five vertices, $K_5$, cannot be drawn in the plane without crossings, and every plane graph has a vertex of degree at most $5$.
:::

:::proof
Every face is bounded by at least $3$ edges and every edge borders at most $2$ faces, so $3F \le 2E$. Then $2 = V - E + F \le V - E + \frac{2E}{3}$, i.e. $E \le 3V - 6$. $K_5$ has $V = 5$ and $E = 10 > 9$. If every vertex had degree at least $6$, then $2E \ge 6V$, i.e. $E \ge 3V$, contradicting $E \le 3V - 6$.
:::

### A promise from Chapter 0

In Chapter 0 we met $n$ points on a circle, joined by all chords, and counted the regions: $1, 2, 4, 8, 16, 31, \ldots$ We can now prove the formula $1 + \binom n2 + \binom n4$. Treat the picture as a plane graph (for points in general position, where no three chords meet). Its vertices are the $n$ points and the crossing points; each crossing is determined by the four endpoints of the two chords through it, so there are $\binom n4$ of them. Each chord is cut by the crossings on it into pieces, and each crossing lies on two chords, so the chord pieces number $\binom n2 + 2\binom n4$; add $n$ arcs of the circle. Then Euler's formula gives the number of regions inside the circle: $F - 1 = E - V + 1$.

```step
title: Counting regions with Euler
prompt: 'With $V = n + \binom n4$ and $E = n + \binom n2 + 2\binom n4$, show that $E - V + 1 = 1 + \binom n2 + \binom n4$.'
domains: { n: posint }
start: (n + binom(n,2) + 2 binom(n,4)) - (n + binom(n,4)) + 1
target: 1 + binom(n,2) + binom(n,4)
relation: '='
initial: (n + binom(n,2) + 2 binom(n,4)) - (n + binom(n,4)) + 1
solution: 'The $n$''s cancel and $2\binom n4 - \binom n4 = \binom n4$.'
```

## Four colours

In 1852 a young graduate, Francis Guthrie, colouring a map of the counties of England, noticed that four colours were enough to give neighbouring counties different colours. He asked whether four colours always suffice. His brother passed the question to Augustus De Morgan, who wrote to William Rowan Hamilton about it the same day. It became the most famous unsolved problem in graph theory — easy to state, easy to believe, and for 124 years impossible to prove.

A map becomes a graph by putting a vertex in each country and joining neighbours; the graph is planar. The question is whether every planar graph can be **coloured** with four colours so that adjacent vertices differ.

:::history{year=1879 title="Kempe’s proof" people="Alfred Kempe, Peter Guthrie Tait, Percy Heawood"}
In 1879 the London barrister Alfred Kempe published a proof in the *American Journal of Mathematics*, and it was accepted. Kempe was elected a Fellow of the Royal Society, partly on its strength. Eleven years later, in 1890, Percy Heawood, a lecturer at Durham, found a subtle error: an example on which Kempe's argument breaks down. Heawood showed that Kempe's method does prove that *five* colours always suffice — and that was all anyone could prove until 1976.:cite[wilson-four-colours]
:::

## Five colours suffice

The proof uses Kempe's great idea. In a coloured graph, pick two colours, say red and yellow, and a vertex coloured one of them. The **Kempe chain** through it is everything you can reach from it by walking along red and yellow vertices. Swapping red and yellow throughout a chain leaves the colouring proper — inside the chain nothing changes that matters, and no vertex outside the chain that is red or yellow touches it (otherwise it would be in the chain).

::kempe-chains

:::theorem{name="The five-colour theorem" who="Percy Heawood (after Alfred Kempe)" year=1890}
Every planar graph can be coloured with five colours.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Induction on the number of vertices. Remove a vertex $v$ of degree at most $5$ and colour the rest. If $v$'s neighbours use fewer than five colours, colour $v$. If they use all five, look at the Kempe chains of two non-adjacent neighbours: a chain connecting them would form a closed loop around another neighbour, trapping that neighbour's chain inside. So at least one swap frees a colour.
:::
:::level[Proof]
Induction on the number of vertices. A graph with at most $5$ vertices can obviously be coloured. Let $G$ be planar with more vertices, and assume the theorem for smaller graphs. By the corollary above, $G$ has a vertex $v$ of degree at most $5$. Colour $G - v$ with five colours by the induction hypothesis.

If the neighbours of $v$ use at most four colours, give $v$ a missing one. Otherwise $v$ has exactly five neighbours $v_1, \ldots, v_5$, in clockwise order around $v$, coloured $1, 2, 3, 4, 5$.

Consider the Kempe chain of colours $1$ and $3$ containing $v_1$. If it does not contain $v_3$, swap colours $1$ and $3$ in this chain. The colouring stays proper, $v_1$ becomes $3$, $v_3$ is still $3$, and colour $1$ is free for $v$.

If it does contain $v_3$, there is a path from $v_1$ to $v_3$ whose vertices are coloured $1$ and $3$. Together with $v$, it forms a closed curve $v \to v_1 \to \cdots \to v_3 \to v$ in the plane. The neighbours $v_2$ and $v_4$ lie on opposite sides of this curve (they are separated by it in the cyclic order around $v$). Now consider the Kempe chain of colours $2$ and $4$ containing $v_2$. Any path from $v_2$ to $v_4$ would have to cross the curve — at a vertex, since the graph is plane — but the curve's vertices are coloured $1$, $3$ or are $v$ itself (uncoloured). So this chain does not contain $v_4$; swap colours $2$ and $4$ in it. Now $v_2$ is coloured $4$, and colour $2$ is free for $v$.
:::
::::

Notice the one step that uses planarity in an essential way: a closed curve separates the plane, so a chain can trap another. On a torus it cannot, and indeed maps on a torus can need seven colours — a fact Heawood also found.

```bug
title: Kempe’s four-colour proof
prompt: 'Here is the heart of Kempe''s 1879 argument for **four** colours, in the hard case: $v$ has five neighbours $v_1, \ldots, v_5$ (in order) coloured $1, 2, 3, 4, 2$ — all four colours, with colour $2$ used twice. Which step is the flaw that Heawood found?'
lines:
  - If the $1$–$3$ chain from $v_1$ does not reach $v_3$, swap it; colour $1$ is freed. Similarly for the $1$–$4$ chain from $v_1$ and $v_4$.
  - So assume there is a $1$–$3$ path from $v_1$ to $v_3$ and a $1$–$4$ path from $v_1$ to $v_4$.
  - The $1$–$3$ path traps $v_2$ away from $v_4$, so the $2$–$4$ chain from $v_2$ does not reach $v_4$; likewise the $1$–$4$ path traps $v_5$ away from $v_3$, so the $2$–$3$ chain from $v_5$ does not reach $v_3$.
  - Swap both chains at once — the $2$–$4$ chain from $v_2$ and the $2$–$3$ chain from $v_5$. Now $v_2$ is $4$ and $v_5$ is $3$, and colour $2$ is free for $v$.
wrong: 3
why: |
  Each swap on its own is safe, but not both together. The two chains can **touch**: a vertex of the $2$–$4$ chain may be adjacent to a vertex of the $2$–$3$ chain. After the first swap, some of those vertices have changed colour, so the second chain is no longer what the argument assumed, and after the second swap two adjacent vertices can end up the same colour. Heawood's 1890 example is a map where exactly this happens. With five colours the proof never needs two swaps, which is why it survives.
notes:
  '2': 'This is correct: each trapping argument is the same as in the five-colour proof.'
```

:::history{year=1976 title="Four colours suffice" people="Kenneth Appel, Wolfgang Haken, Georges Gonthier"}
In 1976 Kenneth Appel and Wolfgang Haken at the University of Illinois announced a proof of the four-colour theorem. It reduced the problem to checking 1,936 (later 1,482) configurations, each checked by computer — over a thousand hours of machine time. The university's postmark read *Four colours suffice*. Many mathematicians were uneasy: no human could check the proof. A simpler computer proof by Robertson, Sanders, Seymour and Thomas followed in 1997, and in 2005 Georges Gonthier verified the whole proof in the Coq proof assistant — every step, including the computer's, checked by a machine against the rules of logic. Chapter 22 returns to what that means.
:::

:::bio{name="Percy Heawood" born=1861 died=1955 place="Newport and Durham"}
Heawood spent his entire career at Durham, where he was known for his enormous moustache, his cape, his dog, and his habit of taking the dog to lectures. He worked on the four-colour problem for sixty years. His 1890 paper both demolished Kempe's proof and founded the study of colouring maps on other surfaces: he found the right number of colours for a surface with $g$ holes, though his proof covered only the upper bound (the rest was finished by Ringel and Youngs in 1968). He is also remembered in Durham for raising the money to save its castle, then threatened with collapse into the river.
:::

## Exercises

```prove
title: K₃,₃ is not planar
prompt: 'Three houses must each be connected to three utilities (gas, water, electricity) by lines that do not cross. Show that this is impossible: the graph $K_{3,3}$ is not planar.'
hints:
  - $K_{3,3}$ has $6$ vertices and $9$ edges, and $9 \le 3 \cdot 6 - 6 = 12$ — so the corollary above isn't enough.
  - '$K_{3,3}$ has no triangles (edges only join houses to utilities), so every face has at least $4$ edges.'
rubric:
  - You counted $V = 6$, $E = 9$.
  - 'You observed that there are no triangles, so each face is bounded by at least $4$ edges: $4F \le 2E$.'
  - 'You combined with Euler''s formula ($F = 2 - V + E = 5$) to get $20 \le 18$, a contradiction.'
solution: |
  Suppose $K_{3,3}$ were drawn in the plane. It has $V = 6$ and $E = 9$, so by Euler's formula $F = 2 - 6 + 9 = 5$. Every edge joins a house to a utility, so there is no cycle of length $3$ and every face is bounded by at least $4$ edges; each edge borders at most two faces, so $4F \le 2E$, i.e. $20 \le 18$. Contradiction.
```

```quiz
q: 'A soccer ball is made of pentagons and hexagons, with three faces meeting at every corner. How many pentagons must it have?'
options:
  - text: It depends on the number of hexagons.
    why: 'Try Euler''s formula with $3V = 2E$ and $2E = 5P + 6H$.'
  - text: Exactly 12.
    correct: true
    why: 'With $F = P + H$, $2E = 5P + 6H$ and $3V = 2E$: $V - E + F = \frac{2E}3 - E + P + H = 2$ gives $P = 12$, whatever $H$ is. (Carbon-60 molecules, “buckyballs”, have 12 pentagons too.)'
  - text: Exactly 20.
    why: '20 is the number of hexagons on a standard ball, which Euler''s formula does not determine.'
```

:::challenge
**Lakatos's cylinder.** A cylinder (a tin can) has $V = 0$ vertices? Two circular edges, three faces (top, bottom, side)? Decide what its vertices, edges and faces should be so that it counts as a “polyhedron”, and find out what $V - E + F$ becomes. Is it a counterexample, a monster to be barred, or a reason to refine the definitions? Read Lakatos to see how his pupils argued.
:::

## Further reading

- Imre Lakatos, *Proofs and Refutations* — a philosophy book written as a mathematics lesson, about this formula.:cite[lakatos]
- Robin Wilson, *Four Colors Suffice* — the full story of the four-colour problem.:cite[wilson-four-colours]
- David Richeson, *Euler's Gem* — Euler's formula, from polyhedra to topology.:cite[richeson]
