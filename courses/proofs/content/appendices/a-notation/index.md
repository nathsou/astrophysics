---
number: A
title: Logic and set notation
summary: The symbols used in the course, what they mean, and how to read them aloud.
---

Mathematical notation is a compressed language. Each symbol below abbreviates a word or phrase; when you read a formula aloud, expand it back into that phrase. If you cannot read a formula aloud as a sentence, you do not yet understand it.

## Logic

| Symbol | Read as | Meaning | Chapter |
|---|---|---|---|
| $\lnot P$ | not $P$ | true when $P$ is false | 1 |
| $P \land Q$ | $P$ and $Q$ | both are true | 1 |
| $P \lor Q$ | $P$ or $Q$ | at least one is true (inclusive or) | 1 |
| $P \to Q$ | if $P$ then $Q$; $P$ implies $Q$ | false only when $P$ is true and $Q$ false | 1 |
| $P \leftrightarrow Q$ | $P$ if and only if $Q$ | same truth value | 1 |
| $P \uparrow Q$ | $P$ nand $Q$ | not both | 1 |
| $\forall x\, P(x)$ | for all $x$, $P(x)$ | every $x$ in the domain satisfies $P$ | 2 |
| $\exists x\, P(x)$ | there exists $x$ such that $P(x)$ | at least one $x$ satisfies $P$ | 2 |
| $\exists!\, x\, P(x)$ | there is exactly one $x$ with $P(x)$ | existence and uniqueness | 2 |
| $\equiv$ (between formulas) | is equivalent to | same truth table | 1 |
| $\top$, $\bot$ | true, false (contradiction) | constants | 1, 3 |

## Sets and numbers

| Symbol | Read as | Meaning | Chapter |
|---|---|---|---|
| $\mathbb{N}$ | the natural numbers | $\{0, 1, 2, \ldots\}$ | 2 |
| $\mathbb{Z}$ | the integers | $\{\ldots, -1, 0, 1, \ldots\}$ | 2 |
| $\mathbb{Q}$ | the rationals | fractions $p/q$ with $q \ne 0$ | 2 |
| $\mathbb{R}$ | the reals | the complete ordered field | 14 |
| $x \in A$ | $x$ is in $A$ | membership | 2 |
| $A \subseteq B$ | $A$ is a subset of $B$ | every element of $A$ is in $B$ | 11 |
| $\{x : P(x)\}$ | the set of $x$ such that $P(x)$ | set-builder notation | 11 |
| $\mathcal{P}(A)$ | the power set of $A$ | the set of all subsets of $A$ | 11 |
| $\lvert A\rvert$ | the cardinality of $A$ | its size | 11 |
| $f : A \to B$ | $f$ from $A$ to $B$ | a function with domain $A$ | 11 |
| $[a, b]$, $(a, b)$ | closed, open interval | with or without the endpoints | 13 |
| $\sup A$ | the supremum of $A$ | least upper bound | 14 |

## Numbers and divisibility

| Symbol | Read as | Meaning | Chapter |
|---|---|---|---|
| $a \mid b$ | $a$ divides $b$ | $b = ka$ for an integer $k$ | 4 |
| $\gcd(a, b)$ | the greatest common divisor | largest common divisor | 6 |
| $a \equiv b \pmod n$ | $a$ is congruent to $b$ modulo $n$ | $n \mid a - b$ | 8 |
| $\varphi(n)$ | phi of $n$ | numbers in $1..n$ coprime to $n$ | 8 |
| $\left(\frac{a}{p}\right)$ | the Legendre symbol | $\pm 1$: is $a$ a square mod $p$? | 10 |
| $n!$ | $n$ factorial | $1 \cdot 2 \cdots n$ | 5 |
| $\binom nk$ | $n$ choose $k$ | number of $k$-element subsets | 8 |
| $\lfloor x \rfloor$ | the floor of $x$ | largest integer $\le x$ | 2 |

## Analysis

| Symbol | Read as | Meaning | Chapter |
|---|---|---|---|
| $a_n \to L$ | $a_n$ tends to $L$ | $\forall \varepsilon > 0\ \exists N\ \forall n \ge N\ \lvert a_n - L\rvert < \varepsilon$ | 13 |
| $\lim_{x \to a} f(x)$ | the limit of $f(x)$ as $x$ tends to $a$ | ε–δ limit | 13 |
| $\sum_{n=1}^\infty a_n$ | the sum of $a_n$ from $1$ to infinity | the limit of the partial sums | 16 |
| $f'(x)$ | $f$ prime of $x$ | the derivative | 15 |
| $\int_a^b f(x)\,dx$ | the integral of $f$ from $a$ to $b$ | limit of Riemann sums | 15 |

## Proof words

| Word | What it signals |
|---|---|
| **Theorem** | an important proved statement |
| **Lemma** | a stepping stone, proved for use in a bigger result |
| **Corollary** | an immediate consequence of a theorem |
| **Proposition** | a proved statement of middling importance |
| **Conjecture** | a statement believed but not proved |
| $\blacksquare$ or ∎ | end of proof (Halmos's “tombstone”) |
| “without loss of generality” | the other cases are identical up to renaming |
| “it suffices to show” | the rest follows from what comes next |
| “vacuously true” | true because the hypothesis never holds |
