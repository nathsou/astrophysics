---
number: 12
title: The limits of proof
summary: Cantor’s diagonal returns three times — as a paradox that shook the foundations of mathematics, as a program no computer can run, and as a true statement no proof can reach. Russell, Turing and Gödel, and what incompleteness does and does not say.
duration: About 2½ hours
prerequisites: [sizes-of-infinity, truth-and-consequence]
theorems: [Russell’s paradox, The halting problem is undecidable (Turing, 1936), Gödel’s first incompleteness theorem (1931)]
techniques: [diagonalisation, self-reference, reduction, proof by contradiction]
---

In Chapter 11 Cantor built a number that differs from every number in a list by going down the diagonal and changing each entry. The same move — *make an object that disagrees with the $n$th item about the $n$th thing* — turns out to be one of the most powerful ideas in logic. In this chapter it strikes three times. Each time it proves that something cannot exist: a set, a program, a proof.

## A set that cannot exist

In 1901 the young Bertrand Russell was studying Cantor's proof that no set is as large as its power set. Applied to the “set of all sets”, it gives a contradiction (Chapter 11). Russell looked for the simplest possible form of that contradiction, and found this.

Some sets are members of themselves (the set of all sets with more than one element has more than one element), most are not (the set of primes is not a prime). Consider the set of all sets that are *not* members of themselves:
$$R = \{\, x : x \notin x \,\}.$$
Is $R$ a member of itself?

:::theorem{name="Russell’s paradox" who="Bertrand Russell" year=1901}
There is no set $R$ whose members are exactly the sets that are not members of themselves.
:::

:::proof
Suppose there were. Then for every set $x$: $x \in R \leftrightarrow x \notin x$. Take $x = R$: $R \in R \leftrightarrow R \notin R$. A statement equivalent to its own negation is a contradiction (check its truth table). So no such $R$ exists.
:::

The proof is short and entirely correct. The trouble was that almost everyone had assumed, without saying so, that *every* property defines a set — Frege had made it an axiom. Russell's argument shows that this assumption is inconsistent.

:::history{year=1902 title="A letter to Jena" people="Bertrand Russell, Gottlob Frege, Ernst Zermelo"}
On 16 June 1902 Russell wrote to Gottlob Frege (Chapter 2), whose *Basic Laws of Arithmetic* was meant to derive all of arithmetic from pure logic. The letter was polite and devastating: Frege's axiom that every concept has an extension implied the existence of $R$. Frege replied within a week that the discovery had left him “thunderstruck”, and that it seemed to undermine the foundation on which he had intended to build arithmetic. Mathematicians spent the next decades repairing the foundations. The repair now in use, Zermelo–Fraenkel set theory (1908–1922), allows new sets to be formed only in restricted ways — for example, by selecting elements *from an existing set* — so that $R$ can never be formed.:cite[van-heijenoort]
:::

The same pattern is familiar in everyday dress. The village barber shaves exactly those villagers who do not shave themselves. Who shaves the barber?

```bug
title: The barber
prompt: 'A village has a barber who shaves exactly those men of the village who do not shave themselves. Here is an argument about him. Which step is wrong?'
lines:
  - The barber is a man of the village.
  - If he shaves himself, then by the rule he does not shave himself.
  - If he does not shave himself, then by the rule he shaves himself.
  - Therefore the barber both shaves and does not shave himself — so logic is inconsistent.
wrong: 3
why: |
  Lines 2 and 3 show that the assumption “such a barber exists” leads to a contradiction. The correct conclusion is that **no such barber exists** (a proof by contradiction), not that logic is inconsistent. Russell's paradox has exactly the same structure: the “set” $R$ does not exist.
```

## Paradoxes of language

The ancient Greeks knew the **liar**: *this sentence is false*. If it is true, then it is false; if it is false, then it is true. A subtler relative, which Russell published in 1906 and credited to an Oxford librarian named G. G. Berry, goes like this. There are only finitely many English phrases of fewer than sixty letters, so only finitely many numbers can be described by them. So there is a smallest number *not* describable in fewer than sixty letters. But “the smallest positive integer not definable in fewer than sixty letters” describes it — in fewer than sixty letters.

These paradoxes do not show that mathematics is inconsistent. They show that “true”, “describable” and “definable” are dangerous words when a sentence may talk about itself. The achievement of Turing and Gödel was to capture self-reference *precisely*, inside mathematics, where it produces not paradoxes but theorems.

## A program that cannot exist

By the 1930s mathematicians hoped for a mechanical procedure that could decide, for any mathematical statement, whether it is provable — David Hilbert's *Entscheidungsproblem*. To show that no such procedure exists, one first needs a precise notion of “procedure”. In 1936 Alan Turing gave one — an idealised machine that follows a finite table of rules, which we would now call a computer program — and used it to prove that some questions about programs have no mechanical answer.:cite[turing1936]

The **halting problem** asks: given a program $P$ and an input $x$, will $P$ eventually stop when run on $x$, or run for ever? Programs are finite texts, so a program can take another program's text as input.

:::theorem{name="The halting problem is undecidable" who="Alan Turing" year=1936}
There is no program $H$ which, for every program $P$ and every input $x$, halts and correctly answers whether $P$ halts on $x$.
:::

Before the proof, try to build such an $H$ yourself — and watch it fail.

::contrarian-machine

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Given any claimed decider $H$, build a program $D$ that asks $H$ what $D$ itself will do, and then does the opposite. $H$ cannot be right about $D$.
:::
:::level[Proof]
Suppose, for a contradiction, that $H$ is such a program. Define a new program $D$ that, on input $P$ (the text of a program), runs $H(P, P)$ — which by assumption halts with an answer — and then:
- if $H(P, P)$ says “$P$ halts on input $P$”, $D$ enters an infinite loop;
- if $H(P, P)$ says “$P$ runs for ever on input $P$”, $D$ halts.

$D$ is a program, so we may run it on its own text. If $D$ halts on $D$, then $H(D, D)$ said “halts” (since $H$ is correct), so $D$ loops — contradiction. If $D$ runs for ever on $D$, then $H(D, D)$ said “runs for ever”, so $D$ halts — contradiction. Either way we have a contradiction, so $H$ does not exist.
:::
::::

This is Cantor's diagonal in disguise. Imagine an infinite table with a row for each program and a column for each input, recording halts or loops. $D$ is built to disagree with row $P$ in column $P$: it is the diagonal, flipped. Since every program is somewhere in the table, and $D$ disagrees with every row, $D$ could not be computed if $H$ could.

```parsons
title: The shape of Turing’s proof
prompt: Put the steps in order.
lines:
  - Suppose a program $H(P, x)$ correctly decides whether $P$ halts on $x$.
  - Build $D$, which on input $P$ runs $H(P, P)$ and does the opposite of what it predicts.
  - Run $D$ on its own text $D$.
  - If $D(D)$ halts, $H$ predicted it halts, so $D$ loops; if it loops, $H$ predicted that, so $D$ halts.
  - Both cases are contradictory, so no such $H$ exists.
distractors:
  - Run $H$ on every program to see which ones halt.
explain: The proof never runs $H$ on anything except $(D, D)$ — and never needs to know how $H$ works.
```

## Numbers that talk about formulas

Kurt Gödel's great insight, five years before Turing, was that arithmetic can talk about itself. Give each symbol of a formal language a number, and encode a string of symbols $s_1 s_2 \ldots s_k$ as
$$2^{\text{code}(s_1)} \cdot 3^{\text{code}(s_2)} \cdot 5^{\text{code}(s_3)} \cdots$$
By unique factorisation (Chapter 6), the number determines the string. A proof — a finite sequence of formulas — can be encoded the same way. Then “$n$ is the code of a proof of the formula with code $m$” becomes a statement about the numbers $n$ and $m$: complicated, but a statement of arithmetic like any other.

::godel-numbering

## A truth that cannot be proved

A **formal system** — such as Peano arithmetic, or Zermelo–Fraenkel set theory — consists of a precise language, a list of axioms, and rules of inference, arranged so that a program can check whether a given text is a correct proof. We call it **sound** if every statement it proves is true.

:::theorem{name="Gödel’s first incompleteness theorem (a form of it)" who="Kurt Gödel" year=1931}
For every sound formal system that can express basic statements about programs (or, equivalently, about arithmetic), there are true statements that it cannot prove.
:::

With Turing's theorem in hand, there is a remarkably short proof of this form of the theorem.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If the system proved every true statement of the form “$P$ does not halt on $x$”, we could decide halting: run $P$, and at the same time search through all proofs. One search or the other must succeed. That contradicts Turing.
:::
:::level[Proof]
Let $T$ be a sound formal system in which, for every program $P$ and input $x$, the statement “$P$ does not halt on $x$” can be written down. (Gödel showed that this is possible in ordinary arithmetic, using numberings like the one above.) Suppose, for a contradiction, that $T$ proves every such statement that is true.

Here is a procedure for the halting problem. Given $P$ and $x$, alternate between two tasks: run $P$ on $x$ for one more step; and check the next candidate text (in a fixed listing of all texts, Chapter 11) to see whether it is a $T$-proof of “$P$ does not halt on $x$”. If $P$ halts, stop and answer “halts”. If a proof is found, stop and answer “runs for ever”.

The procedure always stops: if $P$ halts on $x$, the first task eventually finishes; if not, the statement is true, so by assumption it has a proof, which the second task eventually finds. And its answer is correct: it answers “halts” only when $P$ has halted, and “runs for ever” only when $T$ has proved it — which, as $T$ is sound, means it is true. This contradicts Turing's theorem. So some true statement “$P$ does not halt on $x$” has no proof in $T$.
:::
::::

Gödel's own proof was different and gave more. Using his numbering and a diagonal construction, he built an arithmetical sentence $G$ that says, in effect, *“$G$ is not provable in $T$”*. If $T$ proved $G$, it would prove a false statement; so, if $T$ is sound, $G$ is unprovable — and therefore true. This is the liar paradox, tamed: “unprovable” replaces “false”, and the contradiction becomes a theorem. Gödel also needed only *consistency* (no contradiction is provable), a weaker assumption than soundness, and his second theorem showed that a consistent system of this kind cannot prove its own consistency.:cite[godel1931]

:::warning
**What incompleteness does not say.** It does not say that there are true statements that cannot be proved *at all*: each unprovable sentence can be proved in a stronger system — which has unprovable sentences of its own. It does not say that mathematics is inconsistent, or unreliable, or that human thought transcends machines (a much-debated claim that does not follow from the theorem). It does not apply to systems too weak to talk about programs or arithmetic: the theory of the real numbers as an ordered field, for instance, is complete and decidable (Tarski, 1948). And it rarely touches ordinary mathematics — though it does sometimes, as the continuum hypothesis of Chapter 11 shows.
:::

:::history{year=1930 title="Königsberg, September 1930" people="David Hilbert, Kurt Gödel"}
Hilbert's programme aimed to put all of mathematics on a finite, formal foundation and to prove, by elementary means, that it is consistent and complete. At a conference in Königsberg, on 7 September 1930, a quiet 24-year-old from Vienna mentioned during a round-table discussion that he had found true arithmetical statements that cannot be proved. Almost nobody reacted, except John von Neumann, who grasped the point at once. The next day Hilbert, retiring, gave a famous radio address in the same city, ending: *Wir müssen wissen — wir werden wissen.* We must know — we will know. The words are on his gravestone. Gödel's paper appeared the following year.:cite[dawson-godel]
:::

:::bio{name="Kurt Gödel" born=1906 died=1978 place="Brno, Vienna and Princeton"}
Gödel proved the completeness of first-order logic in his doctoral thesis at 23 and the incompleteness theorems at 25. In 1940 he showed that the continuum hypothesis cannot be disproved (Chapter 11). He left Austria in 1940, crossing Siberia and the Pacific to reach Princeton, where his daily walks with Albert Einstein at the Institute for Advanced Study became legendary; Einstein said he went to the Institute “just to have the privilege of walking home with Gödel”. Gödel suffered from paranoia all his life, and in his last years feared that his food was poisoned. When his wife was hospitalised and could no longer prepare his meals, he stopped eating, and died of starvation.
:::

:::bio{name="Alan Turing" born=1912 died=1954 place="London, Cambridge, Bletchley Park and Manchester"}
Turing's 1936 paper, written at 24, defined computation and proved the halting problem undecidable, at almost the same moment as Alonzo Church in Princeton. During the Second World War he led the effort at Bletchley Park to break the German Enigma cipher. Afterwards he designed one of the first stored-program computers, proposed the “imitation game” now called the Turing test, and pioneered mathematical biology. In 1952 he was prosecuted for homosexuality and forced to undergo chemical castration; he died of cyanide poisoning two years later, aged 41. He received a posthumous royal pardon in 2013, and his portrait has been on the Bank of England's £50 note since 2021.
:::

## Exercises

```prove
title: Uncomputable functions exist
prompt: 'Using the results of Chapter 11, prove that there is a function $f: \mathbb{N} \to \{0, 1\}$ that is not computed by any program.'
hints:
  - How many programs are there? (Each is a finite text.)
  - How many functions $\mathbb{N} \to \{0, 1\}$ are there? Such a function is the same as a subset of $\mathbb N$.
rubric:
  - You showed the set of programs is countable (finite strings over a finite alphabet).
  - You showed the set of functions $\mathbb{N} \to \{0,1\}$ is uncountable (diagonal argument, or $|\mathcal{P}(\mathbb{N})| > |\mathbb{N}|$).
  - You concluded that some function is computed by no program, since each program computes at most one function.
solution: |
  Every program is a finite string over a finite alphabet, so there are countably many programs (Chapter 11), and each computes at most one function. The functions $\mathbb N \to \{0, 1\}$ correspond to subsets of $\mathbb N$ (the set where $f = 1$), and by Cantor's theorem there are uncountably many. So some function is computed by no program. (This is a non-constructive proof; the halting problem gives an explicit example.)
```

```quiz
q: 'Which statement follows from Gödel''s first incompleteness theorem?'
options:
  - text: Some true mathematical statements can never be proved by anyone.
    why: Each unprovable statement is unprovable *in a particular system*; a stronger system may prove it.
  - text: No sound, sufficiently expressive formal system proves every true statement of arithmetic.
    correct: true
    why: That is the theorem. Every such system is incomplete.
  - text: Mathematics is inconsistent.
    why: Nothing in the theorem suggests that; it assumes consistency (or soundness).
```

```blanks
title: Decoding
prompt: 'With the codes above ($0 \mapsto 1$, $S \mapsto 2$, $= \mapsto 3$), decode these Gödel numbers.'
text: |
  1. $2^2 \cdot 3^1 = 12$ encodes the string [[a]].

  2. $2^1 \cdot 3^3 \cdot 5^1 = 270$ encodes [[b]].

  3. The formula $S0 = S0$ has Gödel number $2^2 \cdot 3^1 \cdot 5^3 \cdot 7^2 \cdot 11^1 = $ [[c]].
blanks:
  a: { answer: 'S0', kind: text }
  b: { answer: '0=0', accept: ['0 = 0'], kind: text }
  c: { answer: '4 * 3 * 125 * 49 * 11' }
```

:::challenge
**A diagonal for functions.** Suppose $f_0, f_1, f_2, \ldots$ is a list of *total* computable functions $\mathbb{N} \to \mathbb{N}$ (programs that halt on every input), and the list itself can be produced by a program. Show that $g(n) = f_n(n) + 1$ is total and computable but not on the list. Why does this not contradict the fact that the total computable functions form a countable set? (Hint: it shows that no program can *list* them.)
:::

## Further reading

- Ernest Nagel and James Newman, *Gödel's Proof* — the classic short account, revised by Douglas Hofstadter.:cite[nagel-newman]
- Douglas Hofstadter, *Gödel, Escher, Bach* — self-reference in logic, art and music; the MU puzzle of Chapter 20 comes from it.:cite[geb]
- Jean van Heijenoort (ed.), *From Frege to Gödel* — the original papers, including Russell's letter, Frege's reply and Gödel's paper, in translation.:cite[van-heijenoort]
