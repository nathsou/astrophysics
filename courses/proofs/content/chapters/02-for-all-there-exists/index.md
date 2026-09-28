---
number: 2
title: For all, there exists
summary: Quantifiers as a game between a prover and a sceptic, how to negate any statement mechanically, why the order of “for all” and “there exists” matters — and a proof that there is a fraction in every gap.
duration: About 2 hours
prerequisites: [truth-and-consequence]
theorems: [ℚ is dense in ℝ, The drinker paradox]
techniques: [let x be arbitrary, exhibiting a witness, negating quantifiers, proof by cases]
---

On 7 June 1742 the Prussian mathematician Christian Goldbach wrote to Leonhard Euler with a guess that is still unproved: *every even number greater than $2$ is the sum of two primes.* $4 = 2 + 2$, $28 = 5 + 23$, $100 = 3 + 97$. Computers have checked it past $4 \times 10^{18}$.

Look at the shape of the claim. It is not about one number but about *every* even number, and for each one it asserts that *there exist* two primes with a certain property. Almost every interesting mathematical statement has this kind of shape — layers of “for all” and “there exists” — and the order of the layers is where most of the difficulty (and most of the mistakes) live. The connectives of Chapter 1 are not enough to talk about it. We need **quantifiers**.

## For all, and there exists

A sentence with a variable, such as “$n$ is prime” or “$x^2 > 4$”, is not a statement: its truth depends on the variable. Such a sentence is called a **predicate**, written $P(n)$ or $Q(x)$. There are two ways to turn a predicate into a statement.

| Symbol | Read as | True when |
|---|---|---|
| $\forall x\, P(x)$ | for all $x$, $P(x)$ | $P(x)$ holds for every $x$ in the domain |
| $\exists x\, P(x)$ | there exists $x$ such that $P(x)$ | $P(x)$ holds for at least one $x$ in the domain |

The **domain** — the set $x$ ranges over — matters. $\exists x\,(x^2 = 2)$ is true for real numbers and false for rational ones (Chapter 3). We usually write the domain into the quantifier: $\forall n \in \mathbb{N}$, $\exists x \in \mathbb{R}$. Here $\mathbb{N} = \{0, 1, 2, \ldots\}$ are the natural numbers, $\mathbb{Z}$ the integers, $\mathbb{Q}$ the rationals and $\mathbb{R}$ the reals.

Goldbach's conjecture, fully quantified, is

$$\forall n \in \mathbb{N}\;\Big( (n > 2 \land n \text{ even}) \to \exists p\, \exists q\, \big(p \text{ prime} \land q \text{ prime} \land n = p + q\big)\Big).$$

Notice the $\to$ inside the $\forall$. “Every even number greater than 2 is …” means “for every $n$, *if* $n$ is even and greater than 2, *then* …”. This is the vacuous truth of Chapter 1 doing its job: odd numbers satisfy the conditional automatically.

:::tip
Translating English: “every $A$ is $B$” is $\forall x\,(A(x) \to B(x))$; “some $A$ is $B$” is $\exists x\,(A(x) \land B(x))$; “no $A$ is $B$” is $\forall x\,(A(x) \to \lnot B(x))$. A frequent mistake is to write $\exists x\,(A(x) \to B(x))$ for “some $A$ is $B$” — which is true as soon as anything at all fails to be an $A$.
:::

## The order matters

Compare two statements about real numbers:

$$\forall x\; \exists y:\; y > x^2 \qquad\text{and}\qquad \exists y\; \forall x:\; y > x^2 .$$

They use the same words. The first says that every number has *some* number above its square — true: take $y = x^2 + 1$. The second says that *one single* number lies above every square — false. In the first statement $y$ is chosen *after* $x$, so it may depend on $x$. In the second it must be chosen first, once and for all.

There is a vivid way to think about this. Read a quantified statement as a game between two players. The **Prover** wants to show the statement is true; the **Sceptic** wants to show it false. The quantifiers are moves, taken from left to right: at each $\exists$ the Prover chooses a value, at each $\forall$ the Sceptic does. When all the variables have values, the Prover wins if the final condition holds.

:::key
A statement is true exactly when the Prover has a **winning strategy** — a rule for choosing each $\exists$-value, given the moves so far, that wins however the Sceptic plays.
:::

Play both sides below. When you are the Prover of a true statement you should be able to win every time; when you are the Sceptic of a false one, likewise. Try being the Prover of a *false* statement and see what the Sceptic does to you.

::quantifier-game

This game view, developed by the Finnish logician Jaakko Hintikka, is more than a metaphor.:cite[hintikka] It is exactly how to *read* definitions such as the limit of a sequence (the third statement in the game), and — as we are about to see — it is exactly how to *write* proofs of them.

```quiz
q: 'Let $L(x, y)$ mean “$x$ loves $y$”. Which statement says that **someone is loved by everybody**?'
options:
  - text: '$\forall x\, \exists y\; L(x, y)$'
    why: Everybody loves somebody — possibly a different somebody for each person.
  - text: '$\exists y\, \forall x\; L(x, y)$'
    correct: true
    why: There is one $y$ (chosen first) such that every $x$ loves $y$.
  - text: '$\exists x\, \forall y\; L(x, y)$'
    why: Somebody loves everybody.
  - text: '$\forall y\, \exists x\; L(x, y)$'
    why: Everybody is loved by somebody.
```

## Negating a statement

To disprove a statement you prove its negation, so you need to be able to negate anything, mechanically. The Sceptic's view makes the rules obvious. “Not every $x$ has property $P$” means some $x$ fails it; “there is no $x$ with $P$” means every $x$ fails it:

$$\lnot\, \forall x\, P(x) \;\equiv\; \exists x\, \lnot P(x), \qquad \lnot\, \exists x\, P(x) \;\equiv\; \forall x\, \lnot P(x).$$

So a negation passes through quantifiers by flipping each one — the two players swap roles — until it reaches the inside, where the rules of Chapter 1 take over. For example, a function $f$ is **bounded** if

$$\exists M\; \forall x:\; |f(x)| \le M .$$

Pushing a negation through step by step gives what it means to be unbounded:

$$\lnot\, \exists M\, \forall x\; |f(x)| \le M \;\equiv\; \forall M\, \lnot\, \forall x\; |f(x)| \le M \;\equiv\; \forall M\, \exists x\; |f(x)| > M .$$

However large a bound $M$ you name, some $x$ beats it.

```blanks
title: Negate it
prompt: Choose the quantifier in each blank so that the right-hand side is the negation of the left.
text: |
  1. $\lnot\,\big(\forall n\; \exists p > n:\ p \text{ prime}\big) \iff$ [[a]] $n$ [[b]] $p > n$: $p$ is not prime.

  2. $\lnot\,\big(\forall \varepsilon > 0\; \exists N\; \forall n \ge N:\ |a_n| < \varepsilon\big) \iff$ [[c]] $\varepsilon > 0$ [[d]] $N$ [[e]] $n \ge N$: $|a_n| \ge \varepsilon$.
blanks:
  a: { answer: 1, options: ['∀', '∃'] }
  b: { answer: 0, options: ['∀', '∃'] }
  c: { answer: 1, options: ['∀', '∃'] }
  d: { answer: 0, options: ['∀', '∃'] }
  e: { answer: 1, options: ['∀', '∃'] }
explain: 'Every quantifier flips, and the condition at the end is negated: $<$ becomes $\ge$. The first negation says there is a largest prime (false, Chapter 4); the second says the sequence $a_n$ does *not* tend to $0$ (Chapter 13).'
```

## How quantifiers shape a proof

The game tells you how to write proofs. To prove $\forall x\, P(x)$, you must be ready for *any* move the Sceptic makes, so you begin: **“Let $x$ be arbitrary”** — a name for a value you do not get to choose — and prove $P(x)$ using nothing about $x$ except what the domain guarantees. To prove $\exists x\, P(x)$, you make a move: exhibit a **witness** and check that it works.

| To prove… | you… | To use a known… | you… |
|---|---|---|---|
| $\forall x\, P(x)$ | say “let $x$ be arbitrary” and prove $P(x)$ | $\forall x\, P(x)$ | apply it to any $x$ you like |
| $\exists x\, P(x)$ | name a specific $x$ (it may depend on earlier variables) and prove $P(x)$ | $\exists x\, P(x)$ | say “let $x_0$ be such that $P(x_0)$”, using a **new** name |

The last cell hides a trap that the next exercise exploits. When you know that *something* exists, you must give it a fresh name and assume nothing else about it.

```bug
title: The largest integer
prompt: 'This argument concludes that there is an integer larger than every integer. Where does it go wrong?'
lines:
  - For every integer $n$, the integer $n + 1$ is larger than $n$.
  - So for every integer $n$ there is an integer $m$ with $m > n$.
  - Let $m$ be such an integer.
  - Then $m > n$ for every integer $n$.
  - So there is an integer larger than every integer.
wrong: 3
why: |
  In line 3 the integer $m$ was chosen for **one particular** $n$ — it depends on $n$. Line 4 treats it as if it worked for every $n$ at once. The argument has silently turned $\forall n\, \exists m$ into $\exists m\, \forall n$: the Sceptic's move and the Prover's move have been swapped.
notes:
  '2': 'Fine in itself — as long as we remember that $m$ was chosen for a given $n$.'
```

## A fraction in every gap

Here is our first real theorem with quantifiers in it. Between any two different real numbers, however close, there is a rational number. Mathematicians say that $\mathbb{Q}$ is **dense** in $\mathbb{R}$.

:::theorem{name="Density of the rationals"}
For all real numbers $a < b$ there exists a rational number $q$ with $a < q < b$.
:::

The shape is $\forall a\, \forall b\, \big(a < b \to \exists q \in \mathbb{Q}: a < q < b\big)$, so the proof will begin “let $a < b$ be arbitrary” and then *construct* $q$. We need one fact about the real numbers, known since Archimedes.

:::lemma{name="The Archimedean property"}
For every real number $x$ there is a natural number $n$ with $n > x$.
:::

It says that the natural numbers are not bounded above — there are no “infinitely large” reals. We will prove it from the completeness of $\mathbb{R}$ in Chapter 14; for now take it as known. Before reading the proof, play with the picture: it *is* the proof.

::density-zoom

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Choose $n$ so large that the steps $1/n$ are smaller than the gap $b - a$. Walk along the fractions $\frac{0}{n}, \frac{1}{n}, \frac{2}{n}, \ldots$: the first one to pass $a$ can't jump over the whole gap, so it lands inside.
:::
:::level[Proof]
Let $a < b$ be arbitrary real numbers. Since $b - a > 0$, the Archimedean property gives a natural number $n > \frac{1}{b-a}$, so that $n \ge 1$ and $\frac1n < b - a$.

Let $m = \lfloor na \rfloor + 1$, the smallest integer greater than $na$. Then $m > na$, so $\frac mn > a$. And since $m - 1 = \lfloor na \rfloor \le na$,
$$\frac mn = \frac{m-1}{n} + \frac1n \le a + \frac1n < a + (b - a) = b .$$
So $q = \frac mn$ is rational and $a < q < b$.
:::
::::

Look at the order of choices: $a$ and $b$ first (the Sceptic's moves), then $n$, which depends on $b - a$, then $m$, which depends on $n$ and $a$. The proof is a winning strategy for the Prover, written out.

```step
title: The key inequality
prompt: 'Check the chain of inequalities at the heart of the proof. You may use the assumptions $m - 1 \le na$, $\frac1n < b - a$ and $n \ge 1$ (the checker tests your steps on values satisfying them).'
assume: ['m - 1 <= n a', '1/n < b - a']
domains: { n: posint, m: int }
start: m/n
target: b
relation: '<'
initial: m/n
hints:
  - 'Write $\frac mn$ as $\frac{m-1}{n} + \frac1n$.'
  - 'Use $m - 1 \le na$ to bound the first term by $a$.'
solution: '$\frac mn = \frac{m-1}{n} + \frac1n \le a + \frac1n < a + (b - a) = b$.'
```

:::exercises
**Irrationals are dense too.** Assuming that $\sqrt2$ is irrational (Chapter 3), prove that between any two real numbers $a < b$ there is an irrational number. *Hint:* apply the theorem to $\frac{a}{\sqrt2}$ and $\frac{b}{\sqrt2}$, and check that $q\sqrt2$ is irrational whenever $q$ is a non-zero rational. What if the rational you get is $0$?
:::

:::history{year=1879 title="Inventing the quantifier" people="Aristotle, Gottlob Frege, Charles S. Peirce, Giuseppe Peano, Gerhard Gentzen"}
Aristotle's logic of *all* and *some* dominated for two thousand years, but it could not handle nested quantifiers such as “every number has a larger prime”. In 1879 Gottlob Frege's *Begriffsschrift* (“concept script”) introduced quantifiers that can be nested to any depth, and with them modern logic.:cite[frege1879] Charles Peirce and his student Oscar Mitchell found the same idea independently a few years later. The symbols came later still: $\exists$ is Giuseppe Peano's (1897), and $\forall$, an upside-down A for *alle*, is Gerhard Gentzen's (1935).
:::

:::bio{name="Gottlob Frege" born=1848 died=1925 place="Wismar and Jena"}
Frege spent his career at the University of Jena, largely ignored, trying to show that arithmetic is pure logic. His two-dimensional notation was so hard to typeset that few people read it. In 1902, as the second volume of his *Basic Laws of Arithmetic* was going to press, he received a letter from the young Bertrand Russell pointing out a contradiction at the heart of his system. Frege added an appendix beginning: “Hardly anything more unfortunate can befall a scientific writer than to have one of the foundations of his edifice shaken after the work is finished.” We will read Russell's letter in Chapter 12.
:::

## Existence without a witness

Proofs of existence do not always name the object. Here is a famous example, popularised by Raymond Smullyan.:cite[smullyan1978]

:::theorem{name="The drinker paradox"}
In any non-empty pub, there is someone such that, *if they are drinking, then everyone in the pub is drinking.*
:::

It sounds absurd — surely one person's drinking cannot force everyone's? But look at the logic: $\exists x\,\big(D(x) \to \forall y\; D(y)\big)$.

:::proof
There are two cases. If everyone in the pub is drinking, pick anyone at all: the conclusion “everyone is drinking” is true, so the conditional is true. Otherwise, someone is not drinking; pick that person. For them the hypothesis “they are drinking” is false, so the conditional is vacuously true. Either way the required person exists. (The pub must be non-empty so that there is someone to pick in the first case.)
:::

The proof splits into cases according to a statement we cannot decide — we do not know which case holds — so it does not tell us *who* the person is. This is a **non-constructive** existence proof. We will meet much more striking ones, such as Cantor's proof in 1874 that transcendental numbers exist (Chapter 11), which appeared before anyone could exhibit a single one without great effort.

## Exactly one

“There is exactly one $x$ with $P(x)$”, written $\exists!\, x\, P(x)$, is two statements: *existence* ($\exists x\, P(x)$) and *uniqueness* (if $P(x)$ and $P(y)$, then $x = y$). Uniqueness proofs have a standard opening: *suppose there are two, and show they are equal.*

:::proposition
Addition of real numbers has exactly one identity element: a number $e$ with $e + x = x$ for every $x$.
:::

:::proof
Existence: $0$ works. Uniqueness: suppose $e$ and $e'$ both have the property. Applying the property of $e$ with $x = e'$ gives $e + e' = e'$; applying the property of $e'$ with $x = e$ gives $e' + e = e$. Since $e + e' = e' + e$, we get $e = e'$.
:::

## Exercises

```parsons
title: Rebuild the density proof
prompt: Put the proof that there is a rational between any two reals $a < b$ in order. One line is a trap.
lines:
  - Let $a < b$ be arbitrary real numbers.
  - By the Archimedean property, choose a natural number $n > 1/(b - a)$, so that $1/n < b - a$.
  - Let $m = \lfloor na \rfloor + 1$; then $m > na$, so $m/n > a$.
  - 'Also $m - 1 \le na$, so $m/n \le a + 1/n < b$.'
  - Hence $m/n$ is a rational number strictly between $a$ and $b$.
distractors:
  - Choose a rational number $q$ with $a < q < b$.
explain: The trap line assumes what we are trying to prove. A proof of an existence statement must *construct* (or otherwise establish) the object — it cannot simply choose it.
```

```prove
title: A preview of ε–δ
prompt: |
  Prove that for every $\varepsilon > 0$ there exists $\delta > 0$ such that $2\delta + \delta^2 < \varepsilon$.

  *(Statements like this are the daily bread of calculus, Chapter 13. Think about the order of the moves: the Sceptic picks $\varepsilon$ first.)*
hints:
  - Your $\delta$ is allowed to depend on $\varepsilon$. Try some small values of $\varepsilon$ first.
  - 'If $\delta \le 1$ then $\delta^2 \le \delta$, so $2\delta + \delta^2 \le 3\delta$.'
  - 'Try $\delta = \min\left(1, \frac{\varepsilon}{4}\right)$.'
rubric:
  - 'You began with “let $\varepsilon > 0$ be arbitrary” (or equivalent).'
  - You defined $\delta$ explicitly in terms of $\varepsilon$ and checked $\delta > 0$.
  - 'You proved $2\delta + \delta^2 < \varepsilon$, including why $\delta^2 \le \delta$ (or another bound on the square).'
solution: |
  Let $\varepsilon > 0$ be arbitrary, and put $\delta = \min\left(1, \frac{\varepsilon}{4}\right)$. Then $\delta > 0$. Since $0 < \delta \le 1$, we have $\delta^2 \le \delta$, so
  $$2\delta + \delta^2 \le 3\delta \le \frac{3\varepsilon}{4} < \varepsilon .$$
tutor: The proof must fix epsilon first, then choose delta as a function of epsilon (e.g. min(1, ε/4) or min(1, ε/3.1)); a common error is delta = ε/3 without controlling δ² (fails for large ε), or choosing δ before ε.
```

```quiz
q: 'Which statement is **true** for real numbers?'
options:
  - text: '$\exists x\, \forall y:\; x + y = 0$'
    why: 'That would need one $x$ with $x = -y$ for every $y$ at once.'
  - text: '$\forall y\, \exists x:\; x + y = 0$'
    correct: true
    why: 'Given $y$, the Prover answers $x = -y$.'
  - text: '$\exists x\, \forall y:\; xy = y$ and $x \ne 1$'
    why: 'Taking $y = 1$ forces $x = 1$.'
```

:::challenge
**Uniformly or not?** A function $f$ is *continuous at every point* if $\forall a\; \forall \varepsilon > 0\; \exists \delta > 0\; \forall x\,\big(|x - a| < \delta \to |f(x) - f(a)| < \varepsilon\big)$. It is **uniformly continuous** if $\forall \varepsilon > 0\; \exists \delta > 0\; \forall a\; \forall x\,(\ldots)$ — the same condition, with $\exists \delta$ moved in front of $\forall a$. Which statement is stronger? For $f(x) = x^2$ on all of $\mathbb{R}$, play the game: who wins each version? (Augustin-Louis Cauchy's influential 1821 textbook contained a “theorem” whose error was exactly a confusion between two quantifier orders like these; we will meet it in Chapter 18.)
:::

## Further reading

- Daniel Velleman, *How to Prove It* — the best textbook on turning quantifiers into proof strategies.:cite[velleman]
- Jaakko Hintikka, *The Principles of Mathematics Revisited* — the game semantics of quantifiers, from its inventor.:cite[hintikka]
