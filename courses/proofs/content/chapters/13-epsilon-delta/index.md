---
number: 13
title: The ε–δ revolution
summary: For a century and a half calculus worked brilliantly without anyone being able to say what it was about. Berkeley mocked its ghosts; Cauchy and Weierstrass exorcised them with ε and δ. Limits as a game, the algebra of limits, why 0.999… = 1, and continuity.
duration: About 3 hours
prerequisites: [for-all-there-exists]
theorems: [1/n → 0, 0.999… = 1, Limits are unique, The limit of a sum is the sum of the limits, x² is continuous]
techniques: [ε–N proofs, working backwards, the ε/2 trick, bounding]
---

In 1734 George Berkeley, Bishop of Cloyne, published a pamphlet called *The Analyst*, addressed to “an infidel mathematician” (probably Newton's friend Edmond Halley). If mathematicians sneered at the mysteries of religion, Berkeley asked, what about their own? Calculus computes a derivative by dividing a tiny change in $y$ by a tiny change in $x$ — and then setting the tiny change to zero. It is treated as non-zero when convenient and as zero when convenient. What, he asked, are these vanishing increments? “May we not call them the ghosts of departed quantities?”:cite[berkeley1734]

He had a point. Newton and Leibniz had invented calculus in the 1660s–80s, and by 1734 it had already transformed physics and astronomy. It gave the right answers. But nobody could say precisely what a derivative *was*, and occasionally it gave wrong answers too (Chapter 18 has examples). It took another century, and the work of Cauchy, Bolzano and above all Karl Weierstrass, to put calculus on solid ground. The key was a single definition — of a limit — built from the quantifiers of Chapter 2.

## What a limit is

Take the sequence $1, \frac12, \frac13, \frac14, \ldots$ It “tends to $0$”. But what does that mean? Not that some term *equals* $0$ — none does. Not that the terms get closer to $0$ — they also get closer to $-1$. The idea is that the terms get *as close as you like* to $0$, and *stay* that close. Weierstrass turned “as close as you like” into a challenge from a sceptic.

:::definition
A sequence $(a_n)$ **converges to** $L$, written $a_n \to L$ or $\lim_{n \to \infty} a_n = L$, if
$$\forall \varepsilon > 0 \;\; \exists N \;\; \forall n \ge N: \quad |a_n - L| < \varepsilon .$$
:::

Read it as the game of Chapter 2. The Sceptic names a tolerance $\varepsilon$, however small. The Prover must name a point $N$ in the sequence after which *every* term is within $\varepsilon$ of $L$. The Prover's $N$ may depend on $\varepsilon$ — smaller tolerances need later starting points. The sequence converges if the Prover has a winning strategy: a rule producing a good $N$ from any $\varepsilon$.

::epsilon-n

The widget can only check finitely many terms. A *proof* checks them all.

:::theorem
$\displaystyle \lim_{n\to\infty} \frac1n = 0 .$
:::

:::proof
Let $\varepsilon > 0$. By the Archimedean property (Chapter 2) there is a natural number $N > \frac1\varepsilon$. Then for every $n \ge N$,
$$\left|\frac1n - 0\right| = \frac1n \le \frac1N < \varepsilon .$$
:::

Every ε–N proof has this shape: *let $\varepsilon > 0$; choose $N$ = (something depending on $\varepsilon$); let $n \ge N$; then (a chain of inequalities ending in $< \varepsilon$).* The hard part is the choice of $N$, and it is found by working **backwards**, in scratch work that does not appear in the final proof.

## Finding N: working backwards

Let us prove that $\frac{3n + 1}{n + 2} \to 3$. Scratch work first: we want $\left|\frac{3n+1}{n+2} - 3\right| < \varepsilon$. Simplify the left side.

```step
title: Scratch work
prompt: 'Simplify $\frac{3n+1}{n+2} - 3$.'
start: (3n + 1)/(n + 2) - 3
target: -5/(n + 2)
relation: '='
initial: (3n + 1)/(n + 2) - 3
domains: { n: posint }
hints:
  - 'Write $3 = \frac{3(n+2)}{n+2}$.'
solution: '$\frac{3n+1 - 3(n+2)}{n+2} = \frac{-5}{n+2}$.'
```

So we need $\frac{5}{n+2} < \varepsilon$. It is enough that $\frac5n < \varepsilon$, i.e. $n > \frac5\varepsilon$. Throwing away the $+2$ made the inequality weaker but simpler — a typical move. Now write the proof *forwards*, as if $N$ had been obvious all along:

:::proof[Proof that (3n + 1)/(n + 2) → 3]
Let $\varepsilon > 0$ and choose a natural number $N > \frac5\varepsilon$. For $n \ge N$,
$$\left|\frac{3n+1}{n+2} - 3\right| = \frac5{n+2} < \frac5n \le \frac5N < \varepsilon .$$
:::

:::key
In an ε–N proof you may make $|a_n - L|$ **bigger** as often as you like, as long as what you end with is less than $\varepsilon$. Crude bounds are fine: you are looking for *some* $N$ that works, not the smallest.
:::

## 0.999… = 1

What does an infinite decimal mean? $0.999\ldots$ is the limit of the sequence $0.9,\ 0.99,\ 0.999, \ldots$, whose $n$th term is $1 - 10^{-n}$.

:::theorem
$0.999\ldots = 1$.
:::

:::proof
We show $1 - 10^{-n} \to 1$. Let $\varepsilon > 0$; choose $N > \frac1\varepsilon$. For $n \ge N$, $|(1 - 10^{-n}) - 1| = 10^{-n} < \frac1n \le \frac1N < \varepsilon$, using $10^n > n$ (a quick induction).
:::

Many people feel that $0.999\ldots$ “never quite gets to” $1$. But $0.999\ldots$ is not a process; it is the *number* the process approaches, and that number is $1$. The feeling is a leftover of infinitesimal thinking — the idea that there might be a number infinitely close to $1$ but not equal to it. In the real numbers there is no such thing (Chapter 14).

```quiz
q: 'Which argument that $0.999\ldots = 1$ is **not** valid as it stands?'
options:
  - text: 'Between two different real numbers there is another; there is no number between $0.999\ldots$ and $1$.'
    why: Valid, given the density of the reals (Chapter 2) and a proof that nothing lies between them.
  - text: 'Let $x = 0.999\ldots$. Then $10x = 9.999\ldots$, so $9x = 9$ and $x = 1$.'
    correct: true
    why: 'This manipulates an infinite decimal as if it were a number with known arithmetic — assuming that $x$ exists and that $10 \cdot 0.999\ldots = 9.999\ldots$. Those facts are true, but they need the limit definition to justify them. (The same trick “proves” $1 + 2 + 4 + 8 + \cdots = -1$: with $x = 1 + 2 + 4 + \cdots$, we get $2x = x - 1$.)'
  - text: 'The sequence $0.9, 0.99, 0.999, \ldots$ converges to $1$ by the ε–N definition.'
    why: That is the proof above, and it is the definition of what $0.999\ldots$ means.
```

## A limit is unique

Can a sequence converge to two different numbers? Intuition says no; the definition must say no too, or it is a bad definition.

:::theorem
If $a_n \to L$ and $a_n \to M$, then $L = M$.
:::

:::proof
Suppose $L \ne M$ and let $\varepsilon = \frac{|L - M|}{2} > 0$. There is $N_1$ with $|a_n - L| < \varepsilon$ for $n \ge N_1$, and $N_2$ with $|a_n - M| < \varepsilon$ for $n \ge N_2$. Take $n = \max(N_1, N_2)$. By the **triangle inequality** $|x + y| \le |x| + |y|$,
$$|L - M| = |(L - a_n) + (a_n - M)| \le |a_n - L| + |a_n - M| < 2\varepsilon = |L - M|,$$
a contradiction.
:::

Two techniques to notice. We chose $\varepsilon$ *ourselves* — when we *use* a convergence hypothesis we play the Sceptic and may pick any $\varepsilon$ that helps. And we took the maximum of two $N$'s to satisfy two conditions at once.

## The algebra of limits

We would like to compute limits by breaking them into pieces: if $a_n \to A$ and $b_n \to B$, then surely $a_n + b_n \to A + B$. Here is the proof, featuring the most famous trick in analysis.

:::theorem{name="Sum of limits"}
If $a_n \to A$ and $b_n \to B$, then $a_n + b_n \to A + B$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
The error of the sum is at most the sum of the errors. So make each error less than $\frac\varepsilon2$ — the hypotheses let us ask for any tolerance we like — and add.
:::
:::level[Proof]
Let $\varepsilon > 0$. Since $a_n \to A$, applied with tolerance $\frac\varepsilon2$, there is $N_1$ with $|a_n - A| < \frac\varepsilon2$ for all $n \ge N_1$. Likewise there is $N_2$ with $|b_n - B| < \frac\varepsilon2$ for all $n \ge N_2$. Let $N = \max(N_1, N_2)$. For $n \ge N$,
$$|(a_n + b_n) - (A + B)| \le |a_n - A| + |b_n - B| < \frac\varepsilon2 + \frac\varepsilon2 = \varepsilon .$$
:::
::::

The “$\frac\varepsilon2$ trick” looks like cheating the first time: we *knew* we would add two errors, so we asked for half the tolerance each. That is exactly the point. Because the hypotheses hold for *every* tolerance, we can spend our error budget however we like. In more complicated proofs you will see $\frac\varepsilon3$, $\frac{\varepsilon}{2|B| + 1}$, and stranger things — always chosen, in scratch work, so that the final line comes out as $< \varepsilon$.

Products need one more idea: a convergent sequence is **bounded**.

:::lemma
If $a_n \to A$, then there is $K$ with $|a_n| \le K$ for all $n$.
:::

:::proof
Take $\varepsilon = 1$: for $n \ge N$, $|a_n| \le |a_n - A| + |A| < 1 + |A|$. Only the finitely many terms before $N$ remain, so $K = \max(|a_1|, \ldots, |a_{N-1}|, 1 + |A|)$ works.
:::

:::theorem{name="Product of limits"}
If $a_n \to A$ and $b_n \to B$, then $a_n b_n \to AB$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Add and subtract a cross term: $a_n b_n - AB = a_n(b_n - B) + B(a_n - A)$. The first term is small because $a_n$ is bounded and $b_n - B$ is small; the second because $B$ is fixed and $a_n - A$ is small.
:::
:::level[Proof]
Let $K > 0$ bound $|a_n|$ (lemma). Let $\varepsilon > 0$. Choose $N_1$ with $|b_n - B| < \frac{\varepsilon}{2K}$ for $n \ge N_1$, and $N_2$ with $|a_n - A| < \frac{\varepsilon}{2(|B| + 1)}$ for $n \ge N_2$. For $n \ge \max(N_1, N_2)$:
$$|a_nb_n - AB| = |a_n(b_n - B) + B(a_n - A)| \le K \cdot \frac{\varepsilon}{2K} + |B| \cdot \frac{\varepsilon}{2(|B|+1)} < \frac\varepsilon2 + \frac\varepsilon2 = \varepsilon .$$
(The $+1$ in $|B| + 1$ avoids dividing by zero when $B = 0$.)
:::
::::

```step
title: The cross term
prompt: 'Check the identity behind the product rule: $a b - A B = a(b - B) + B(a - A)$.'
start: a b - A B
target: a (b - B) + B (a - A)
relation: '='
initial: a b - A B
solution: '$a(b - B) + B(a - A) = ab - aB + aB - AB = ab - AB$.'
```

```bug
title: A product rule too good to be true
prompt: 'Here is a short “proof” that $a_nb_n \to AB$ when $a_n \to A$ and $b_n \to B$. Which line is false?'
lines:
  - Let $\varepsilon > 0$, and assume $\varepsilon < 1$ (smaller tolerances are harder, so this loses nothing).
  - Choose $N$ so that $|a_n - A| < \varepsilon$ and $|b_n - B| < \varepsilon$ for all $n \ge N$.
  - Then for $n \ge N$, $|a_nb_n - AB| \le |a_n - A|\,|b_n - B|$.
  - So $|a_nb_n - AB| < \varepsilon^2 < \varepsilon$.
wrong: 2
why: |
  The inequality $|ab - AB| \le |a - A|\,|b - B|$ is false: take $a = 1$, $A = 0$, $b = B = 5$; the left side is $5$, the right side $0$. The error of a product involves the *sizes* of the factors, not just their errors — which is why the real proof splits $ab - AB = a(b - B) + B(a - A)$ and needs the boundedness lemma.
notes:
  '0': 'Fine: if a smaller $\varepsilon$ can be achieved, so can a larger one.'
```

## Continuity

The same idea defines continuity. Intuitively, $f$ is continuous at $a$ if $f(x)$ is close to $f(a)$ whenever $x$ is close to $a$. Precisely:

:::definition
A function $f$ is **continuous at $a$** if
$$\forall \varepsilon > 0 \;\; \exists \delta > 0 \;\; \forall x: \quad |x - a| < \delta \;\to\; |f(x) - f(a)| < \varepsilon .$$
It is **continuous** if it is continuous at every point of its domain.
:::

The Sceptic draws a horizontal band around $f(a)$; the Prover must find a vertical strip around $a$ in which the graph stays inside the band. Try the functions below. For the continuous ones, the Prover's strategy button gives a δ that works for *every* ε; for the others, see why nothing works once ε is small.

::epsilon-delta

:::theorem
The function $f(x) = x^2$ is continuous at every real number $a$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
$|x^2 - a^2| = |x - a|\,|x + a|$. The first factor is what we control. The second is not small, but if we keep $x$ within $1$ of $a$ it is at most $2|a| + 1$. So take $\delta$ to be the smaller of $1$ and $\frac{\varepsilon}{2|a| + 1}$.
:::
:::level[Proof]
Let $a \in \mathbb{R}$ and $\varepsilon > 0$. Put $\delta = \min\left(1, \frac{\varepsilon}{2|a| + 1}\right) > 0$. Let $|x - a| < \delta$. Then $|x - a| < 1$, so $|x + a| = |(x - a) + 2a| \le |x - a| + 2|a| < 1 + 2|a|$. Hence
$$|x^2 - a^2| = |x - a|\,|x + a| < \delta\,(2|a| + 1) \le \varepsilon .$$
:::
::::

The choice “$\delta = \min(1, \ldots)$” is another standard trick: first restrict $x$ to a bounded region, so that awkward factors are under control, then shrink δ further to handle the rest.

:::bio{name="Karl Weierstrass" born=1815 died=1897 place="Ostenfelde, Braunsberg and Berlin"}
Weierstrass's father wanted him to be a civil servant, and sent him to study law and finance at Bonn; he spent four years fencing and drinking and left without a degree. He then trained as a teacher and spent fifteen years teaching mathematics, handwriting and gymnastics at secondary schools in small Prussian towns, doing research at night. In 1854 a paper on Abelian functions, sent from the provinces, made him famous overnight. In Berlin, from 1856, his lectures set out analysis with the ε–δ rigour of this chapter, and a generation of students — among them Sofia Kovalevskaya, Georg Cantor and Hermann Schwarz — carried it everywhere. He published little; his influence came through his teaching. He is often called the father of modern analysis.
:::

:::history{year=1821 title="From fluxions to limits" people="Isaac Newton, Gottfried Leibniz, Augustin-Louis Cauchy, Bernard Bolzano, Karl Weierstrass"}
Newton's “fluxions” and Leibniz's “differentials” were competing (and bitterly disputed) versions of the same calculus. Both relied on infinitely small quantities, which neither could define. In his *Cours d'analyse* of 1821 Augustin-Louis Cauchy made limits the foundation: a variable quantity has a limit if it “approaches it indefinitely, so as to end by differing from it by as little as one wishes”.:cite[grabiner] That is almost the modern definition — but not quite, and the missing precision caused errors (Chapter 18). Bernard Bolzano in Prague had similar ideas in 1817, largely unread. Weierstrass's lectures in Berlin in the 1850s and 1860s finally replaced “approaches indefinitely” with the quantifiers $\forall \varepsilon\, \exists \delta$, removing motion and time from the definition altogether.
:::

## Exercises

```prove
title: A limit from scratch
prompt: 'Prove from the definition that $\dfrac{n^2 + 1}{2n^2} \to \dfrac12$.'
hints:
  - 'Scratch work: $\frac{n^2+1}{2n^2} - \frac12 = \frac{1}{2n^2}$.'
  - '$\frac{1}{2n^2} \le \frac1n$ for $n \ge 1$. So $N > \frac1\varepsilon$ is plenty.'
rubric:
  - 'You began with “let $\varepsilon > 0$” and gave an explicit $N$ depending on $\varepsilon$.'
  - 'You computed $\left|\frac{n^2+1}{2n^2} - \frac12\right| = \frac{1}{2n^2}$.'
  - 'You gave a chain of inequalities for $n \ge N$ ending in $< \varepsilon$.'
solution: |
  Let $\varepsilon > 0$ and choose a natural number $N > \frac1\varepsilon$. For $n \ge N$,
  $$\left|\frac{n^2 + 1}{2n^2} - \frac12\right| = \frac{1}{2n^2} \le \frac1n \le \frac1N < \varepsilon .$$
tutor: The learner needs an explicit N as a function of epsilon and a forward chain of inequalities; scratch work alone (solving for n) is not a proof.
```

```step
title: A crude bound
prompt: 'For $n \ge 1$, show $\frac{5}{n+2} < \frac5n$ — the step that threw away the $+2$.'
domains: { n: posint }
start: 5/(n + 2)
target: 5/n
relation: '<'
initial: 5/(n + 2)
solution: '$\frac{5}{n+2} < \frac5n$ because $n + 2 > n > 0$.'
```

:::challenge
**Squeeze.** Prove the *squeeze theorem*: if $a_n \le b_n \le c_n$ for all $n$, and $a_n \to L$ and $c_n \to L$, then $b_n \to L$. Use it to show $\frac{\sin n}{n} \to 0$. Then prove that if $a_n \to L$ and $L \ne 0$, then eventually $a_n \ne 0$ and $\frac{1}{a_n} \to \frac1L$. (Hint for the last: first show $|a_n| > \frac{|L|}{2}$ for large $n$.)
:::

## Further reading

- Judith Grabiner, *The Origins of Cauchy's Rigorous Calculus* — how the ε–δ ideas emerged from eighteenth-century algebra.:cite[grabiner]
- Stephen Abbott, *Understanding Analysis* — a modern, readable first course in analysis built on exactly these definitions.:cite[abbott]
