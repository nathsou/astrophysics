---
number: 14
title: Completeness
summary: What do the real numbers have that the rationals lack? No gaps. The least-upper-bound property, the existence of √2, and Bolzano’s 1817 proof of the intermediate value theorem — plus some surprising consequences for mountains and the weather.
duration: About 2½ hours
prerequisites: [epsilon-delta, root-two]
theorems: [The Archimedean property, √2 exists in ℝ, The monotone convergence theorem, The intermediate value theorem (Bolzano, 1817), The Bolzano–Weierstrass theorem]
techniques: [suprema, bisection, nested intervals, proof by contradiction]
---

Draw a continuous curve from below the $x$-axis to above it, without lifting your pen. It must cross the axis. That seems too obvious to prove, and for 150 years nobody did. But look at the same statement in the rational numbers. The function $f(x) = x^2 - 2$ is negative at $x = 1$ and positive at $x = 2$, it is continuous — and on the rational line it never crosses zero, because $\sqrt 2$ is not rational (Chapter 3). The curve passes through a *gap*.

So the “obvious” theorem depends on a property of the real numbers that the rationals do not have. In 1817 Bernard Bolzano realised this, isolated the property, and proved the theorem from it. This chapter is about that property — **completeness** — and the theorems it makes possible.

## Upper bounds and suprema

Let $A$ be a set of real numbers. A number $u$ is an **upper bound** for $A$ if $a \le u$ for every $a \in A$. The **least upper bound**, or **supremum**, $\sup A$, is an upper bound that is less than or equal to every other upper bound.

- $A = [0, 1]$: the upper bounds are the numbers $\ge 1$, and $\sup A = 1$, which is in $A$.
- $A = \{1 - \frac1n : n \ge 1\} = \{0, \frac12, \frac23, \frac34, \ldots\}$: $\sup A = 1$, which is *not* in $A$. Every number less than $1$ is exceeded by some $1 - \frac1n$.
- $A = \{x \in \mathbb{Q} : x^2 < 2\}$, viewed inside the rationals: every rational $u$ with $u^2 > 2$ is an upper bound, but there is no *least* one, because $\sqrt 2$ is missing.

The last example is the gap, described without mentioning $\sqrt2$. The real numbers are, by definition, the number system in which no such gap exists.

:::definition
**The completeness axiom** (least-upper-bound property). Every non-empty set of real numbers that is bounded above has a least upper bound in $\mathbb{R}$.
:::

There is a useful way to *use* a supremum, which turns up in almost every proof below.

:::lemma
If $s = \sup A$, then for every $\varepsilon > 0$ there is an element $a \in A$ with $a > s - \varepsilon$.
:::

:::proof
Otherwise $s - \varepsilon$ would be an upper bound for $A$ smaller than $s$.
:::

## Three first consequences

In Chapter 2 we assumed the Archimedean property. Now we can prove it.

:::theorem{name="The Archimedean property"}
The natural numbers are not bounded above in $\mathbb{R}$: for every real $x$ there is a natural number $n > x$.
:::

:::proof
Suppose $\mathbb{N}$ were bounded above. By completeness it has a supremum $s$. By the lemma (with $\varepsilon = 1$) there is $n \in \mathbb{N}$ with $n > s - 1$. Then $n + 1 > s$, and $n + 1 \in \mathbb{N}$, contradicting that $s$ is an upper bound.
:::

Next, the gap in the rationals is filled.

:::theorem
There is a real number $s > 0$ with $s^2 = 2$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Let $s$ be the supremum of $\{x > 0 : x^2 < 2\}$. If $s^2 < 2$, a slightly bigger number still has square less than $2$, so $s$ is not an upper bound. If $s^2 > 2$, a slightly smaller number is still an upper bound, so $s$ is not the least. So $s^2 = 2$.
:::
:::level[Proof]
Let $A = \{x > 0 : x^2 < 2\}$. $A$ contains $1$ and is bounded above by $2$ (if $x > 2$ then $x^2 > 4$). Let $s = \sup A$; then $1 \le s \le 2$.

*Suppose $s^2 < 2$.* Let $h = \min\left(\frac12, \frac{2 - s^2}{2(2s + 1)}\right) > 0$. Since $h \le 1$ we have $h^2 \le h$, so
$$(s + h)^2 = s^2 + 2sh + h^2 \le s^2 + h(2s + 1) \le s^2 + \frac{2 - s^2}{2} < 2 .$$
So $s + h \in A$, contradicting that $s$ is an upper bound.

*Suppose $s^2 > 2$.* Let $h = \frac{s^2 - 2}{2s} > 0$. Then $(s - h)^2 = s^2 - 2sh + h^2 > s^2 - 2sh = 2$, and $s - h > 0$. So every $x > s - h$ has $x^2 > (s - h)^2 > 2$, i.e. $x \notin A$: $s - h$ is an upper bound for $A$, smaller than $s$ — contradiction.

So $s^2 = 2$.
:::
::::

```step
title: The upper half of the argument
prompt: 'With $h = \frac{s^2 - 2}{2s}$, check that $s^2 - 2sh = 2$. Since $(s - h)^2 = s^2 - 2sh + h^2 > s^2 - 2sh$, this shows $(s-h)^2 > 2$.'
start: s^2 - 2 s ((s^2 - 2)/(2 s))
target: '2'
relation: '='
initial: s^2 - 2 s ((s^2 - 2)/(2 s))
domains: { s: pos }
solution: '$s^2 - 2s \cdot \frac{s^2 - 2}{2s} = s^2 - (s^2 - 2) = 2$.'
```

The same argument, with $n$th powers, shows that every positive real has an $n$th root. And a third consequence tells us when sequences converge without our having to know the limit in advance.

:::theorem{name="The monotone convergence theorem"}
Every increasing sequence of real numbers that is bounded above converges — to the supremum of its terms.
:::

:::proof
Let $(a_n)$ be increasing and bounded above, and let $s = \sup\{a_n\}$. Given $\varepsilon > 0$, the lemma gives $N$ with $a_N > s - \varepsilon$. For $n \ge N$, $s - \varepsilon < a_N \le a_n \le s$, so $|a_n - s| < \varepsilon$.
:::

This is the theorem that makes $e = \lim (1 + \frac1n)^n$ a *number* (Chapter 17): the sequence is increasing and bounded, so it converges — to something we then call $e$.

## The intermediate value theorem

:::theorem{name="The intermediate value theorem" who="Bernard Bolzano" year=1817}
Let $f$ be continuous on $[a, b]$ with $f(a) < 0 < f(b)$. Then there is $c \in (a, b)$ with $f(c) = 0$.
:::

Before the proof, see how you would *find* the zero: the method of bisection, which is also a proof in disguise.

::bisection

The nested intervals shrink onto a single point. In $\mathbb{R}$, that point exists; in $\mathbb{Q}$ (for $x^2 - 2$) it would not. The proof below uses the supremum directly.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Let $c$ be the last point where the function is still negative — precisely, the supremum of the points where $f < 0$. If $f(c) < 0$, continuity keeps $f$ negative a little to the right of $c$, so $c$ was not the supremum. If $f(c) > 0$, continuity keeps $f$ positive a little to the left, so a smaller number would do. So $f(c) = 0$.
:::
:::level[Proof]
Let $A = \{x \in [a, b] : f(x) < 0\}$. It contains $a$ and is bounded above by $b$, so it has a supremum $c \in [a, b]$.

*$f(c) < 0$ is impossible.* Then $c < b$ (as $f(b) > 0$). By continuity with $\varepsilon = -f(c) > 0$, there is $\delta > 0$ such that $f(x) < f(c) + \varepsilon = 0$ whenever $|x - c| < \delta$. Then any $x \in (c, c + \delta) \cap [a, b]$ is in $A$ and exceeds $c$ — contradicting that $c$ is an upper bound.

*$f(c) > 0$ is impossible.* Then $c > a$. By continuity with $\varepsilon = f(c)$, there is $\delta > 0$ with $f(x) > 0$ whenever $|x - c| < \delta$. So no point of $(c - \delta, c]$ is in $A$, and $c - \delta$ is an upper bound for $A$ smaller than $c$ — contradiction.

Hence $f(c) = 0$; and $c \ne a, b$ since $f(a), f(b) \ne 0$.
:::
::::

Notice how continuity is *used*: we pick a specific $\varepsilon$ that suits us (here, $|f(c)|$), and receive a $\delta$. The hypothesis is a strategy for the Prover of Chapter 13, and in a proof that *uses* it we get to play the Sceptic.

```bug
title: The same proof in the rationals
prompt: 'Run the proof above for $f(x) = x^2 - 2$ on $[1, 2]$, but using **only rational numbers** throughout. It must fail somewhere, since there is no rational zero. Where?'
lines:
  - $f$ is continuous on the rational interval $[1, 2]$, with $f(1) < 0 < f(2)$.
  - Let $A = \{x \in \mathbb{Q} \cap [1, 2] : x^2 - 2 < 0\}$; it contains $1$ and is bounded above by $2$.
  - Let $c$ be the least upper bound of $A$ in $\mathbb{Q}$.
  - By the two continuity arguments, $f(c) = 0$.
wrong: 2
why: |
  In the rationals, $A$ has upper bounds but **no least one** — its least upper bound would be $\sqrt2$. This is exactly the completeness axiom, and it is the only place the proof uses anything special about $\mathbb{R}$.
```

## Mountains, pancakes and the weather

The intermediate value theorem has consequences that sound like magic.

**Fixed points.** Every continuous function $f: [0, 1] \to [0, 1]$ has a **fixed point**, a $c$ with $f(c) = c$. (Apply the theorem to $g(x) = f(x) - x$, which is $\ge 0$ at $0$ and $\le 0$ at $1$.) This is the one-dimensional case of Brouwer's fixed-point theorem.

**The monk.** A monk climbs a mountain path starting at sunrise and reaches the summit at sunset. The next day he walks down the same path, again from sunrise to sunset, at whatever speeds he likes. Is there a place on the path that he passes at exactly the same time of day on both days? Yes — imagine both walks happening on the same day: the climber and the descender must meet. (The intermediate value theorem, applied to the difference of their heights.)

**Antipodes.** At this moment there are two diametrically opposite points on the equator with exactly the same temperature.

::antipodes

:::proof[Proof of the antipodal claim]
Let $T(\theta)$ be the temperature at longitude $\theta$, a continuous function with $T(\theta + 360°) = T(\theta)$. Let $g(\theta) = T(\theta) - T(\theta + 180°)$. Then $g(\theta + 180°) = T(\theta + 180°) - T(\theta) = -g(\theta)$. If $g(0) = 0$, we are done. Otherwise $g(0)$ and $g(180°)$ have opposite signs, and the intermediate value theorem gives $\theta \in (0, 180°)$ with $g(\theta) = 0$.
:::

## Bolzano–Weierstrass

One more consequence of completeness will be the key to Chapter 15.

:::theorem{name="The Bolzano–Weierstrass theorem"}
Every bounded sequence of real numbers has a convergent subsequence.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Bisect: one of the two halves of the interval contains infinitely many terms. Keep that half and bisect again. The nested intervals shrink to a point, and picking one term from each interval gives a subsequence converging to it.
:::
:::level[Proof]
Let every term lie in $[a_0, b_0]$. Of the two halves $[a_0, m]$ and $[m, b_0]$, at least one contains $x_n$ for infinitely many indices $n$; call it $[a_1, b_1]$. Repeating gives nested intervals $[a_k, b_k]$ of length $(b_0 - a_0)/2^k$, each containing infinitely many terms. Choose $n_1 < n_2 < \cdots$ with $x_{n_k} \in [a_k, b_k]$ (possible since infinitely many indices are available each time). The sequence $(a_k)$ is increasing and bounded, so by monotone convergence it tends to some $c$; since $b_k - a_k \to 0$, also $b_k \to c$. As $a_k \le x_{n_k} \le b_k$, the squeeze theorem gives $x_{n_k} \to c$.
:::
::::

:::history{year=1872 title="Constructing the continuum" people="Bernard Bolzano, Richard Dedekind, Georg Cantor"}
Bolzano's 1817 paper, whose title announced “a purely analytic proof” of the intermediate value theorem, was the first to insist that geometric intuition was not a proof. But he had no construction of the real numbers themselves, and nobody did for half a century. On 24 November 1858, preparing a calculus lecture in Zürich, Richard Dedekind decided that he could no longer appeal to geometry to justify the theorems he was teaching. His solution, published in 1872 as *Continuity and Irrational Numbers*, defined a real number as a **cut**: a way of splitting the rationals into a lower and an upper part. $\sqrt 2$ *is* the cut $\{x : x < 0 \text{ or } x^2 < 2\}$ versus the rest. The same year Cantor gave an alternative construction using sequences. Either way, the completeness axiom becomes a theorem, and the real numbers are built from the rationals — which are built from the integers, which Kronecker said God made.:cite[dedekind1872]
:::

:::bio{name="Bernard Bolzano" born=1781 died=1848 place="Prague"}
A Catholic priest, philosopher and mathematician, Bolzano held the chair of philosophy of religion in Prague until 1819, when the Austrian authorities dismissed him for sermons judged too liberal — he preached pacifism and social reform. Barred from teaching and publishing, he lived much of the rest of his life at a friend's country estate, writing. His mathematical work anticipated Cauchy's rigour, Weierstrass's continuous nowhere-differentiable function (Chapter 18) and Cantor's infinite sets (his *Paradoxes of the Infinite* was published posthumously in 1851), but much of it lay unread for decades.
:::

## Exercises

```prove
title: A fixed point
prompt: 'Prove that every continuous function $f: [0, 1] \to [0, 1]$ has a fixed point: a $c \in [0, 1]$ with $f(c) = c$.'
hints:
  - 'Look at $g(x) = f(x) - x$. What are the signs of $g(0)$ and $g(1)$?'
  - The intermediate value theorem needs strict signs. Deal with the cases $g(0) = 0$ or $g(1) = 0$ separately.
rubric:
  - 'You defined $g(x) = f(x) - x$ and noted it is continuous.'
  - 'You showed $g(0) \ge 0$ and $g(1) \le 0$ using $0 \le f(x) \le 1$.'
  - You handled the equality cases, and applied the intermediate value theorem otherwise.
solution: |
  Let $g(x) = f(x) - x$, continuous on $[0, 1]$ as a difference of continuous functions. Since $f(0) \ge 0$, $g(0) \ge 0$; since $f(1) \le 1$, $g(1) \le 0$. If $g(0) = 0$ then $c = 0$ works; if $g(1) = 0$ then $c = 1$. Otherwise $g(0) > 0 > g(1)$, and the intermediate value theorem (applied to $-g$) gives $c \in (0, 1)$ with $g(c) = 0$, i.e. $f(c) = c$.
```

```quiz
q: 'Let $A = \{\, (-1)^n (1 - \tfrac1n) : n \ge 1 \,\}$. What are $\sup A$ and $\inf A$ (the greatest lower bound)?'
options:
  - text: '$\sup A = 1$, $\inf A = -1$, and neither is in $A$.'
    correct: true
    why: 'Even $n$ give $1 - \frac1n$, which approaches $1$ from below; odd $n$ give $-(1 - \frac1n)$, approaching $-1$ from above.'
  - text: '$\sup A = 1$, $\inf A = 0$.'
    why: 'The odd terms are negative: $n = 3$ gives $-\frac23$.'
  - text: '$A$ has no supremum because it has no largest element.'
    why: A supremum need not belong to the set — that is the whole point of the definition.
```

:::challenge
**Odd-degree polynomials.** Prove that every polynomial of odd degree with real coefficients has a real root. (Show that $p(x)/x^n \to a_n$ as $x \to \pm\infty$, so $p$ takes both signs, then apply the intermediate value theorem.) Why does the argument fail for $x^2 + 1$?
:::

## Further reading

- Richard Dedekind, *Continuity and Irrational Numbers* — short, clear, and still worth reading.:cite[dedekind1872]
- Stephen Abbott, *Understanding Analysis*, Chapter 1 — the axiom of completeness and its equivalents.:cite[abbott]
