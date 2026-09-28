---
number: 17
title: e and π are irrational
summary: The two most famous constants of analysis are not fractions. Fourier’s five-line proof for e, Niven’s one-page proof for π, and Liouville’s explicit construction of a number that is not a root of any polynomial.
duration: About 2½ hours
prerequisites: [infinite-series, fundamental-theorem]
theorems: [e is irrational (Fourier, 1815), π is irrational (Lambert, 1761; Niven, 1947), Liouville’s theorem and Liouville numbers (1844)]
techniques: [contradiction via an integer in (0, 1), estimates, auxiliary functions, the mean value theorem]
---

In Chapter 3 we proved that $\sqrt 2$ is irrational using nothing but whole numbers: if $\sqrt2 = p/q$, then $p^2 = 2q^2$, and parity does the rest. The numbers $e$ and $\pi$ are not defined by equations with whole-number coefficients. They are defined by limits — $\pi$ as a ratio of lengths, $e$ as a limit of compound interest — and a proof of their irrationality must use analysis.

Both proofs in this chapter share a beautiful strategy. Assume the number is a fraction. Build from it a quantity that must be a **whole number** — and then show, by estimates, that it lies **strictly between $0$ and $1$**. No whole number does.

## The number e

In 1683 Jacob Bernoulli asked what happens to a debt with interest compounded more and more often: one pound at $100\%$ a year, compounded $n$ times, grows to $\left(1 + \frac1n\right)^n$. As $n \to \infty$ this tends to $e = 2.71828\ldots$ (it is increasing and bounded, so it converges by the monotone convergence theorem of Chapter 14). Euler showed that the same number is the sum of a series:
$$e = 1 + \frac1{1!} + \frac1{2!} + \frac1{3!} + \cdots = \sum_{k=0}^\infty \frac1{k!} .$$

::to-e

The series converges fantastically fast: each new term is smaller than the previous one by a growing factor. That speed is the whole secret of the proof.

:::theorem{name="e is irrational" who="Leonhard Euler (1737); Joseph Fourier (this proof, 1815)"}
The number $e$ is not rational.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If $e = p/q$, multiply by $q!$. Then $q!\,e$ is a whole number, and so is $q!$ times the first $q + 1$ terms of the series. So the rest, $q!$ times the *tail* of the series, is a whole number too — but the tail is so small that this number lies strictly between $0$ and $1$.
:::
:::level[Proof]
Suppose $e = \frac pq$ with positive integers $p, q$. Let
$$x = q!\left(e - \sum_{k=0}^{q} \frac1{k!}\right) = q!\,e - \sum_{k=0}^q \frac{q!}{k!} .$$
Since $q!\,e = p\,(q-1)!$ is an integer and each $\frac{q!}{k!}$ with $k \le q$ is an integer, $x$ is an integer. But
$$x = \sum_{k = q+1}^\infty \frac{q!}{k!} = \frac1{q+1} + \frac1{(q+1)(q+2)} + \cdots ,$$
which is positive, and less than the geometric series $\frac1{q+1} + \frac1{(q+1)^2} + \frac{1}{(q+1)^3} + \cdots = \frac1q \le 1$. So $0 < x < 1$: an integer strictly between $0$ and $1$. This contradiction shows that $e$ is irrational.
:::
::::

```step
title: The geometric bound
prompt: 'The geometric series $\frac1{q+1} + \frac1{(q+1)^2} + \cdots$ has first term $\frac1{q+1}$ and ratio $\frac1{q+1}$. Show that its sum, $\dfrac{1/(q+1)}{1 - 1/(q+1)}$, equals $\frac1q$.'
domains: { q: posint }
start: (1/(q+1))/(1 - 1/(q+1))
target: 1/q
relation: '='
initial: (1/(q+1))/(1 - 1/(q+1))
solution: '$\dfrac{1/(q+1)}{q/(q+1)} = \dfrac1q$.'
```

Notice where each ingredient enters. That $q!$ clears all the denominators up to $q$ uses the *form* of the series. That the tail is less than $1$ uses its *speed*. A series such as $\sum \frac{1}{2^k}$ is just as “infinite”, but it converges too slowly to push a whole number below $1$ — and indeed its sum, $2$, is rational.

## π

$\pi$ is harder. Its irrationality was first proved by Johann Heinrich Lambert in 1761, using a continued fraction for $\tan x$ that required delicate convergence arguments. In 1947 Ivan Niven published a proof that fits on a single page, using only calculus.:cite[niven1947] It follows the same strategy — an integer strictly between $0$ and $1$ — but the integer is an *integral*.

The idea: if $\pi = \frac ab$, the polynomial $f(x) = \frac{x^n (a - bx)^n}{n!}$ vanishes at $0$ and at $\frac ab = \pi$, is positive in between, and is symmetric: $f(\pi - x) = f(x)$. Then $\int_0^\pi f(x) \sin x\,dx$ turns out to be an integer, for every $n$ — while the integrand shrinks to nothing as $n$ grows.

::niven-integrand

:::theorem{name="π is irrational" who="Lambert (1761); Niven (this proof, 1947)"}
The number $\pi$ is not rational.
:::

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
From $\pi = a/b$ build a polynomial $f$ whose derivatives all take integer values at $0$ and $\pi$. Integrating by parts again and again shows that $\int_0^\pi f(x) \sin x\,dx$ is an integer; the integrand is positive, so the integer is at least $1$; but a simple bound shows it is less than $1$ for large $n$.
:::
:::level[Sketch]
Let $f(x) = x^n(a - bx)^n / n!$. Every derivative $f^{(j)}(0)$ is an integer (the polynomial $x^n(a-bx)^n$ has integer coefficients and only powers $x^j$ with $j \ge n$, and $\frac{j!}{n!}$ is an integer). By the symmetry $f(\pi - x) = f(x)$, the same holds at $\pi$. Put $F = f - f'' + f^{(4)} - \cdots + (-1)^n f^{(2n)}$. Then $F + F'' = f$, so $\big(F'(x)\sin x - F(x)\cos x\big)' = f(x)\sin x$, and $\int_0^\pi f \sin = F(\pi) + F(0)$, an integer. But $0 < f(x)\sin x < \frac{\pi^n a^n}{n!}$ on $(0, \pi)$, and $\frac{\pi^n a^n}{n!} \to 0$.
:::
:::level[Proof]
Suppose $\pi = \frac ab$ with positive integers $a, b$. For a positive integer $n$ let
$$f(x) = \frac{x^n (a - bx)^n}{n!} .$$

*Integer values.* Expanding, $n!\,f(x) = \sum_{j=n}^{2n} c_j x^j$ with integers $c_j$. So $f^{(j)}(0) = 0$ for $j < n$ and $f^{(j)}(0) = \frac{j!}{n!} c_j$ for $n \le j \le 2n$ (and $0$ beyond) — integers in every case. Since $f(\pi - x) = f(\frac ab - x) = f(x)$, differentiating $j$ times gives $(-1)^j f^{(j)}(\pi - x) = f^{(j)}(x)$, so $f^{(j)}(\pi) = (-1)^j f^{(j)}(0)$ is an integer too.

*The integral is an integer.* Let $F(x) = f(x) - f''(x) + f^{(4)}(x) - \cdots + (-1)^n f^{(2n)}(x)$. Since $f^{(2n+2)} = 0$, we have $F'' + F = f$. Then
$$\frac{d}{dx}\big(F'(x)\sin x - F(x)\cos x\big) = F''(x)\sin x + F(x)\sin x = f(x)\sin x,$$
so by the fundamental theorem of calculus (Chapter 15),
$$I_n = \int_0^\pi f(x)\sin x\,dx = \big[F'\sin - F\cos\big]_0^\pi = F(\pi) + F(0),$$
an integer.

*But $0 < I_n < 1$ for large $n$.* For $0 < x < \pi$ we have $0 < x < \pi$, $0 < a - bx < a$ and $0 < \sin x \le 1$, so $0 < f(x)\sin x < \frac{\pi^n a^n}{n!}$. Hence $0 < I_n < \frac{\pi^{n+1}a^n}{n!}$. Since $\frac{c^n}{n!} \to 0$ for any constant $c$ (the ratio of consecutive terms is $\frac{c}{n+1} \to 0$), for large $n$ this bound is less than $1$. So $I_n$ is an integer strictly between $0$ and $1$ — a contradiction. Therefore $\pi$ is irrational.
:::
::::

The auxiliary function $F$ looks as if it came from nowhere. It is what you get from integrating $\int f \sin$ by parts $2n + 1$ times until the polynomial is differentiated away; Niven simply wrote down the result. When you meet a proof that pulls a rabbit out of a hat, ask what computation would have produced the rabbit.

## Numbers that are not roots of polynomials

Irrationality says a number is not a root of $qx - p$. A stronger property is being **transcendental**: not a root of any non-zero polynomial with integer coefficients. $\sqrt 2$ is irrational but algebraic, a root of $x^2 - 2$. Cantor's argument of 1874 (Chapter 11) showed that almost every real number is transcendental — without exhibiting one. Thirty years earlier, Joseph Liouville had exhibited one. His key observation is about how well a number can be approximated by fractions.

:::theorem{name="Liouville’s theorem" who="Joseph Liouville" year=1844}
Let $\alpha$ be an irrational root of a polynomial of degree $d$ with integer coefficients. Then there is a constant $c > 0$ such that
$$\left|\alpha - \frac pq\right| > \frac{c}{q^d}$$
for every fraction $\frac pq$ with $q > 0$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If $P$ is the polynomial, $P(p/q)$ is a fraction with denominator $q^d$ and it is not zero, so it is at least $\frac1{q^d}$ in size. But by the mean value theorem, $|P(p/q)| = |P(p/q) - P(\alpha)|$ is at most a constant times $|\alpha - \frac pq|$. So $\frac pq$ cannot be very close to $\alpha$.
:::
:::level[Proof]
Take $P$ of the smallest possible degree $d$ with integer coefficients and $P(\alpha) = 0$. Then $P$ has no rational root $r$: otherwise $P(x) = (x - r)Q(x)$ with $Q$ of degree $d - 1$, and $Q(\alpha) = 0$ since $\alpha \ne r$; clearing denominators in $Q$ would contradict minimality. So for every fraction, $q^d P(\frac pq)$ is a non-zero integer, and $|P(\frac pq)| \ge \frac1{q^d}$.

Let $M$ be the maximum of $|P'|$ on $[\alpha - 1, \alpha + 1]$ (extreme value theorem). If $|\alpha - \frac pq| \le 1$, the mean value theorem gives $\xi$ between them with
$$\frac1{q^d} \le \left|P\!\left(\tfrac pq\right) - P(\alpha)\right| = |P'(\xi)|\,\left|\alpha - \tfrac pq\right| \le M \left|\alpha - \tfrac pq\right| .$$
So $|\alpha - \frac pq| \ge \frac{1}{Mq^d}$. If $|\alpha - \frac pq| > 1$, then certainly $|\alpha - \frac pq| > \frac1{q^d}$. So $c = \frac12\min\left(1, \frac1M\right)$ works.
:::
::::

Now build a number that fractions approximate *too well*:
$$L = \sum_{k=1}^\infty 10^{-k!} = 0.110001000000000000000001000\ldots$$

::liouville

:::corollary{name="Liouville’s constant is transcendental"}
$L$ is not a root of any non-zero polynomial with integer coefficients.
:::

:::proof
$L$ is irrational, since its decimal expansion never repeats. Suppose it were a root of a polynomial of degree $d$, and let $c$ be the constant from Liouville's theorem. Truncating after the $k$th one gives a fraction $\frac pq$ with $q = 10^{k!}$ and
$$0 < L - \frac pq = 10^{-(k+1)!} + 10^{-(k+2)!} + \cdots < 2 \cdot 10^{-(k+1)!} = \frac{2}{q^{k+1}} .$$
For $k \ge d$ and $q$ large enough that $\frac{2}{q^{k+1-d}} \le c$, this is at most $\frac{c}{q^d}$, contradicting the theorem.
:::

:::history{year=1882 title="Squaring the circle" people="Charles Hermite, Ferdinand von Lindemann"}
Can one construct, with ruler and compass alone, a square with the same area as a given circle? The problem had been open since ancient Greece. Every length constructible with ruler and compass is algebraic (it is built from the starting lengths by $+, -, \times, \div$ and square roots). Squaring the unit circle means constructing $\sqrt\pi$, so it is impossible if $\pi$ is transcendental. In 1873 Charles Hermite proved that $e$ is transcendental, by a far-reaching refinement of the “integer between $0$ and $1$” method. In 1882 Ferdinand von Lindemann extended Hermite's method to show that $e^\alpha$ is transcendental for every non-zero algebraic $\alpha$. Since $e^{i\pi} = -1$ is algebraic, $i\pi$ cannot be algebraic, so neither is $\pi$ — and the circle cannot be squared. Many simple questions remain open: nobody knows whether $e + \pi$ or $e\pi$ is irrational.
:::

:::bio{name="Joseph Liouville" born=1809 died=1882 place="Saint-Omer and Paris"}
Liouville worked across analysis, number theory, differential geometry and mathematical physics — his name is on theorems in all of them. In 1836 he founded the *Journal de Mathématiques Pures et Appliquées*, still one of the leading journals, and in 1846 he published in it the papers of Évariste Galois, fourteen years after Galois's death at twenty, with an appreciative introduction that finally brought Galois theory to the world. He was briefly a member of the National Assembly after the revolution of 1848, and was defeated in the election of 1849.
:::

## Exercises

```prove
title: Two roots at once
prompt: 'Prove that $\sqrt 2 + \sqrt 3$ is irrational.'
hints:
  - Suppose $\sqrt2 + \sqrt3 = r$ is rational. Square both sides.
  - 'You get $5 + 2\sqrt 6 = r^2$. Why is that a contradiction? (You may use that $\sqrt 6$ is irrational, from Chapter 3.)'
rubric:
  - You assumed $\sqrt2 + \sqrt3 = r$ with $r$ rational.
  - 'You squared to get $\sqrt 6 = \frac{r^2 - 5}{2}$.'
  - You concluded that $\sqrt 6$ would be rational, contradicting Theaetetus' theorem (6 is not a perfect square).
solution: |
  Suppose $\sqrt2 + \sqrt 3 = r$ with $r$ rational. Squaring, $2 + 2\sqrt6 + 3 = r^2$, so $\sqrt 6 = \frac{r^2 - 5}{2}$ would be rational. But $6$ is not a perfect square, so $\sqrt 6$ is irrational (Chapter 3). Contradiction.
```

```quiz
q: 'In the proof that $e$ is irrational, which property of the series $\sum \frac1{k!}$ does the work?'
options:
  - text: That it converges.
    why: '$\sum \frac1{2^k} = 2$ converges too, and its sum is rational.'
  - text: That $q!$ clears all denominators of the first $q + 1$ terms, while $q!$ times the tail is still less than $1$.
    correct: true
    why: The factorials in the denominators both make the head an integer and make the tail tiny.
  - text: That its terms are all rational.
    why: Every term of $\sum \frac1{2^k}$ is rational too.
```

:::challenge
**e² is irrational too.** Suppose $e^2 = \frac pq$, so $qe = pe^{-1}$. Multiply by $n!$ and use the series for $e$ and $e^{-1}$ with $n$ odd and large: show that the two sides differ from integers by amounts that can't cancel. (This refinement is due to Liouville, 1840. Proving that $e^3$ is irrational this way is much harder — which is part of what Hermite's method overcame.)
:::

## Further reading

- Ivan Niven, “A simple proof that π is irrational” — one page.:cite[niven1947]
- Ivan Niven, *Irrational Numbers* — the whole subject, from $\sqrt2$ to Lindemann.:cite[niven-irrational]
