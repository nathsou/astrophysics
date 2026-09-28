---
number: B
title: The step checker
summary: What the in-browser checker proves, what it only tests, and how to type mathematics for it — with a playground to try it.
---

Many exercises in this course ask you to type a chain of equalities or inequalities, which a small computer algebra system checks step by step. This appendix explains exactly what it does, so that you can trust its answers for what they are — and not for more.

## Playground

Type any chain. Each line may start with a relation (`=`, `<`, `<=`, `>`, `>=`, `!=`), and anything after `#` is a comment.

```step
title: Try anything
prompt: 'No goal here: the checker simply reports on each step. Try `(a+b)^2 = a^2 + 2ab + b^2`, then `sin(x)^2 + cos(x)^2 = 1`, then `(a+b)^2 = a^2 + b^2`.'
id: appendix/playground
rows: 4
```

## Three verdicts

Every step gets one of three verdicts.

**✓ algebra — proved.** Both sides were reduced to the same *canonical form*: a rational function (a fraction of polynomials) in the variables and in a few kinds of more complicated building blocks. If two expressions have the same canonical form, they are equal wherever both are defined. This is a proof.

**✓ tested — very probably true.** The checker could not prove the step algebraically, so it tried it at around two hundred values of the variables (chosen from each variable's domain, and satisfying any assumptions the exercise states) and it held every time. That is strong evidence, not a proof: Chapter 0 is about exactly this difference. Steps that use an induction hypothesis, or a trigonometric identity, or an inequality that isn't a simple sum of squares, usually end up here.

**✗ fails at … — refuted.** The checker found values at which the step is false, and shows both sides there. A single counterexample is a proof that the step is wrong.

A fourth message, **⚠**, means the checker could not read what you typed; it tells you where the problem is.

## What counts as “the same” algebraically

The canonical form knows the rules you would use by hand:

- expanding and collecting polynomials, and adding fractions over a common denominator (so $\frac1n - \frac{1}{n+1} = \frac{1}{n(n+1)}$ is proved);
- powers with symbolic exponents: $2^{n+1} = 2 \cdot 2^n$, $4^n = (2^n)^2$, $x^n x^m = x^{n+m}$, $6^n = 2^n 3^n$;
- roots: $\sqrt 8 = 2\sqrt 2$, $(\sqrt x)^2 = x$, $\frac1{\sqrt2} = \frac{\sqrt2}2$, and the golden ratio's $\varphi^2 = \varphi + 1$;
- absolute values squared: $|x|^2 = x^2$; and $(-1)^{2n} = 1$ when $n$ is declared an integer;
- factorials and binomial coefficients: $(n+1)! = (n+1)\,n!$ and $\binom{n}{k} + \binom{n}{k-1} = \binom{n+1}{k}$;
- finite sums and products with a symbolic upper limit peel off their last terms: $\sum_{k=1}^{n+1} f(k) = \sum_{k=1}^n f(k) + f(n+1)$.

Functions it knows nothing special about — $\sin$, $\ln$, $\lfloor\cdot\rfloor$, and functions an exercise leaves undefined, like $f$ in the mean value theorem — are treated as unknown quantities: $f(a) - f(a) = 0$ is proved, but $\sin^2 x + \cos^2 x = 1$ is only tested.

For inequalities, the checker proves $A \le B$ when $B - A$ is visibly non-negative: a polynomial with non-negative coefficients in variables known to be non-negative, a sum of squares of linear expressions (like $a^2 + b^2 - 2ab = (a-b)^2$), or such a polynomial in squares ($a^4 + b^4 - 2a^2b^2$). Everything else is tested.

## Domains and assumptions

Tests use the domain each exercise declares for its variables — real numbers by default, or positive reals, natural numbers and so on — and any assumptions it states, such as $x \ge -1$ in Bernoulli's inequality. A step that is false for negative numbers but true for the exercise's positive ones is accepted, as it should be. For integer variables, the checker computes exactly with whole numbers, so $2^{60} + 1$ and $30!$ are compared without rounding.

## Typing mathematics

| You type | It means |
|---|---|
| `2n(n+1)` | $2n(n+1)$ — multiplication can be implicit |
| `xy` | $x \cdot y$ (unknown words are split into letters) |
| `x^2`, `x²`, `x**2` | $x^2$ (`2^3^2` means $2^{9}$) |
| `-x^2` | $-(x^2)$ |
| `a/b/c` | $(a/b)/c$ |
| `sqrt(2)`, `√2` | $\sqrt 2$ |
| `|a - b|`, `abs(a - b)` | $\lvert a - b\rvert$ |
| `(n+1)!`, `fact(n)` | factorials |
| `binom(n, k)` | $\binom nk$ |
| `sum(k^2, k, 1, n)` | $\sum_{k=1}^n k^2$ (likewise `prod`) |
| `pi`, `π`, `e` | the constants |
| `sin`, `cos`, `tan`, `exp`, `ln`, `floor`, `ceil`, `gcd`, `mod(a, n)` | the usual functions |
| `a_1`, `x_n`, `a_{12}` | subscripted variables |
| `<=`, `≤`, `>=`, `≥`, `!=`, `≠` | relations |

Watch the preview under each step: it shows the expression the checker understood, typeset.

## What it cannot do

The checker checks **steps**, not **arguments**. It cannot tell whether your chain proves what the exercise asks for in the sense that matters — whether you have used the induction hypothesis legitimately, whether your $N$ depends only on $\varepsilon$, whether a case is missing. It checks that each line is a true statement, and it checks the start, the end and the overall relation when an exercise specifies them. The logic of the proof is yours.

The **truth-table lab** of Chapter 1 and the formula exercises are different: propositional logic is decidable, and those checks are complete proofs.

## The AI tutor, and your data

Exercises that ask for a written proof can send your attempt, together with the exercise and its model solution, to Anthropic's Claude model for feedback — only if you add your own API key, and only when you press a button. The key is stored in this browser's local storage and sent only to `api.anthropic.com`; requests are billed to your account. The tutor is instructed never to write the proof for you, only to point at the first gap and ask a question. Without a key, nothing leaves your browser: the step checker, the exercises and your saved progress all run locally.
