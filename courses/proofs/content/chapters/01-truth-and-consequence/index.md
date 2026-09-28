---
number: 1
title: Truth and consequence
summary: Connectives and truth tables, what “implies” really means, the contrapositive, and a theorem about logic itself — that a single connective is enough to say everything.
duration: About 2 hours
prerequisites: [what-is-a-proof]
theorems: [Every truth table has a formula, NAND is functionally complete]
techniques: [truth tables, contrapositive, proof by construction, proof by cases]
---

Proofs are made of statements joined by a handful of small words: *and*, *or*, *not*, *if … then*, *if and only if*. Everyday language uses these words loosely. Mathematics cannot afford to. This chapter pins down exactly what they mean, shows how each one dictates the *shape* of a proof, and ends with a theorem about logic itself.

Start with a puzzle that most people get wrong.

::wason-cards

In the original experiment, run by the psychologist Peter Wason in 1966, only about one person in ten chose correctly.:cite[wason1966] The difficulty is not the cards. It is the word *if*. People read “if vowel, then even” as if it also said “if even, then vowel” — they read the rule together with its **converse**. By the end of this chapter the correct answer will look obvious.

## Statements and connectives

A **statement** (or *proposition*) is a sentence that is either true or false: “$7$ is prime”, “$2 + 2 = 5$”, “every even number greater than $2$ is the sum of two primes” (nobody knows which, but it is one or the other). “Close the door” and “$x > 3$” are not statements; the second becomes one once we know what $x$ is.

From simple statements we build compound ones with **connectives**. Writing $P$ and $Q$ for statements:

| Symbol | Read as | True when |
|---|---|---|
| $\lnot P$ | not $P$ | $P$ is false |
| $P \land Q$ | $P$ and $Q$ | both are true |
| $P \lor Q$ | $P$ or $Q$ | at least one is true |
| $P \to Q$ | if $P$ then $Q$; $P$ implies $Q$ | $P$ is false, or $Q$ is true |
| $P \leftrightarrow Q$ | $P$ if and only if $Q$ | both have the same truth value |

Two conventions differ from everyday English. Mathematical *or* is **inclusive**: “$n$ is even or $n$ is prime” is true for $n = 2$. And *if … then* is defined entirely by the truth values of its parts, which leads to some surprises.

## What “implies” means

The statement $P \to Q$ makes a promise: *whenever $P$ is true, $Q$ is true too*. It is broken in exactly one situation — $P$ true and $Q$ false. In every other situation the promise has been kept, so $P \to Q$ counts as true.

| $P$ | $Q$ | $P \to Q$ |
|---|---|---|
| T | T | T |
| T | F | **F** |
| F | T | T |
| F | F | T |

The last two rows trouble people. Is “if $2 + 2 = 5$, then the Moon is made of cheese” really *true*? Think of a promise: “if it rains tomorrow, I will bring you an umbrella.” If it doesn't rain, I haven't broken my promise, whatever I do. A conditional with a false hypothesis is called **vacuously true**.

This is not a quibble. Mathematicians use conditionals inside statements about *all* objects: “for every integer $n$, if $n$ is divisible by $4$ then $n$ is even.” For $n = 3$ the hypothesis is false, and we certainly don't want $n = 3$ to be a counterexample. The truth table above is the only choice that makes such statements work.

:::history{year="c. 300 BC" title="The crows on the rooftops" people="Philo of Megara, Diodorus Cronus, Chrysippus"}
The Stoic logicians of ancient Greece argued about conditionals so fiercely that the poet Callimachus joked that “even the crows on the rooftops are cawing about which conditionals are true.” Philo of Megara proposed exactly the truth table above: a conditional is false only when it leads from truth to falsehood. His teacher Diodorus disagreed. Philo's definition, rediscovered twenty-two centuries later, is the one mathematics uses.:cite[kneale]
:::

The Wason puzzle now becomes easy. The rule “vowel $\to$ even” is broken only by a card with a vowel and an odd number. So you must turn the $E$ (it might have an odd number behind it) and the $7$ (it might have a vowel behind it). The $4$ cannot break the rule whatever is behind it — believing it can is exactly the mistake of reading the rule as “even $\to$ vowel”.

```quiz
q: 'Which of these is **false**?'
options:
  - text: 'If $1 = 2$, then $3$ is even.'
    why: The hypothesis is false, so the conditional is (vacuously) true.
  - text: 'If $4$ is even, then $2 + 2 = 4$.'
    why: True hypothesis, true conclusion.
  - text: 'If $5$ is prime, then $5$ is even.'
    correct: true
    why: True hypothesis, false conclusion — the only way a conditional can fail.
  - text: 'If $5$ is even, then $5$ is prime.'
    why: False hypothesis, so true.
```

## The contrapositive, the converse and the inverse

From a conditional $P \to Q$ we can form three relatives:

- the **converse** $Q \to P$,
- the **inverse** $\lnot P \to \lnot Q$,
- the **contrapositive** $\lnot Q \to \lnot P$.

Which of them say the same thing as the original? Two statements are **logically equivalent** if they have the same truth value in every possible situation — that is, if their truth tables agree row by row. The lab below lets you check. It starts with $P \to Q$ and its contrapositive; try the converse too.

::truth-table-lab{f="p -> q" g="~q -> ~p"}

The contrapositive always agrees with the original. The converse and the inverse agree with *each other*, but not with the original: they differ from it when $P$ is false and $Q$ is true.

:::key
A conditional and its contrapositive are the same statement in disguise. To prove “if $P$ then $Q$”, you may prove “if not $Q$ then not $P$” instead — whichever is easier. The converse is a different statement altogether.
:::

Here is the contrapositive at work on a fact we will need in Chapter 3.

:::theorem
Let $n$ be an integer. If $n^2$ is even, then $n$ is even.
:::

A direct proof is awkward: from “$n^2 = 2m$” it is not clear how to get at $n$. The contrapositive — *if $n$ is odd, then $n^2$ is odd* — starts from something concrete.

```blanks
title: Proof by contrapositive
prompt: Fill in the blanks. (The step checker compares your expressions with the intended ones algebraically, so any equivalent form is accepted.)
text: |
  We prove the contrapositive: if $n$ is odd, then $n^2$ is odd. Suppose $n$ is odd. Then $n = 2k + 1$ for some integer $k$, so
  $n^2 = $ [[sq]] $= 2\,($ [[inner]] $) + 1$.
  Since [[inner2]] is an integer, $n^2$ is [[parity]]. This proves the contrapositive, and therefore the theorem.
blanks:
  sq: { answer: "(2k+1)^2" }
  inner: { answer: "2k^2 + 2k" }
  inner2: { answer: "2k^2 + 2k" }
  parity: { answer: 1, options: [even, odd] }
explain: The heart of the proof is the identity $(2k+1)^2 = 2(2k^2 + 2k) + 1$, which exhibits $n^2$ in the form “twice an integer, plus one”.
```

## Logical equivalence and algebra

Equivalences can be used like algebraic identities: replace a statement by an equivalent one anywhere it occurs. A few are used so often they have names.

| Name | Equivalence |
|---|---|
| Double negation | $\lnot\lnot P \equiv P$ |
| De Morgan's laws | $\lnot(P \land Q) \equiv \lnot P \lor \lnot Q$, and $\lnot(P \lor Q) \equiv \lnot P \land \lnot Q$ |
| Contrapositive | $P \to Q \equiv \lnot Q \to \lnot P$ |
| Implication as *or* | $P \to Q \equiv \lnot P \lor Q$ |
| Negating an implication | $\lnot(P \to Q) \equiv P \land \lnot Q$ |
| Distributivity | $P \land (Q \lor R) \equiv (P \land Q) \lor (P \land R)$ |
| Exportation | $(P \land Q) \to R \equiv P \to (Q \to R)$ |

The fifth line is worth memorising: to *disprove* “if $P$ then $Q$”, you must exhibit a case where $P$ holds and $Q$ fails. That is exactly what a counterexample is.

:::exercises
Use the lab above (clear box B, or type into it) to check each of these.
1. De Morgan's laws.
2. Is $(P \to Q) \to R$ equivalent to $P \to (Q \to R)$? If not, find a row where they differ.
3. **Peirce's law**, $((P \to Q) \to P) \to P$, is a tautology — true in every row — even though it doesn't look like one.
4. $P \lor \lnot P$ (the *law of excluded middle*) and $\lnot(P \land \lnot P)$ (the *law of non-contradiction*) are tautologies.
:::

## Valid arguments

An argument — premises, then a conclusion — is **valid** if the conclusion is true in every situation in which all the premises are true. Truth tables decide validity mechanically. Four patterns come up constantly:

| Form | Premises | Conclusion | |
|---|---|---|---|
| *Modus ponens* | $P \to Q$, $P$ | $Q$ | valid |
| *Modus tollens* | $P \to Q$, $\lnot Q$ | $\lnot P$ | valid |
| Affirming the consequent | $P \to Q$, $Q$ | $P$ | **invalid** |
| Denying the antecedent | $P \to Q$, $\lnot P$ | $\lnot Q$ | **invalid** |

The two invalid forms are the converse and the inverse in disguise, and they account for a large share of wrong proofs — including the one below.

```bug
title: A proof that proves the wrong thing
prompt: 'The claim is: *for every real number $x$, if $x^2 > 4$ then $x > 2$*. Here is a “proof”. Which line is the first mistake?'
lines:
  - We must show that if $x^2 > 4$, then $x > 2$.
  - Suppose $x > 2$.
  - Multiplying both sides by the positive number $x$ gives $x^2 > 2x$.
  - Since $x > 2$, we have $2x > 4$.
  - Hence $x^2 > 2x > 4$, as required.
wrong: 1
why: |
  Line 2 assumes the *conclusion* $x > 2$ and derives the hypothesis $x^2 > 4$. Everything after it is correct, but it proves the **converse**. The original claim is in fact false: $x = -3$ has $x^2 = 9 > 4$ but $x < 2$.
notes:
  '0': That is the right thing to prove.
```

## Each connective shapes a proof

The meaning of each connective tells you what a proof of it must look like, and how you may use it once you have it. This table is, in a sense, the whole of elementary proof technique.

| To prove… | you may… | To use a known… | you may… |
|---|---|---|---|
| $P \land Q$ | prove $P$, then prove $Q$ | $P \land Q$ | use $P$, and use $Q$ |
| $P \lor Q$ | prove $P$; or prove $Q$; or assume $\lnot P$ and prove $Q$ | $P \lor Q$ | split into **cases**: one assuming $P$, one assuming $Q$ |
| $P \to Q$ | assume $P$ and prove $Q$; or assume $\lnot Q$ and prove $\lnot P$ | $P \to Q$ | from $P$, conclude $Q$ |
| $P \leftrightarrow Q$ | prove $P \to Q$ and $Q \to P$ | $P \leftrightarrow Q$ | replace one by the other |
| $\lnot P$ | assume $P$ and derive a contradiction | $\lnot P$ | if you also derive $P$, you have a contradiction |

The last row is **proof by contradiction**, the subject of Chapter 3.

```prove
title: Products of integers
prompt: Prove that for all integers $m$ and $n$, if $mn$ is even, then $m$ is even or $n$ is even.
hints:
  - A direct proof is hard. What is the contrapositive? Remember De Morgan.
  - 'The contrapositive is: if $m$ is odd **and** $n$ is odd, then $mn$ is odd.'
  - 'Write $m = 2a + 1$ and $n = 2b + 1$ — with different letters!'
rubric:
  - You stated the contrapositive correctly (“both odd ⇒ product odd”), using De Morgan to negate “$m$ even or $n$ even”.
  - You wrote the two odd numbers with **different** letters, e.g. $2a+1$ and $2b+1$.
  - 'You showed $mn = 2(\text{integer}) + 1$ and said why the bracket is an integer.'
solution: |
  We prove the contrapositive. By De Morgan's law, the negation of “$m$ is even or $n$ is even” is “$m$ is odd and $n$ is odd”. So suppose $m = 2a + 1$ and $n = 2b + 1$ for integers $a, b$. Then
  $$mn = 4ab + 2a + 2b + 1 = 2(2ab + a + b) + 1,$$
  and $2ab + a + b$ is an integer, so $mn$ is odd. Hence if $mn$ is even, $m$ or $n$ must be even.
tutor: Expect a proof by contrapositive. A common error is writing both odd numbers as 2k+1 with the same k, which only covers m = n.
```

## Knights and knaves

The logician Raymond Smullyan filled several books with puzzles about an island where **knights** always tell the truth and **knaves** always lie.:cite[smullyan1978] They are pure propositional logic. If Alice says $S$, then “Alice is a knight” and “$S$ is true” are either both true or both false: $A \leftrightarrow S$. Each puzzle is a set of such equivalences, and a truth table finds every consistent assignment.

::knights-knaves

Puzzle 1 has a famous one-line solution: *no knight could say “we are both knaves”* (it would be a lie), so Alice is a knave; her statement is therefore false, so Bob is not a knave. Try to find similar short arguments for the others before resorting to the table.

## A theorem about logic

We have five connectives. Are there statements we cannot express with them? A connective in two variables is really just a truth table with four rows, so there are $2^4 = 16$ of them — “exclusive or”, “neither … nor”, “not both” and so on. With three variables there are $2^8 = 256$ possible truth tables; with $n$ variables, $2^{2^n}$. Can every one of them be written with just $\lnot$, $\land$, $\lor$?

:::theorem{name="Every truth table has a formula"}
For every function $f$ that assigns a truth value to each of the $2^n$ rows of a truth table in the variables $p_1, \ldots, p_n$, there is a formula using only $\lnot$, $\land$ and $\lor$ whose truth table is $f$.
:::

This is a statement of the form “for every $f$ there exists a formula”. The natural proof is a **proof by construction**: describe how to build the formula from $f$.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Write down one “and” for each row where $f$ is true, describing that row exactly; then “or” them together. The result is true in precisely those rows.
:::
:::level[Proof]
For each row $r$ in which $f$ is true, let $C_r$ be the conjunction $\ell_1 \land \cdots \land \ell_n$, where $\ell_i$ is $p_i$ if $p_i$ is true in row $r$ and $\lnot p_i$ if it is false. By construction $C_r$ is true in row $r$ and false in every other row (in any other row some $p_i$ has the other value, making $\ell_i$ false).

Let $F$ be the disjunction of the $C_r$ over all rows where $f$ is true. In a row where $f$ is true, one of the disjuncts is true, so $F$ is true. In a row where $f$ is false, every disjunct $C_r$ belongs to a different row and is false, so $F$ is false. Hence $F$ has truth table $f$.

One case remains: if $f$ is false in *every* row, there are no disjuncts. Then take $F = p_1 \land \lnot p_1$, which is always false.
:::
::::

The formula built this way is called the **disjunctive normal form** of $f$. It is usually far from the shortest formula, but the proof only needed *some* formula. Notice the careful treatment of the empty case at the end: constructions that “join together all the pieces” often fail silently when there are no pieces.

Since $P \to Q \equiv \lnot P \lor Q$, and $P \leftrightarrow Q$ is two implications, the theorem says that $\lnot$, $\land$ and $\lor$ can express everything. Can we do with fewer? De Morgan's law $P \lor Q \equiv \lnot(\lnot P \land \lnot Q)$ removes $\lor$, so $\lnot$ and $\land$ are enough. Remarkably, a *single* connective is enough.

:::theorem{name="Functional completeness of NAND" who="Peirce; Sheffer" year="c. 1880; 1913"}
Every truth table is the truth table of a formula that uses only the connective $P \uparrow Q$ (“not both”, or NAND), defined as $\lnot(P \land Q)$.
:::

:::proof
By the previous theorem and De Morgan's law, it is enough to express $\lnot$ and $\land$ using $\uparrow$. First, $P \uparrow P = \lnot(P \land P) \equiv \lnot P$. Then $P \land Q \equiv \lnot\lnot(P \land Q) = \lnot(P \uparrow Q) \equiv (P \uparrow Q) \uparrow (P \uparrow Q)$. Replacing every $\lnot$ and $\land$ in a formula by these expressions gives an equivalent formula using only $\uparrow$.
:::

This proof uses the first theorem as a stepping stone — a **lemma** — and reduces the new problem to it. That move, *reduce to something you have already proved*, is one of Pólya's most useful heuristics. Now try it yourself.

::formula-challenge{id="truth-and-consequence/nand" title="Everything from NAND" subtitle="Each answer is checked against the target by truth table." tasks='[{"target":"~p","allowed":["nand"],"hint":"What is p nand p?"},{"target":"p & q","allowed":["nand"]},{"target":"p | q","allowed":["nand"],"hint":"p ∨ q ≡ ¬p nand ¬q."},{"target":"p -> q","allowed":["nand"],"hint":"p → q ≡ ¬(p ∧ ¬q)."}]'}

:::history{year=1913 title="One gate to rule them all" people="Charles Sanders Peirce, Henry Sheffer, Claude Shannon"}
Charles Sanders Peirce discovered around 1880 that a single connective suffices — either NAND or its dual NOR, “neither … nor” — but did not publish it. Henry Sheffer rediscovered the fact in 1913, using NOR; a few years later Jean Nicod used the same stroke symbol for NAND, which is why NAND is still called the *Sheffer stroke*.:cite[sheffer1913] Truth tables themselves became standard only in 1921, in Ludwig Wittgenstein's *Tractatus* and in Emil Post's doctoral thesis, which proved the theorems of this section in general form.:cite[post1921]

In 1937 a 21-year-old MIT student, Claude Shannon, realised that Boole's algebra of logic describes electrical switching circuits exactly.:cite[shannon1938] His master's thesis founded digital circuit design. Today a NAND gate takes a handful of transistors, and because NAND is functionally complete, any digital circuit — in principle, a whole processor — can be built from NAND gates alone.
:::

:::bio{name="George Boole" born=1815 died=1864 place="Lincoln and Cork"}
The son of a Lincoln shoemaker, Boole left school at sixteen to support his family as a teacher, and taught himself mathematics from books. His *Mathematical Analysis of Logic* (1847) and *Laws of Thought* (1854) treated reasoning as algebra, with $x \cdot y$ for “$x$ and $y$” and $x^2 = x$ as a law of thought. Although he had no degree, he became the first professor of mathematics at Queen's College, Cork. He died at 49 of pneumonia, after walking to a lecture in heavy rain. The algebra of true and false — and every `bool` in every programming language — is named after him.
:::

## Exercises

```quiz
q: 'A statement in $n$ variables is a **tautology** if it is true in all $2^n$ rows. How many of the $16$ two-variable truth tables are tautologies, and how many are *satisfiable* (true in at least one row)?'
options:
  - text: 1 tautology, 15 satisfiable
    correct: true
    why: Only the table with four Ts is a tautology; only the table with four Fs is unsatisfiable.
  - text: 4 tautologies, 12 satisfiable
    why: A truth table is a column of four values. Exactly one column is all T.
  - text: 1 tautology, 8 satisfiable
    why: Every column except the all-F one has at least one T.
```

```parsons
title: De Morgan in a proof
prompt: 'Order the proof of: *if $x \cdot y = 0$ for real numbers $x, y$, then $x = 0$ or $y = 0$*. One line is not needed.'
lines:
  - 'We prove “$x = 0$ or $y = 0$” by assuming $x \ne 0$ and showing $y = 0$.'
  - Suppose $xy = 0$ and $x \ne 0$.
  - Since $x \ne 0$, it has a reciprocal $1/x$.
  - 'Then $y = \frac{1}{x}(xy) = \frac1x \cdot 0 = 0$.'
distractors:
  - Suppose $x = 0$ and $y = 0$.
explain: 'To prove $P \lor Q$ it is enough to assume $\lnot P$ and prove $Q$, since $P \lor Q \equiv \lnot P \to Q$.'
```

:::challenge
**AND and OR are not enough.** Prove that *not* every truth table can be expressed using only $\land$ and $\lor$ (no $\lnot$, no constants). Hint: find a property that every such formula has — for example, look at the row in which every variable is true — and prove it for every formula, however complicated, by showing that it holds for single variables and is preserved when you combine two formulas with $\land$ or $\lor$. This kind of argument, *structural induction*, is the subject of Chapter 5.
:::

## Further reading

- Raymond Smullyan, *What Is the Name of This Book?* — logic puzzles that gradually turn into Gödel's theorem (our Chapter 12).:cite[smullyan1978]
- William and Martha Kneale, *The Development of Logic* — the history, from Aristotle and the Stoics to Frege.:cite[kneale]
