---
number: 18
title: Monsters
summary: A function continuous at every irrational and at no rational. A series of smooth waves that adds up to a jump. A continuous curve with no tangent anywhere, and one that fills a square. The counterexamples that forced analysis to become rigorous.
duration: About 2½ hours
prerequisites: [epsilon-delta, infinite-series]
theorems: [Thomae’s function is continuous exactly at the irrationals, Uniform limits of continuous functions are continuous, Weierstrass’s continuous nowhere-differentiable function (1872)]
techniques: [counterexamples, the ε/3 trick, uniform convergence, quantifier order]
---

In 1893 Charles Hermite wrote to his friend Thomas Stieltjes that he turned away “with fright and horror from this lamentable plague of continuous functions which have no derivative”.:cite[hermite-stieltjes] A few years later Henri Poincaré complained that where functions used to be invented for some useful purpose, they were now invented expressly to show that our fathers' reasoning was at fault.

They were right about the purpose, and wrong to complain. The strange functions of this chapter — mathematicians called them *monsters* — each refuted a statement that had been believed, taught and used for decades. Each one showed that an intuition was a hidden assumption, and forced a definition to become precise. They are the best illustration in all of mathematics of a technique you have been using since Chapter 0: **to disprove a universal claim, construct a counterexample.**

## A function that is nowhere continuous

In 1829 Peter Gustav Lejeune Dirichlet, writing about Fourier series, described a function that no one would have drawn:
$$D(x) = \begin{cases} 1 & \text{if } x \text{ is rational}, \\ 0 & \text{if } x \text{ is irrational.} \end{cases}$$
Every interval contains rationals and irrationals (Chapter 2), so every interval contains points where $D = 1$ and points where $D = 0$. $D$ is discontinuous at every point, and — since every upper sum is $1$ and every lower sum is $0$ on $[0, 1]$ — it has no Riemann integral (Chapter 15). Before Dirichlet, a “function” meant a formula or a curve. After him, it meant any rule assigning a value to each input, however wild.

## Popcorn

Carl Johannes Thomae modified Dirichlet's function in 1875 to get something stranger: a function continuous at some points and not at others, both kinds packed densely together.
$$T(x) = \begin{cases} \frac1q & \text{if } x = \frac pq \text{ in lowest terms } (q > 0), \\ 0 & \text{if } x \text{ is irrational.} \end{cases}$$

::popcorn

:::theorem{name="Thomae’s function" who="Carl Johannes Thomae" year=1875}
$T$ is continuous at every irrational number and discontinuous at every rational number.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
At a rational point $T$ is positive, but irrationals arbitrarily close have value $0$: a jump. At an irrational point $T = 0$, and only finitely many fractions near it (those with small denominators) have values above any given $\varepsilon$; stay away from those and $T$ is below $\varepsilon$.
:::
:::level[Proof]
*Rationals.* Let $a = \frac pq$, so $T(a) = \frac1q > 0$. Take $\varepsilon = \frac1q$. Every interval $(a - \delta, a + \delta)$ contains an irrational $x$ (Chapter 2), where $|T(x) - T(a)| = \frac1q \ge \varepsilon$. So no $\delta$ works: $T$ is discontinuous at $a$.

*Irrationals.* Let $a$ be irrational, so $T(a) = 0$, and let $\varepsilon > 0$. Choose $N > \frac1\varepsilon$. In the interval $(a - 1, a + 1)$ there are only finitely many fractions $\frac pq$ with $q \le N$ (for each such $q$, at most $2q + 1$ values of $p$). None of them equals $a$, so we can choose $\delta > 0$ smaller than the distance from $a$ to each of them (and $\le 1$). If $|x - a| < \delta$, then either $x$ is irrational and $T(x) = 0$, or $x = \frac pq$ with $q > N$ and $T(x) = \frac1q < \frac1N < \varepsilon$. Either way $|T(x) - T(a)| < \varepsilon$.
:::
::::

The proof uses a pattern worth remembering: to control infinitely many points, show that all but finitely many are harmless, and handle the finitely many by keeping away from them.

## Cauchy's mistake

Here is a theorem from Augustin-Louis Cauchy's *Cours d'analyse* of 1821, the book that made limits the foundation of analysis (Chapter 13).

> *If the terms of a convergent series are continuous functions of $x$, then its sum is a continuous function of $x$.*

It sounds right, and Cauchy gave a proof. In 1826 the young Norwegian Niels Henrik Abel pointed out, politely, that it “seems to admit exceptions”: Fourier series of continuous waves can add up to functions that jump.

::uniform-tube

Each partial sum is continuous; at every $x$ the partial sums converge; yet the limit jumps. What went wrong? The definition of convergence *at each point* says
$$\forall x\;\; \forall \varepsilon > 0\;\; \exists N\;\; \forall n \ge N: \quad |f_n(x) - f(x)| < \varepsilon ,$$
so the $N$ may depend on $x$. Near the jump, the partial sums need more and more terms to settle down, and no single $N$ works for all $x$ at once. Cauchy's proof silently used an $N$ that does not depend on $x$ — that is, it swapped “$\exists N$” past “$\forall x$”, the very quantifier error of Chapter 2.

:::definition
$f_n \to f$ **uniformly** on a set $S$ if $\;\forall \varepsilon > 0\;\; \exists N\;\; \forall n \ge N\;\; \forall x \in S: \; |f_n(x) - f(x)| < \varepsilon$.
:::

The only change is the position of $\forall x$. Geometrically: for every $\varepsilon$, from some $n$ on, the *whole* graph of $f_n$ lies in the $\varepsilon$-tube around $f$ — which is exactly what fails in the widget. With the correct hypothesis, Cauchy's theorem becomes true, and its proof introduces the “$\frac\varepsilon3$ trick”.

:::theorem{name="The uniform limit theorem" who="Seidel, Stokes, Weierstrass" year="1847–1860s"}
If each $f_n$ is continuous at $a$ and $f_n \to f$ uniformly, then $f$ is continuous at $a$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
To compare $f(x)$ with $f(a)$, go the long way round through one well-chosen $f_N$: from $f(x)$ to $f_N(x)$ (small, by uniformity), from $f_N(x)$ to $f_N(a)$ (small, by continuity of $f_N$), from $f_N(a)$ to $f(a)$ (small, by uniformity). Three small steps, $\frac\varepsilon3$ each.
:::
:::level[Proof]
Let $\varepsilon > 0$. By uniform convergence choose $N$ with $|f_N(y) - f(y)| < \frac\varepsilon3$ for **all** $y$. Since $f_N$ is continuous at $a$, choose $\delta > 0$ with $|f_N(x) - f_N(a)| < \frac\varepsilon3$ whenever $|x - a| < \delta$. Then for $|x - a| < \delta$,
$$|f(x) - f(a)| \le |f(x) - f_N(x)| + |f_N(x) - f_N(a)| + |f_N(a) - f(a)| < \frac\varepsilon3 + \frac\varepsilon3 + \frac\varepsilon3 = \varepsilon .$$
:::
::::

Look at where uniformity is used: the same $N$ must work at $x$ *and* at $a$, and $x$ is chosen after $N$. With merely pointwise convergence, the $N$ for $x$ would depend on $x$, and the argument collapses.

```bug
title: Cauchy’s proof
prompt: 'Here is a version of Cauchy''s 1821 argument that a pointwise limit of continuous functions is continuous. Find the step that needs uniform convergence.'
lines:
  - Let $f_n \to f$ at every point, each $f_n$ continuous, and fix $a$ and $\varepsilon > 0$.
  - Choose $N$ so large that $|f_N(a) - f(a)| < \frac\varepsilon3$.
  - Choose $\delta$ so that $|f_N(x) - f_N(a)| < \frac\varepsilon3$ when $|x - a| < \delta$.
  - For such $x$, also $|f(x) - f_N(x)| < \frac\varepsilon3$, because $N$ was chosen large.
  - Adding the three estimates, $|f(x) - f(a)| < \varepsilon$.
wrong: 3
why: |
  $N$ was chosen for the point $a$. Pointwise convergence at $x$ gives *some* $N_x$ with $|f(x) - f_n(x)| < \frac\varepsilon3$ for $n \ge N_x$, but $N_x$ may be much larger than $N$ — and it can't be chosen first, because $x$ is only chosen after $\delta$, which depends on $N$. Near the jump in the widget, that is exactly what happens.
```

:::bio{name="Augustin-Louis Cauchy" born=1789 died=1857 place="Paris, Turin and Prague"}
Cauchy published about 800 papers — only Euler wrote more — and his *Cours d'analyse* began the rigorous era of analysis. He founded complex analysis, the theory of determinants and much of the theory of elasticity. He was also a devout royalist who refused to swear allegiance to the new king after the revolution of 1830 and followed the exiled Bourbons to Turin and Prague, tutoring the heir to the throne. He was famously difficult with younger colleagues: a major memoir of Abel's lay mislaid in his papers for years. His 1821 error about series was not carelessness — the notion of uniform convergence simply did not yet exist, and the gap was found only by thinking hard about examples.
:::

## A curve with no tangents

Every function met in school is differentiable almost everywhere — a smooth curve, perhaps with a few corners. It was widely believed that a continuous function must be differentiable at *most* points, and there were even published “proofs”. On 18 July 1872 Weierstrass presented a counterexample to the Berlin Academy.:cite[weierstrass1872]

:::theorem{name="Weierstrass’s function" who="Karl Weierstrass" year=1872}
Let $0 < a < 1$ and let $b$ be an odd integer with $ab > 1 + \frac{3\pi}{2}$. Then
$$W(x) = \sum_{n=0}^\infty a^n \cos(b^n \pi x)$$
is continuous at every real number and differentiable at none.
:::

::weierstrass-zoom

The continuity is easy with the ideas above: the terms are bounded by $a^n$, and $\sum a^n$ converges, so the partial sums converge uniformly (a criterion known as the **Weierstrass M-test**), and the uniform limit theorem does the rest. The non-differentiability takes a page of careful estimates: near any point, the $n$th term oscillates with amplitude $a^n$ over a distance of order $b^{-n}$, so it contributes slopes of order $(ab)^n$, and the condition $ab > 1 + \frac{3\pi}2$ ensures that each new term's oscillations overwhelm everything before them. Zoom in: the graph never settles into a straight line, at any scale.

Bolzano had constructed such a function around 1830, but it lay unpublished for a century. In 1931 Stefan Banach and Stefan Mazurkiewicz showed that, in a precise sense, *most* continuous functions are nowhere differentiable. The smooth functions of the textbooks are the rare exceptions.

## Two more monsters

**Smooth but not a power series.** Cauchy himself noticed in 1823 that
$$f(x) = \begin{cases} e^{-1/x^2} & x \ne 0, \\ 0 & x = 0 \end{cases}$$
has derivatives of every order at $0$, all equal to $0$. So its Taylor series at $0$ is identically zero — and converges, but not to $f$. A function can be infinitely smooth without being determined by its derivatives at a point. (Try differentiating a few times: each derivative is $e^{-1/x^2}$ times a polynomial in $\frac1x$, and $e^{-1/x^2}$ beats every power of $\frac1x$ as $x \to 0$.)

**A curve that fills a square.** Cantor had shown in 1877 that the unit interval and the unit square have the same cardinality (Chapter 11), but his bijection was wildly discontinuous. Surely a *continuous* curve, being one-dimensional, can't cover a two-dimensional region? In 1890 Giuseppe Peano constructed one that does, and in 1891 David Hilbert gave the version below.

::hilbert-curve

Each stage is a path through $4^n$ small squares, and each stage refines the previous one without moving any point far: consecutive stages differ by at most the diagonal of a small square. So the stages converge uniformly, and by the uniform limit theorem the limit is a continuous curve. And every point of the square is the limit of points on the stages — it lies in one of the small squares at every stage — which, with a short compactness argument (Bolzano–Weierstrass again), puts it on the limit curve. (It is not injective — some points are visited more than once — and it can't be: a continuous bijection between the interval and the square is impossible, as Eugen Netto proved in 1879.)

:::key
Every monster in this chapter refuted an intuition that had been used as if it were a theorem: that functions are formulas, that limits of continuous functions are continuous, that continuous functions have tangents, that smooth functions are power series, that curves are thin. Each refutation led to a sharper definition — function, uniform convergence, differentiability, analytic function, dimension. Counterexamples are not just destructive; they tell you what a theorem really needs.
:::

## Exercises

```prove
title: Dirichlet’s function
prompt: 'Prove from the ε–δ definition that Dirichlet''s function $D$ (1 on rationals, 0 on irrationals) is discontinuous at every real number $a$.'
hints:
  - 'Take $\varepsilon = \frac12$. What must you show about every $\delta > 0$?'
  - Every interval contains both a rational and an irrational (Chapter 2).
rubric:
  - 'You negated the definition: there is an $\varepsilon$ such that for every $\delta$ some $x$ with $|x - a| < \delta$ has $|D(x) - D(a)| \ge \varepsilon$.'
  - 'You chose $\varepsilon = \frac12$ (or any $\varepsilon \le 1$).'
  - You used density to find, in every interval around $a$, a point of the other kind, where $D$ differs from $D(a)$ by $1$.
solution: |
  Let $a \in \mathbb R$ and take $\varepsilon = \frac12$. Let $\delta > 0$. The interval $(a - \delta, a + \delta)$ contains both rational and irrational numbers (density, Chapter 2). If $a$ is rational, pick an irrational $x$ in it; if $a$ is irrational, pick a rational $x$. Either way $|x - a| < \delta$ and $|D(x) - D(a)| = 1 \ge \varepsilon$. So no $\delta$ works, and $D$ is discontinuous at $a$.
```

```blanks
title: Popcorn values
text: |
  $T\!\left(\frac34\right) = $ [[a]], $\;T\!\left(\frac68\right) = $ [[b]] (reduce first!), $\;T(0.35) = $ [[c]], $\;T(\sqrt 2) = $ [[d]], $\;T(5) = $ [[e]].
blanks:
  a: { answer: '1/4' }
  b: { answer: '1/4' }
  c: { answer: '1/20' }
  d: { answer: '0' }
  e: { answer: '1' }
explain: '$0.35 = \frac{7}{20}$ in lowest terms, and $5 = \frac51$.'
```

```quiz
q: 'The functions $f_n(x) = x^n$ converge on $[0, 1]$. On which interval is the convergence **uniform**?'
options:
  - text: '$[0, 1]$'
    why: 'The limit jumps at $1$, and a uniform limit of continuous functions is continuous.'
  - text: '$[0, 1)$'
    why: 'Here the limit is $0$ everywhere, but $\sup_{x < 1} x^n = 1$ for every $n$ — the graph always reaches up near $x = 1$.'
  - text: '$[0, \frac{9}{10}]$'
    correct: true
    why: 'There $|x^n - 0| \le (0.9)^n \to 0$, and the bound does not depend on $x$.'
```

:::challenge
**Riemann's candidate.** Riemann is said to have suggested $\sum_{n=1}^\infty \frac{\sin(n^2 x)}{n^2}$ as a continuous nowhere-differentiable function. Show that it is continuous (M-test). In 1916 G. H. Hardy proved it is not differentiable at many points; in 1970 Joseph Gerver, then a student, showed that it *is* differentiable at $x = \pi$ (and at certain other rational multiples of $\pi$), with derivative $-\frac12$. Plot its partial sums near $x = \pi$ and see if you can spot the difference.
:::

## Further reading

- Imre Lakatos, *Proofs and Refutations* — its appendix tells the story of Cauchy's theorem and uniform convergence as a case study in how mathematics learns from counterexamples. (The main text is Chapter 21's story.):cite[lakatos]
- Bernard Gelbaum and John Olmsted, *Counterexamples in Analysis* — a whole book of monsters.:cite[gelbaum-olmsted]
