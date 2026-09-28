---
number: 15
title: The fundamental theorem of calculus
summary: Areas and slopes are inverse operations. Getting there rigorously takes a chain of theorems — extreme values, Rolle, the mean value theorem — each proved from the one before. A lesson in building a big result from small, sure steps.
duration: About 3 hours
prerequisites: [completeness]
theorems: [The extreme value theorem, Rolle’s theorem (1691), The mean value theorem, The fundamental theorem of calculus]
techniques: [chains of lemmas, auxiliary functions, ε–δ, reduction to a special case]
---

Two problems dominated seventeenth-century mathematics. The **tangent problem**: find the slope of a curve at a point. The **area problem**: find the area under a curve. They look unrelated — one is about a single point, the other about a whole region. The discovery that they are *inverse* to each other, made by Isaac Barrow and turned into a method by Newton and Leibniz, is the fundamental theorem of calculus. It turned area problems that had defeated mathematicians since Archimedes into routine exercises.

Here is the idea at a glance. Let $F(x)$ be the area under the graph of $f$ between a fixed point $a$ and a moving point $x$. Move $x$ a little to the right: the area grows by a thin strip whose height is about $f(x)$. So the *rate* at which the area grows is the height of the curve: $F' = f$.

::area-accumulator

That argument is convincing, and it is the heart of the matter. But “a thin strip whose area is about $f(x)$ times its width” hides several claims. This chapter proves the theorem properly, and the route is worth studying in its own right: it is a chain of theorems, each a short step from the previous one, where the pieces only come together at the end. That is how most substantial mathematics is built.

## Derivatives

:::definition
A function $f$ is **differentiable at $x$** if the limit
$$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$$
exists: for every $\varepsilon > 0$ there is $\delta > 0$ such that $\left|\frac{f(x+h) - f(x)}{h} - f'(x)\right| < \varepsilon$ whenever $0 < |h| < \delta$.
:::

This is Berkeley's “ghost” laid to rest: $h$ is never zero; the derivative is the number the difference quotients approach, in the sense of Chapter 13.

## Link 1: extreme values

:::theorem{name="The extreme value theorem"}
A continuous function on a closed interval $[a, b]$ is bounded and attains its maximum and minimum: there are $c, d \in [a, b]$ with $f(d) \le f(x) \le f(c)$ for all $x \in [a, b]$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Take points where $f$ gets closer and closer to its supremum. By Bolzano–Weierstrass (Chapter 14) some subsequence of them converges to a point $c$ in $[a, b]$, and continuity makes $f(c)$ equal to the supremum.
:::
:::level[Proof]
*Bounded.* If not, for each $n$ there is $x_n \in [a, b]$ with $f(x_n) > n$. By Bolzano–Weierstrass a subsequence $x_{n_k}$ converges to some $c$, and $c \in [a, b]$ since $a \le x_{n_k} \le b$. By continuity $f(x_{n_k}) \to f(c)$, but $f(x_{n_k}) > n_k \to \infty$ — a contradiction.

*Attained.* Let $M = \sup\{f(x) : x \in [a, b]\}$, which exists by completeness. For each $n$ choose $x_n$ with $f(x_n) > M - \frac1n$. A subsequence converges to some $c \in [a, b]$, and then $f(c) = \lim f(x_{n_k}) \ge M$. Since also $f(c) \le M$, $f(c) = M$. The minimum is the maximum of $-f$.
:::
::::

Both hypotheses matter. On the open interval $(0, 1)$, $f(x) = x$ has no maximum; on $[0, 1]$, the discontinuous function that is $x$ for $x < 1$ and $0$ at $1$ has none either.

## Link 2: Fermat and Rolle

:::lemma{name="Fermat’s interior extremum theorem"}
If $f$ has a maximum or minimum at an interior point $c$ of an interval, and $f$ is differentiable at $c$, then $f'(c) = 0$.
:::

:::proof
Say $c$ is a maximum. For small $h > 0$, $f(c + h) - f(c) \le 0$, so the quotient $\frac{f(c+h) - f(c)}{h} \le 0$, and its limit $f'(c) \le 0$. For small $h < 0$ the quotient is $\ge 0$, so $f'(c) \ge 0$. Hence $f'(c) = 0$.
:::

:::theorem{name="Rolle’s theorem" who="Michel Rolle" year=1691}
If $f$ is continuous on $[a, b]$, differentiable on $(a, b)$, and $f(a) = f(b)$, then $f'(c) = 0$ for some $c \in (a, b)$.
:::

:::proof
By the extreme value theorem $f$ has a maximum and a minimum on $[a, b]$. If both occur at the endpoints, then (as $f(a) = f(b)$) $f$ is constant and $f' = 0$ everywhere. Otherwise one of them occurs at an interior point $c$, and Fermat's lemma gives $f'(c) = 0$.
:::

## Link 3: the mean value theorem

Tilt Rolle's picture and you get the most useful theorem in elementary analysis.

:::theorem{name="The mean value theorem" who="Joseph-Louis Lagrange" year=1797}
If $f$ is continuous on $[a, b]$ and differentiable on $(a, b)$, there is $c \in (a, b)$ with
$$f'(c) = \frac{f(b) - f(a)}{b - a}.$$
:::

::mean-value

The proof reduces the theorem to Rolle's by subtracting the chord — a typical use of an **auxiliary function**, designed so that the special case applies.

:::proof
Let $g(x) = f(x) - f(a) - \dfrac{f(b) - f(a)}{b - a}\,(x - a)$, the vertical distance between the graph and the chord. Then $g$ is continuous on $[a, b]$ and differentiable on $(a, b)$, with $g(a) = 0 = g(b)$. By Rolle, $g'(c) = 0$ for some $c \in (a, b)$, that is, $f'(c) - \frac{f(b) - f(a)}{b - a} = 0$.
:::

```step
title: The auxiliary function vanishes at b
prompt: 'Check that $g(b) = 0$: show $f(b) - f(a) - \frac{f(b) - f(a)}{b - a}(b - a) = 0$. (The checker treats $f(a)$ and $f(b)$ as unknown numbers.)'
functions: [f]
start: f(b) - f(a) - ((f(b) - f(a))/(b - a))(b - a)
target: '0'
relation: '='
initial: f(b) - f(a) - ((f(b) - f(a))/(b - a))(b - a)
solution: 'The factor $b - a$ cancels, leaving $f(b) - f(a) - (f(b) - f(a)) = 0$.'
```

The mean value theorem turns information about derivatives into information about values. Two consequences we need:

:::corollary
If $f' = 0$ on an interval, then $f$ is constant there. If $f' = g'$ on an interval, then $f - g$ is constant there.
:::

:::proof
For any $x < y$ in the interval, the mean value theorem gives $c$ between them with $f(y) - f(x) = f'(c)(y - x) = 0$. Apply this to $f - g$ for the second statement.
:::

This is exactly the fact behind “$+ C$” in every antiderivative — and it genuinely needs the mean value theorem, hence completeness. Over the rationals it fails: the function that is $0$ for rational $x < \sqrt2$ and $1$ for rational $x > \sqrt 2$ has derivative $0$ everywhere on $\mathbb{Q}$ but is not constant.

```bug
title: Rolle without the hypotheses
prompt: 'A student applies Rolle''s theorem to $f(x) = |x|$ on $[-1, 1]$. Which step fails?'
lines:
  - '$f$ is continuous on $[-1, 1]$.'
  - '$f(-1) = f(1) = 1$.'
  - '$f$ is differentiable on $(-1, 1)$.'
  - 'So by Rolle''s theorem, $f''(c) = 0$ for some $c \in (-1, 1)$.'
wrong: 2
why: '$|x|$ is not differentiable at $0$: the difference quotient $\frac{|h|}{h}$ is $+1$ for $h > 0$ and $-1$ for $h < 0$, so it has no limit. And indeed the conclusion is false: $f''(x) = \pm 1$ wherever it exists. Every hypothesis of a theorem is there for a reason; the mean value widget above has this example.'
```

## Link 4: integrals

To prove the fundamental theorem we need a definition of area. Divide $[a, b]$ into $n$ pieces. On each piece, a rectangle as high as the *lowest* point of the graph fits under it, and one as high as the *highest* point covers it. The total areas are the **lower** and **upper sums**.

::riemann-sums

For a continuous function, the gap between upper and lower sums shrinks to $0$ as the pieces get narrower, and both sums approach a single number: the **integral** $\int_a^b f(x)\,dx$. Proving that the gap shrinks needs one more ingredient — a continuous function on $[a, b]$ is *uniformly* continuous, with one $\delta$ serving every point at once — which follows from Bolzano–Weierstrass much as the extreme value theorem did.:cite[abbott] We will take this, and two properties that follow directly from the definition, as known:

- **additivity:** $\int_a^b f + \int_b^c f = \int_a^c f$;
- **bounds:** if $m \le f(x) \le M$ on $[a, b]$, then $m(b - a) \le \int_a^b f \le M(b - a)$.

:::history{year=-250 title="Exhausting the area" people="Archimedes"}
Archimedes found areas and volumes of curved figures around 250 BC. For the area swept out by a spiral, and for the volume of a paraboloid, he needed the sum of squares $1^2 + 2^2 + \cdots + n^2 = \frac{n(n+1)(2n+1)}{6}$, and he trapped the unknown quantity between upper and lower approximations with the “method of exhaustion” of Eudoxus (Chapter 3) — the same squeeze as in the widget above, two thousand years early. (For the area under a parabola he used a different trick, filling it with triangles whose areas form a geometric series.) With the fundamental theorem these results become one-line calculations: $\int_0^1 x^2\,dx = \frac13$.
:::

```step
title: Archimedes’ sum, by induction
prompt: 'The inductive step of $\sum_{k=1}^n k^2 = \frac{n(n+1)(2n+1)}{6}$: show that $\frac{n(n+1)(2n+1)}{6} + (n+1)^2 = \frac{(n+1)(n+2)(2n+3)}{6}$.'
start: n(n+1)(2n+1)/6 + (n+1)^2
target: (n+1)(n+2)(2n+3)/6
relation: '='
initial: n(n+1)(2n+1)/6 + (n+1)^2
domains: { n: nat }
hints:
  - 'Factor out $\frac{n+1}{6}$: what remains is $n(2n+1) + 6(n+1) = 2n^2 + 7n + 6$.'
solution: '$\frac{n+1}{6}\left(2n^2 + 7n + 6\right) = \frac{(n+1)(n+2)(2n+3)}{6}$.'
```

## The fundamental theorem

:::theorem{name="The fundamental theorem of calculus" who="Barrow, Newton, Leibniz; Cauchy (rigorous proof)" year="1670s; 1823"}
Let $f$ be continuous on $[a, b]$.
1. The function $F(x) = \int_a^x f(t)\,dt$ is differentiable on $(a, b)$, with $F'(x) = f(x)$.
2. If $G$ is any function with $G' = f$ on $(a, b)$, continuous on $[a, b]$, then $\displaystyle \int_a^b f(x)\,dx = G(b) - G(a)$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Part 1: $F(x + h) - F(x)$ is the area of a thin strip, which lies between (width) × (least height) and (width) × (greatest height). Divide by the width; continuity squeezes both heights to $f(x)$. Part 2: $F$ and $G$ have the same derivative, so they differ by a constant.
:::
:::level[Proof]
*Part 1.* Fix $x \in (a, b)$ and let $\varepsilon > 0$. By continuity there is $\delta > 0$ with $|f(t) - f(x)| < \varepsilon$ whenever $|t - x| < \delta$. Let $0 < h < \delta$ (with $x + h \le b$). By additivity, $F(x + h) - F(x) = \int_x^{x+h} f(t)\,dt$, and on $[x, x+h]$ we have $f(x) - \varepsilon < f(t) < f(x) + \varepsilon$. By the bounds property,
$$(f(x) - \varepsilon)\,h \le F(x + h) - F(x) \le (f(x) + \varepsilon)\,h, \quad\text{so}\quad \left|\frac{F(x+h) - F(x)}{h} - f(x)\right| \le \varepsilon .$$
The case $-\delta < h < 0$ is the same with $\int_{x+h}^x$. So the difference quotients tend to $f(x)$: $F'(x) = f(x)$. (Strictly, we showed “$\le \varepsilon$” rather than “$< \varepsilon$”; running the argument with $\varepsilon/2$ fixes that.)

*Part 2.* By part 1, $F' = f = G'$ on $(a, b)$, so by the corollary to the mean value theorem $G - F$ is constant on $(a, b)$ — and, both being continuous, on $[a, b]$. So $G(b) - G(a) = F(b) - F(a) = \int_a^b f - 0$.
:::
::::

Look back at the chain: completeness (Chapter 14) gave Bolzano–Weierstrass, which gave the extreme value theorem, which with Fermat's lemma gave Rolle, which gave the mean value theorem, which gave the uniqueness of antiderivatives, which with the ε–δ estimate for part 1 gave the fundamental theorem. Six links, none very long. When a big theorem looks hard, ask what chain of smaller ones could lead to it.

:::history{year=1823 title="Who proved it?" people="Isaac Barrow, Isaac Newton, Gottfried Wilhelm Leibniz, Augustin-Louis Cauchy, Bernhard Riemann"}
Isaac Barrow, Newton's teacher at Cambridge, proved a geometric version of the theorem in his *Geometrical Lectures* of 1670. Newton (in unpublished manuscripts from 1666) and Leibniz (in papers from 1684) made it the engine of a calculus, and then quarrelled for the rest of their lives about who had been first; a Royal Society report of 1712 condemning Leibniz was secretly written by Newton himself, its president. Neither had a definition of the integral that could support a proof. Cauchy gave the first rigorous proof, for continuous functions, in his *Résumé des leçons* of 1823. Bernhard Riemann's definition of 1854, with upper and lower sums much as above, is the one still taught today.:cite[grabiner]
:::

:::bio{name="Michel Rolle" born=1652 died=1719 place="Ambert and Paris"}
Rolle had little formal education and worked as a scribe before teaching himself algebra and becoming a member of the Paris Academy of Sciences. He was, remarkably, one of the most vocal *critics* of the new calculus, calling it a collection of ingenious fallacies and debating it fiercely with its supporters in the Academy. His theorem of 1691 was stated only for polynomials, and proved by algebraic methods. The name “Rolle's theorem” was attached, in its calculus form, only in the nineteenth century — a small irony for a sceptic of the subject.
:::

## Exercises

```prove
title: Increasing functions
prompt: 'Prove that if $f''(x) > 0$ for every $x$ in an interval $I$, then $f$ is strictly increasing on $I$: $x < y$ implies $f(x) < f(y)$.'
hints:
  - Take $x < y$ in $I$ and apply the mean value theorem on $[x, y]$.
rubric:
  - 'You took arbitrary $x < y$ in $I$ and checked the hypotheses of the mean value theorem on $[x, y]$.'
  - 'You obtained $f(y) - f(x) = f''(c)(y - x)$ with $c \in (x, y)$.'
  - You concluded from the signs of both factors.
solution: |
  Let $x < y$ in $I$. $f$ is differentiable on $I$, hence continuous on $[x, y]$ and differentiable on $(x, y)$. By the mean value theorem there is $c \in (x, y)$ with $f(y) - f(x) = f'(c)(y - x)$. Both factors are positive, so $f(y) > f(x)$.
```

```quiz
q: 'Let $F(x) = \int_0^x \sin(t^2)\,dt$. What is $F''(x)$?'
options:
  - text: '$\sin(x^2)$'
    correct: true
    why: Part 1 of the fundamental theorem, with $f(t) = \sin(t^2)$. No antiderivative in elementary terms is needed — or exists.
  - text: '$2x\cos(x^2)$'
    why: That is the derivative of $\sin(x^2)$, not of its integral.
  - text: '$-\cos(x^2)$'
    why: '$-\cos$ is an antiderivative of $\sin$, but here the variable inside is $t^2$.'
```

:::challenge
**Inequalities from the mean value theorem.** Prove that $|\sin a - \sin b| \le |a - b|$ for all real $a, b$, and that $e^x \ge 1 + x$ for all real $x$ (compare with Bernoulli's inequality in Chapter 5). Then prove Cauchy's generalisation: if $f, g$ are continuous on $[a, b]$ and differentiable on $(a, b)$, there is $c$ with $(f(b) - f(a))\,g'(c) = (g(b) - g(a))\,f'(c)$. (Hint: an auxiliary function again.)
:::

## Further reading

- Stephen Abbott, *Understanding Analysis*, Chapters 5 and 7 — derivatives, integrals and the fundamental theorem, with uniform continuity done properly.:cite[abbott]
- Judith Grabiner, *The Origins of Cauchy's Rigorous Calculus* — how the 1823 proof came about.:cite[grabiner]
