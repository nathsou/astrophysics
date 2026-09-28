---
number: 3
title: The irrationality of √2
summary: The diagonal of a square has no common measure with its side. Proof by contradiction, the Pythagorean crisis, a proof you can watch, and the near-misses that fooled nobody.
duration: About 2 hours
prerequisites: [truth-and-consequence]
theorems: [√2 is irrational, √n is irrational unless n is a perfect square]
techniques: [proof by contradiction, parity, infinite descent, well-ordering]
---

A Babylonian student, some time around 1700 BC, pressed a stylus into a small round clay tablet. It shows a square with its two diagonals, and along one diagonal the number $1;24,51,10$ in base sixty — that is,

$$1 + \frac{24}{60} + \frac{51}{60^2} + \frac{10}{60^3} = 1.41421296\ldots$$

The tablet, now known as YBC 7289 in the Yale Babylonian Collection, gives the diagonal of a unit square correct to about one part in two million.:cite[fowler1998] The Babylonians knew the diagonal very well. What they never asked — as far as we know — is whether it can be written *exactly* as a fraction.

The Greeks asked, and the answer shook them.

## Measuring with a common unit

Greek mathematics was geometric. Two lengths were called **commensurable** if some unit length fits a whole number of times into each: if one is $p$ units and the other $q$ units, their ratio is $p : q$. The Pythagoreans believed that any two lengths are commensurable — that, in the end, everything is ratios of whole numbers.

For the side and diagonal of a square, this belief says that the ratio of diagonal to side, which Pythagoras' theorem shows is $\sqrt2$, is a ratio of whole numbers $p / q$. In modern language:

:::theorem{name="Irrationality of √2" who="the Pythagoreans" year="5th century BC"}
There are no whole numbers $p$ and $q$, with $q \ne 0$, such that $\left(\dfrac pq\right)^2 = 2$. That is, $\sqrt 2$ is irrational.
:::

Notice what kind of statement this is. It says that something does *not* exist — no pair $p, q$ whatever. We cannot check all pairs. We need a new kind of argument.

## Proof by contradiction

To prove that a statement $P$ is true, **assume that it is false** and deduce something impossible — a contradiction, a statement of the form $Q \land \lnot Q$. Since true assumptions never lead to false conclusions, the assumption $\lnot P$ must have been false. So $P$ is true.

In the language of Chapter 1, the proof shows $\lnot P \to \bot$ (where $\bot$ is a contradiction), and the truth table of $\to$ says that this can only be true when $\lnot P$ is false. For statements that something does not exist, contradiction is the natural method: assume it *does* exist, give it a name, and study it until it misbehaves.

## The classic proof

Aristotle mentions this proof around 350 BC, as the standard example of a proof by contradiction: if the diagonal were commensurable with the side, “odd numbers would be equal to evens”.:cite[heath1921] It uses one fact we proved in Chapter 1: *if $n^2$ is even, then $n$ is even.*

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
If $\sqrt 2 = p/q$ in lowest terms, then $p^2 = 2q^2$ forces $p$ to be even, and then $q$ to be even — but a fraction in lowest terms cannot have both parts even.
:::
:::level[Sketch]
Suppose $\sqrt2 = p/q$, with the fraction in lowest terms. Squaring, $p^2 = 2q^2$, so $p^2$ is even and so $p$ is even: $p = 2r$. Then $4r^2 = 2q^2$, so $q^2 = 2r^2$ is even, and $q$ is even. Both $p$ and $q$ are even, contradicting lowest terms.
:::
:::level[Proof]
Suppose, for a contradiction, that $\sqrt2$ is rational. Then $\sqrt 2 = p/q$ for some integers $p, q$ with $q > 0$, and by cancelling common factors we may assume that $p$ and $q$ have no common factor greater than $1$. (We could also take $p > 0$, but we won't need it.)

Squaring and multiplying by $q^2$ gives $p^2 = 2q^2$. So $p^2$ is even, and by the theorem of Chapter 1, $p$ is even. Write $p = 2r$ with $r$ an integer.

Substituting, $4r^2 = 2q^2$, so $q^2 = 2r^2$. So $q^2$ is even, and therefore $q$ is even.

Now $2$ divides both $p$ and $q$, contradicting the assumption that they have no common factor greater than $1$. So the assumption that $\sqrt 2$ is rational is false: $\sqrt2$ is irrational.
:::
::::

```parsons
title: Rebuild the classic proof
prompt: Put the lines of the proof in order. There is one line too many.
lines:
  - Suppose, for a contradiction, that $\sqrt2 = p/q$ with $p, q$ integers having no common factor.
  - Then $p^2 = 2q^2$, so $p^2$ is even.
  - Hence $p$ is even; write $p = 2r$.
  - Then $4r^2 = 2q^2$, so $q^2 = 2r^2$ is even, and $q$ is even.
  - So $2$ is a common factor of $p$ and $q$ — a contradiction. Hence $\sqrt 2$ is irrational.
distractors:
  - Since $p^2$ is even, $p^2 = 2r$ and so $p = \sqrt{2r}$.
explain: The distractor is true but useless — it goes back to square roots, which is exactly what we are trying to avoid. The proof works with whole numbers throughout.
```

:::question
Where exactly did we use the assumption that $p/q$ is in lowest terms? Could we have avoided it? Think about what happens if you keep going: from $p^2 = 2q^2$ we got $q^2 = 2r^2$, a new solution with smaller numbers.
:::

## The descent that never ends

The question above points at a second way to organise the proof, which does not need lowest terms at all. From any solution $(p, q)$ of $p^2 = 2q^2$ in positive integers, the argument produced another solution $(q, r)$ with $r = p/2$. And $q < p$ (since $p^2 = 2q^2 > q^2$). So from one solution we get a smaller one, from that a smaller one still, and so on for ever:

$$p > q > r > \cdots > 0 .$$

But a decreasing sequence of positive integers cannot go on for ever: it must stop within $p$ steps. This contradiction is called **infinite descent**. Fermat made it famous in the seventeenth century (Chapter 7), and it rests on a basic property of the natural numbers:

:::key
**Well-ordering.** Every non-empty set of natural numbers has a smallest element. Equivalently, there is no infinite strictly decreasing sequence of natural numbers.
:::

“Lowest terms” and “infinite descent” are two faces of well-ordering: one picks the smallest solution at the start, the other shows that any solution produces a smaller one. Chapter 6 makes this into a technique of its own.

In the 1950s the logician Stanley Tennenbaum found a version of the descent that you can *see*. Suppose $n^2 = 2m^2$. Then a square of side $n$ has the same area as two squares of side $m$. Put the two small squares in opposite corners of the big one. They overlap in the middle and leave two corners uncovered — and since the total areas are equal, **the overlap has the same area as the two uncovered corners together**.:cite[conway-shipman]

::tennenbaum-descent

The overlap is a square of side $2m - n$, and the corners are squares of side $n - m$. So $(2m - n)^2 = 2(n - m)^2$: another solution, in smaller whole numbers. In the real-number picture you can zoom for ever. With whole numbers you can't, and switching to whole numbers shows what really happens: the numbers shrink until they fail, because they were never an exact solution in the first place.

```step
title: The algebra behind the picture
prompt: 'Show the identity behind Tennenbaum''s picture: $(2m - n)^2 - 2(n - m)^2 = 2m^2 - n^2$ for all $m, n$. So if $n^2 = 2m^2$, then $(2m-n)^2 = 2(n-m)^2$.'
start: (2m - n)^2 - 2(n - m)^2
target: 2m^2 - n^2
relation: '='
initial: (2m - n)^2 - 2(n - m)^2
hints:
  - Expand both squares.
solution: '$(2m-n)^2 - 2(n-m)^2 = (4m^2 - 4mn + n^2) - (2n^2 - 4mn + 2m^2) = 2m^2 - n^2$.'
```

:::history{year="5th century BC" title="The Pythagorean crisis" people="Hippasus of Metapontum, Theodorus of Cyrene, Theaetetus, Eudoxus"}
Later Greek writers tell of a Pythagorean named Hippasus who revealed the existence of incommensurable magnitudes to outsiders — and who drowned at sea, whether by accident or as divine punishment. The story is legend, but the discovery was real, and it mattered. If lengths are not always ratios of whole numbers, then the Pythagorean theory of proportion, and every geometric proof built on it, needed new foundations.

In Plato's dialogue *Theaetetus*, set around 399 BC, the mathematician Theodorus proves that the square roots of $3, 5, 6, \ldots, 17$ (the non-squares) are irrational one by one, stopping at $17$ for reasons we can only guess. His young student Theaetetus then found the general theorem. A generation later, Eudoxus of Cnidus produced a theory of ratios that works for incommensurable magnitudes too; it survives as Book V of Euclid's *Elements*, and it anticipates, by over two thousand years, the way Richard Dedekind defined the real numbers in 1872 (Chapter 14).:cite[heath1921]
:::

## Near misses

If $\sqrt 2$ is not a fraction, how did the Babylonians approximate it so well? The Greeks had a beautiful answer, recorded by Theon of Smyrna in the second century AD: a ladder of *side and diagonal numbers*.

::theon-ladder

The quantity $p^2 - 2q^2$ is $-1, +1, -1, +1, \ldots$: every rung misses an exact solution by the smallest possible amount, and the fraction $p/q$ gets closer and closer to $\sqrt2$. The ladder's rule, $(q, p) \mapsto (q + p, p + 2q)$, is exactly Tennenbaum's descent run backwards — undo it and you get $(2q - p, p - q)$, the smaller solution. It never reaches $0$, because the descent would then have nowhere to stop.

These pairs solve **Pell's equation** $p^2 - 2q^2 = \pm 1$, which will return in Chapter 19 as part of the theory of how well irrational numbers can be approximated by fractions.

## Every non-square root

Theaetetus' theorem says that the square root of a whole number is either a whole number or irrational — there is nothing in between. The parity argument above does not generalise easily (try it for $\sqrt 6$), but a sharper form of the descent does.

:::theorem{name="Theaetetus’ theorem"}
If $n$ is a positive integer that is not a perfect square, then $\sqrt n$ is irrational.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If $\sqrt n = p / q$, subtract the whole-number part $k = \lfloor \sqrt n \rfloor$ and flip: a clever rearrangement writes $\sqrt n$ as a fraction with a *smaller* positive denominator. Starting from the smallest denominator gives a contradiction.
:::
:::level[Proof]
Suppose, for a contradiction, that $\sqrt n$ is rational. Among all ways of writing $\sqrt n = p/q$ with positive integers $p, q$, choose one with $q$ as small as possible (well-ordering). Let $k$ be the integer with $k < \sqrt n < k + 1$; there is one, because $n$ is not a perfect square, so $\sqrt n$ is not an integer.

Consider $q' = p - kq = q(\sqrt n - k)$. Since $0 < \sqrt n - k < 1$, we have $0 < q' < q$, and $q'$ is an integer. Now let $p' = nq - kp$, also an integer. Using $p = q\sqrt n$,
$$\frac{p'}{q'} = \frac{nq - kq\sqrt n}{q\sqrt n - kq} = \frac{\sqrt n\,(\sqrt n - k)\,q}{(\sqrt n - k)\,q} = \sqrt n .$$
So $\sqrt n = p'/q'$ with a positive denominator $q' < q$, contradicting the choice of $q$.
:::
::::

The step checker can confirm the key identity. It knows that $(\sqrt n)^2 = n$.

```step
title: The new fraction
prompt: 'Assume $p = q\sqrt n$. Show that $\dfrac{nq - kp}{p - kq} = \sqrt n$. (Type `sqrt(n)` for $\sqrt n$. The checker knows that $p$ stands for $q\sqrt n$.)'
defs: ['p = q sqrt(n)']
start: (n q - k p)/(p - k q)
target: sqrt(n)
relation: '='
initial: (n q - k p)/(p - k q)
domains: { n: pos, q: pos }
hints:
  - 'Replace `p` by `q sqrt(n)` and factor $\sqrt n - k$ out of the numerator: $nq - kq\sqrt n = \sqrt n\,q\,(\sqrt n - k)$.'
solution: '$\dfrac{nq - kq\sqrt n}{q\sqrt n - kq} = \dfrac{\sqrt n\, q(\sqrt n - k)}{q(\sqrt n - k)} = \sqrt n$.'
```

## An irrational power of an irrational

Here is a small, famous proof that shows how strange proofs by cases can be.

:::theorem
There exist irrational numbers $a$ and $b$ such that $a^b$ is rational.
:::

:::proof
Consider $x = \sqrt2^{\sqrt2}$. Either $x$ is rational or it is not. If it is rational, take $a = b = \sqrt 2$. If it is irrational, take $a = x$ and $b = \sqrt 2$: then
$$a^b = \left(\sqrt2^{\sqrt2}\right)^{\sqrt2} = \sqrt2^{\sqrt2 \cdot \sqrt2} = \sqrt2^{\,2} = 2,$$
which is rational. Either way, suitable $a$ and $b$ exist.
:::

The proof is correct, and yet at the end we do not know which pair works. (In fact $\sqrt2^{\sqrt2}$ is irrational, and even transcendental, by a deep theorem of Gelfond and Schneider from 1934 — so the second pair is the right one.) Some mathematicians, following L. E. J. Brouwer, reject such arguments: for them, a proof of existence must provide the object. Their **intuitionistic** logic drops the law of excluded middle, $P \lor \lnot P$, on which the case split relies. Everyone agrees, though, that a proof giving the object is more informative — and there are easy constructive examples: $a = \sqrt 2$ and $b = 2\log_2 3$ give $a^b = 3$.

:::bio{name="Eudoxus of Cnidus" born="c. 408 BC" died="c. 355 BC" place="Cnidus, Athens"}
Astronomer, physician, geographer and the greatest mathematician of Plato's circle. Faced with the discovery of incommensurables, he defined when two ratios of magnitudes are equal — whether or not the magnitudes have a common measure — by comparing all their whole-number multiples. He also invented the *method of exhaustion*, which Archimedes used to find areas and volumes, and which is the ancestor of the limits of Chapter 13. None of his writings survive; we know his work through Euclid and Archimedes.
:::

## Exercises

```bug
title: √4 is irrational?
prompt: 'Since $\sqrt4 = 2$, this “proof” must be wrong. Click the first line that does not follow.'
lines:
  - Suppose $\sqrt4 = p/q$ with $p$ and $q$ having no common factor.
  - Then $p^2 = 4q^2$, so $p^2$ is even and $p$ is even.
  - Write $p = 2r$. Then $4r^2 = 4q^2$, so $r^2 = q^2$.
  - Hence $q^2$ is even, so $q$ is even.
  - So $p$ and $q$ are both even — a contradiction.
wrong: 3
why: '$r^2 = q^2$ does not make $q^2$ even: $r = q = 1$ works. In the $\sqrt 2$ proof we had $q^2 = 2r^2$, and the factor $2$ is what made $q^2$ even. Here it has cancelled — as it must, since $\sqrt4 = 2/1$.'
```

```prove
title: The irrationality of √3
prompt: Prove that $\sqrt 3$ is irrational. You may use the fact that if $3$ divides $n^2$ then $3$ divides $n$ — or better, prove that fact too.
hints:
  - Copy the structure of the $\sqrt2$ proof, with divisibility by $3$ in place of evenness.
  - 'To prove “if $3 \mid n^2$ then $3 \mid n$”, use the contrapositive: if $n = 3k + 1$ or $n = 3k + 2$, what is $n^2$ modulo $3$?'
rubric:
  - You assumed $\sqrt3 = p/q$ in lowest terms (or used a descent) and derived $p^2 = 3q^2$.
  - 'You concluded $3 \mid p$, wrote $p = 3r$, and got $q^2 = 3r^2$, so $3 \mid q$.'
  - You stated the contradiction clearly.
  - 'You justified “$3 \mid n^2 \Rightarrow 3 \mid n$” (by cases on $n \bmod 3$), or explicitly quoted it.'
solution: |
  First, if $3 \nmid n$ then $n = 3k + 1$ or $n = 3k + 2$, and $n^2 = 3(3k^2 + 2k) + 1$ or $n^2 = 3(3k^2 + 4k + 1) + 1$; either way $3 \nmid n^2$. So $3 \mid n^2$ implies $3 \mid n$.

  Now suppose $\sqrt3 = p/q$ with $p, q$ positive integers with no common factor. Then $p^2 = 3q^2$, so $3 \mid p^2$ and hence $3 \mid p$; write $p = 3r$. Then $9r^2 = 3q^2$, so $q^2 = 3r^2$, hence $3 \mid q$. So $3$ divides both $p$ and $q$, a contradiction. Therefore $\sqrt 3$ is irrational.
tutor: Look for the lemma 3 | n² ⇒ 3 | n being justified (e.g. by cases n ≡ 1, 2 mod 3). Parity arguments do not work for √3.
```

```quiz
q: 'A student proves “if $n^2$ is even then $n$ is even” like this: *Suppose $n^2$ is even and $n$ is odd. Then $n = 2k+1$, so $n^2 = 2(2k^2+2k)+1$ is odd — a contradiction.* What kind of proof is this really?'
options:
  - text: A proof by contradiction that could not be done any other way.
    why: Look at what the argument actually uses.
  - text: A proof of the contrapositive, dressed up as a contradiction.
    correct: true
    why: 'It never uses “$n^2$ is even” until the last line: it just shows *odd ⇒ odd square*, which is the contrapositive. Writing it directly is clearer.'
  - text: Not a valid proof.
    why: It is valid, just roundabout.
```

:::challenge
**A logarithm.** Prove that $\log_2 3$ is irrational. (Suppose $\log_2 3 = p/q$ with positive integers $p, q$. Then $2^p = 3^q$. Why is that impossible?) Then find the flaw in this claim: “$\log_4 8$ is irrational, by the same argument.”
:::

## Further reading

- David Fowler, *The Mathematics of Plato's Academy* — what the Greeks actually knew about ratios, and what they did not.:cite[fowler1998]
- John Conway and Joseph Shipman, “Extreme proofs I: the irrationality of $\sqrt2$” — more than a dozen proofs, compared.:cite[conway-shipman]
