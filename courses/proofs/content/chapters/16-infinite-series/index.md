---
number: 16
title: Infinite series
summary: Adding infinitely many numbers. Zeno’s paradox, Oresme’s medieval proof that 1 + ½ + ⅓ + ⋯ is infinite, Euler’s audacious solution of the Basel problem, a proof that holds up — and a series whose sum depends on the order of its terms.
duration: About 3 hours
prerequisites: [epsilon-delta, induction]
theorems: [The harmonic series diverges (Oresme, c. 1350), 1 + 1/4 + 1/9 + ⋯ = π²/6 (Euler, 1734), Riemann’s rearrangement theorem]
techniques: [partial sums, comparison, grouping, telescoping, squeezing]
---

Zeno of Elea, around 450 BC, argued that you can never cross a room: first you must cover half the distance, then half of what remains, then half of that, and so on — infinitely many tasks, which can never be completed. The paradox rests on the assumption that infinitely many positive quantities must add up to something infinite. They need not:
$$\frac12 + \frac14 + \frac18 + \frac1{16} + \cdots = 1 .$$
But what does the left-hand side *mean*? With the limits of Chapter 13 the question has a precise answer, and a precise answer is exactly what this chapter needs, because infinite sums can behave very strangely.

## What an infinite sum is

:::definition
The **series** $\sum_{n=1}^\infty a_n$ **converges** to $S$ if its **partial sums** $s_N = a_1 + \cdots + a_N$ converge to $S$. Otherwise it **diverges**.
:::

For Zeno's series, $s_N = 1 - 2^{-N}$ (check it by induction), which tends to $1$. More generally the **geometric series** $\sum_{n=0}^\infty r^n$ has $s_N = \frac{1 - r^{N+1}}{1 - r}$, and converges to $\frac1{1-r}$ exactly when $|r| < 1$.

One condition is obviously necessary: if $\sum a_n$ converges, then $a_n = s_n - s_{n-1} \to S - S = 0$. The terms must shrink to zero. Is that enough?

## The harmonic series

$$1 + \frac12 + \frac13 + \frac14 + \frac15 + \cdots$$

The terms shrink to zero, and the partial sums grow very slowly: after a thousand terms the sum is about $7.5$; after a million, about $14.4$. It looks as if it might settle down. Around 1350 the French scholar Nicole Oresme proved that it does not.

::oresme

:::theorem{name="The harmonic series diverges" who="Nicole Oresme" year="c. 1350"}
$\displaystyle \sum_{n=1}^\infty \frac1n = \infty$: the partial sums grow without bound.
:::

:::proof
Group the terms: $1$, then $\frac12$, then $\frac13 + \frac14$, then $\frac15 + \cdots + \frac18$, and in general the $2^{g-1}$ terms from $\frac{1}{2^{g-1} + 1}$ to $\frac{1}{2^g}$. Each term of the $g$th group is at least $\frac1{2^g}$, the smallest, so the group adds up to at least $2^{g-1} \cdot \frac1{2^g} = \frac12$. So the partial sum up to $2^g$ is at least $1 + \frac g2$, which exceeds any bound for large $g$.
:::

This is a *comparison* argument: we replaced each term by a smaller one whose sum we can compute. The divergence is extraordinarily slow. The partial sums grow like $\ln N$, and to exceed $100$ you would need about $10^{43}$ terms.

## Comparison and telescoping

The comparison idea works in both directions:

:::theorem{name="Comparison test"}
Suppose $0 \le a_n \le b_n$ for all $n$. If $\sum b_n$ converges, so does $\sum a_n$. If $\sum a_n$ diverges, so does $\sum b_n$.
:::

:::proof
The partial sums of $\sum a_n$ are increasing (the terms are non-negative) and bounded above by $\sum b_n$. By the monotone convergence theorem (Chapter 14) they converge. The second statement is the contrapositive of the first.
:::

Now compare $\sum \frac1{n^2}$ with a series that **telescopes** — whose partial sums collapse because each term cancels part of the next. For $n \ge 2$, $\frac1{n^2} < \frac1{n(n-1)} = \frac1{n-1} - \frac1n$, and
$$\sum_{n=2}^N \left(\frac1{n-1} - \frac1n\right) = 1 - \frac1N < 1 .$$
So $\sum \frac1{n^2}$ converges, to something less than $2$ — as we proved by strengthened induction in Chapter 5. But *what* does it converge to?

```step
title: The telescoping identity
prompt: 'Check that $\frac1{n-1} - \frac1n = \frac{1}{n(n-1)}$, and that $\frac1{n^2} < \frac1{n(n-1)}$ for $n \ge 2$.'
domains: { n: { min: 2, max: 60, int: true } }
start: 1/n^2
target: 1/(n - 1) - 1/n
relation: '<'
initial: 1/n^2
hints:
  - 'Write the chain $\frac1{n^2} < \frac1{n(n-1)} = \frac1{n-1} - \frac1n$.'
solution: '$\frac1{n^2} < \frac1{n(n-1)} = \frac{n - (n-1)}{n(n-1)} = \frac1{n-1} - \frac1n$.'
```

## The Basel problem

In 1650 the Italian mathematician Pietro Mengoli asked for the exact value of
$$1 + \frac14 + \frac19 + \frac1{16} + \cdots$$
Jacob Bernoulli of Basel publicised the problem in 1689, admitting defeat: “If anyone finds and communicates to us that which has thus far eluded our efforts, great will be our gratitude.” The value is about $1.6449$, and for forty years the best mathematicians in Europe could not identify it. In 1734 the 28-year-old Leonhard Euler, a former student of Jacob's brother Johann, did.

:::theorem{name="The Basel problem" who="Leonhard Euler" year=1734}
$$\sum_{n=1}^\infty \frac1{n^2} = \frac{\pi^2}{6} .$$
:::

### Euler's audacious argument

A polynomial with roots $r_1, \ldots, r_k$ and value $1$ at $0$ factors as $(1 - \frac x{r_1})(1 - \frac x{r_2}) \cdots (1 - \frac x{r_k})$. Euler boldly applied this to the function $\frac{\sin x}{x}$, which equals $1$ at $0$ and has roots $\pm\pi, \pm2\pi, \pm3\pi, \ldots$ — as if it were a polynomial of infinite degree. Pairing the roots $\pm k\pi$:
$$\frac{\sin x}{x} = \left(1 - \frac{x^2}{\pi^2}\right)\left(1 - \frac{x^2}{4\pi^2}\right)\left(1 - \frac{x^2}{9\pi^2}\right)\cdots$$

::euler-product

Now compare the coefficients of $x^2$ on both sides. On the left, the Taylor series $\frac{\sin x}{x} = 1 - \frac{x^2}{6} + \frac{x^4}{120} - \cdots$ gives $-\frac16$. On the right, multiplying out, the $x^2$ terms come from choosing one $-\frac{x^2}{k^2\pi^2}$ and $1$ from every other factor: $-\frac1{\pi^2}\left(1 + \frac14 + \frac19 + \cdots\right)$. So
$$\frac1{\pi^2} \sum \frac1{k^2} = \frac16 .$$

It is a breathtaking argument — and not a proof. Why should an infinite product behave like a finite one? The function $e^x \frac{\sin x}{x}$ has exactly the same roots and also equals $1$ at $0$, yet it is *not* equal to the product. Euler knew his argument needed support; he checked the answer numerically to many decimal places, derived other known results the same way, and in later years found more careful proofs. The product formula was finally justified by Weierstrass's factorisation theorem of 1876.

:::key
A heuristic argument can tell you *what* is true long before anyone can prove it. Euler's product is one of the great examples: the answer came first, and the rigour a century and a half later.
:::

### A proof that holds up

Here is an elementary proof, going back to Cauchy's *Cours d'analyse* of 1821.:cite[aigner-ziegler] It squeezes the sum between two expressions that both tend to $\frac{\pi^2}6$.

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
For $0 < x < \frac\pi2$, $\cot^2 x < \frac1{x^2} < 1 + \cot^2 x$. Apply this at the $m$ points $x_k = \frac{k\pi}{2m+1}$, where — by an exact trigonometric identity — the values $\cot^2 x_k$ add up to $\frac{m(2m-1)}{3}$. That traps $\sum_{k \le m} \frac1{k^2}$ between two quantities that both tend to $\frac{\pi^2}{6}$.
:::
:::level[Sketch]
Let $n = 2m + 1$ and $x_k = \frac{k\pi}{n}$ for $k = 1, \ldots, m$. Expanding $\sin nx$ with de Moivre's formula shows that the numbers $t_k = \cot^2 x_k$ are the roots of $\binom n1 t^m - \binom n3 t^{m-1} + \binom n5 t^{m-2} - \cdots$, so $\sum_k \cot^2 x_k = \binom n3 / \binom n1 = \frac{m(2m-1)}{3}$. Summing $\cot^2 x_k < \frac{n^2}{\pi^2 k^2} < 1 + \cot^2 x_k$ over $k$ and multiplying by $\frac{\pi^2}{n^2}$:
$$\frac{\pi^2}{n^2}\cdot\frac{m(2m-1)}{3} < \sum_{k=1}^m \frac1{k^2} < \frac{\pi^2}{n^2}\cdot\frac{2m(m+1)}{3} .$$
Both bounds tend to $\frac{\pi^2}{6}$ as $m \to \infty$.
:::
:::level[Proof]
*The inequality.* For $0 < x < \frac\pi2$ we have $\sin x < x < \tan x$ (comparing the areas of a triangle, a sector and a larger triangle in the unit circle). Squaring and inverting, $\cot^2 x < \frac1{x^2} < \frac{1}{\sin^2 x} = 1 + \cot^2 x$.

*The identity.* Let $n = 2m + 1$. By de Moivre, $\cos nx + i\sin nx = (\cos x + i \sin x)^n$; taking imaginary parts,
$$\sin nx = \sum_{j=0}^{m} (-1)^j \binom{n}{2j+1} \cos^{n - 2j - 1} x \,\sin^{2j+1} x = \sin^n x \sum_{j=0}^m (-1)^j \binom{n}{2j+1} \cot^{2(m - j)} x .$$
At $x = x_k = \frac{k\pi}n$ ($1 \le k \le m$), $\sin nx = 0$ and $\sin x \ne 0$, so $t_k = \cot^2 x_k$ is a root of $P(t) = \sum_{j=0}^m (-1)^j \binom n{2j+1} t^{m-j}$. The $t_k$ are $m$ distinct numbers (cot² is strictly decreasing on $(0, \frac\pi2)$), so they are *all* the roots of this degree-$m$ polynomial, and their sum is minus the ratio of the second coefficient to the first: $\binom n3 / \binom n1 = \frac{m(2m-1)}{3}$.

*The squeeze.* Summing the inequality at $x = x_k$ over $k = 1, \ldots, m$,
$$\frac{m(2m-1)}{3} < \frac{n^2}{\pi^2} \sum_{k=1}^m \frac1{k^2} < m + \frac{m(2m-1)}{3} = \frac{2m(m+1)}{3} .$$
Multiply by $\frac{\pi^2}{n^2} = \frac{\pi^2}{(2m+1)^2}$. As $m \to \infty$, $\frac{m(2m-1)}{(2m+1)^2} \to \frac12$ and $\frac{2m(m+1)}{(2m+1)^2} \to \frac12$, so both bounds tend to $\frac{\pi^2}{6}$, and by the squeeze theorem so does $\sum_{k=1}^m \frac1{k^2}$.
:::
::::

```step
title: The sum of the roots
prompt: 'With $n = 2m + 1$, show that $\binom{n}{3} / \binom{n}{1} = \frac{m(2m-1)}{3}$. (Type `binom(2m+1, 3)/binom(2m+1, 1)`.)'
domains: { m: posint }
start: binom(2m+1, 3)/binom(2m+1, 1)
target: m(2m - 1)/3
relation: '='
initial: binom(2m+1, 3)/binom(2m+1, 1)
hints:
  - '$\binom n3 = \frac{n(n-1)(n-2)}{6}$ and $\binom n1 = n$.'
solution: '$\frac{(2m+1)(2m)(2m-1)/6}{2m+1} = \frac{2m(2m-1)}{6} = \frac{m(2m-1)}{3}$.'
```

Euler went on to find $\sum \frac1{n^4} = \frac{\pi^4}{90}$ and every even power: $\sum \frac1{n^{2k}}$ is a rational multiple of $\pi^{2k}$. The odd powers are a mystery to this day. Not until 1978 did Roger Apéry prove that $\sum \frac1{n^3}$ is even irrational, and nobody knows a closed form for it.

## When the order matters

For finite sums, the order of the terms makes no difference. For infinite series it can make *all* the difference. The alternating harmonic series
$$1 - \frac12 + \frac13 - \frac14 + \frac15 - \cdots$$
converges (to $\ln 2 \approx 0.693$), but only because positive and negative terms cancel: the positive terms alone, and the negative terms alone, both diverge, like the harmonic series. Such a series is called **conditionally convergent**. And conditionally convergent series can be rearranged to add up to anything.

::rearrangement

:::theorem{name="The rearrangement theorem" who="Bernhard Riemann" year=1854}
If $\sum a_n$ converges conditionally, then for every real number $S$ there is a rearrangement of its terms that converges to $S$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
The positive terms add up to infinity, and so do the negative ones, while the terms themselves shrink to zero. So: add positive terms until you pass $S$, then negative terms until you drop below it, then positive terms again. You overshoot by less and less, because the terms shrink.
:::
:::level[Proof]
Let $p_1, p_2, \ldots$ be the positive terms and $q_1, q_2, \ldots$ the negative terms, in their original order. Both $\sum p_i = \infty$ and $\sum q_i = -\infty$ (if either sum were finite, the convergence of $\sum a_n$ would force the other to be finite too, and then $\sum |a_n|$ would converge). Build the rearrangement greedily: take positive terms, in order, until the running total exceeds $S$; then negative terms until it falls below $S$; and repeat. Each phase ends, because the remaining positive (or negative) terms have infinite sum; so every term is eventually used, exactly once. After each switch, the running total differs from $S$ by at most the size of the last term used, and once the total has crossed $S$ it stays within the size of the most recent switching term. Since $a_n \to 0$, those sizes tend to $0$, so the rearranged partial sums converge to $S$.
:::
::::

The lesson is that an infinite series is not a sum in the ordinary sense; it is a limit, and limits can be fragile. Series whose absolute values converge — **absolutely convergent** ones, like $\sum \frac1{n^2}$ — can be rearranged freely. Chapter 18 has more examples of infinite processes that do not behave as finite ones do.

:::bio{name="Nicole Oresme" born="c. 1320" died=1382 place="Normandy and Paris"}
Oresme studied at the University of Paris, became tutor to the future King Charles V, and ended his life as Bishop of Lisieux. He wrote on economics (a treatise on money arguing against debasing the coinage), on cosmology (arguing that the Earth's daily rotation could not be ruled out), and translated Aristotle into French. In mathematics he drew what are essentially graphs of functions — “latitudes of forms” — and proved the divergence of the harmonic series three centuries before it was rediscovered.
:::

## Exercises

```bug
title: A famous false sum
prompt: 'This manipulation “shows” that $1 - 1 + 1 - 1 + \cdots = \frac12$. Where does it go wrong?'
lines:
  - Let $S = 1 - 1 + 1 - 1 + \cdots$
  - Then $1 - S = 1 - (1 - 1 + 1 - 1 + \cdots) = 1 - 1 + 1 - 1 + \cdots = S$.
  - So $2S = 1$ and $S = \frac12$.
wrong: 0
why: |
  Line 1 treats $S$ as a number, but the series **diverges**: its partial sums are $1, 0, 1, 0, \ldots$, which have no limit. Manipulating a divergent series as if it had a sum can “prove” anything — with a different grouping, $(1 - 1) + (1 - 1) + \cdots = 0$. (There are summation methods, such as Cesàro's, that assign $\frac12$ to this series — but they are definitions, not consequences of ordinary addition.)
notes:
  '2': Given line 2, this is correct algebra. The problem is earlier.
```

```prove
title: Divergence by comparison
prompt: 'Prove that $\sum_{n=1}^\infty \frac{1}{\sqrt n}$ diverges.'
hints:
  - 'Compare with the harmonic series: which is larger, $\frac1{\sqrt n}$ or $\frac1n$?'
rubric:
  - 'You observed $\frac1{\sqrt n} \ge \frac1n$ for $n \ge 1$ (because $\sqrt n \le n$).'
  - You applied the comparison test (in its divergence form) with the harmonic series.
solution: |
  For $n \ge 1$, $\sqrt n \le n$, so $\frac1{\sqrt n} \ge \frac1n > 0$. The harmonic series $\sum \frac1n$ diverges (Oresme), so by the comparison test $\sum \frac1{\sqrt n}$ diverges too.
```

```quiz
q: 'Which of these series converge?'
options:
  - text: 'Only $\sum \frac{1}{n^2}$.'
    why: '$\sum \frac1{2^n}$ is geometric with ratio $\frac12$.'
  - text: '$\sum \frac1{n^2}$ and $\sum \frac{1}{2^n}$, but not $\sum \frac1n$ or $\sum \frac{1}{\sqrt n}$.'
    correct: true
    why: The last two are at least as large as the harmonic series.
  - text: All four, since their terms tend to zero.
    why: Terms tending to zero is necessary, not sufficient — Oresme's example.
```

:::challenge
**Euler meets the primes.** In Chapter 4 we met Euler's product $\sum_n \frac1{n^s} = \prod_p \left(1 - \frac{1}{p^s}\right)^{-1}$. Taking $s = 2$ and the Basel formula, show that $\prod_p \left(1 - \frac1{p^2}\right) = \frac{6}{\pi^2}$. Interpret this as a probability: two integers chosen “at random” are coprime with probability $\frac{6}{\pi^2} \approx 0.61$. Test it by picking random pairs.
:::

## Further reading

- William Dunham, *Euler: The Master of Us All* — a chapter on the Basel problem, with Euler's arguments in detail.:cite[dunham-euler]
- Martin Aigner and Günter Ziegler, *Proofs from THE BOOK*, “Three times π²/6” — the proof above and two more.:cite[aigner-ziegler]
