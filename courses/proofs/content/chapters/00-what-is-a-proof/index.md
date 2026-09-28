---
number: 0
title: What is a proof?
summary: Patterns that lie, a theorem older than proof itself, four ways to see why it is true — and how this course will teach you to find proofs of your own.
duration: About 1½ hours
theorems: [Pythagoras’ theorem]
techniques: [direct proof, dissection, algebraic identity]
---

Here is a claim. For every whole number $n \ge 0$, the number $n^2 + n + 41$ is prime.

Try it. For $n = 0$ you get $41$, which is prime. For $n = 1$, $43$: prime. Then $47$, $53$, $61$, $71$, $83$, $97$ — all prime. You could check forty values in a row and never find an exception. Leonhard Euler noticed this polynomial in 1772 and was struck by it.:cite[euler1772] If you were a scientist, forty successful experiments would be a lot of evidence.

::euler-polynomial

The claim is false. At $n = 40$ the formula gives $40^2 + 40 + 41 = 1681 = 41^2$, and at $n = 41$ you get $41 \cdot 43$. Forty confirmations told us nothing about the forty-first case.

This is the problem that proofs solve. In mathematics a statement about *every* number cannot be settled by checking cases, however many. We want an argument that settles it for every case at once — an argument that anyone can check, step by step, and that leaves no room for an exception. That argument is a **proof**, and learning to find proofs is what this course is about.

## Patterns that lie

Euler's polynomial is not a freak. Put $n$ points on a circle, join every pair with a straight chord, and count the regions the disc is cut into. Before you use the widget, count by hand: one point gives one region, two points give two, three give four, four give eight.

::circle-regions

The pattern $1, 2, 4, 8, 16$ begs to be continued with $32$. With six points there are only $31$ regions, however you place them (as long as no three chords meet at one point). The true formula turns out to be $1 + \binom{n}{2} + \binom{n}{4}$, and we will be able to prove it in Chapter 21 using Euler's formula for networks. Its first five values happen to agree with $2^{n-1}$.

The number theorist Richard Guy collected dozens of such coincidences and called the phenomenon *the strong law of small numbers*: there aren't enough small numbers to meet the many demands made of them.:cite[guy1988] Small cases are wonderful for *discovering* what might be true. They can never establish that it is.

```quiz
q: 'You check a statement about whole numbers for $n = 1, 2, \ldots, 10^{9}$ with a computer, and it holds every time. What do you know?'
options:
  - text: The statement is true.
    why: 'Plenty of statements hold for every number below a billion and then fail. The smallest counterexample to Pólya''s conjecture (Chapter 6 has the story) is about $9 \times 10^{8}$.'
  - text: The statement is very probably true.
    why: '“Probably” has no precise meaning here: the numbers are not a random sample of anything. A billion confirmations are good evidence that a proof might exist, not a substitute for one.'
  - text: It holds for $n \le 10^{9}$. Whether it holds beyond that is still open.
    correct: true
    why: That is all the checking shows. It is still valuable — it tells you what to try to prove, and it rules out small counterexamples.
```

## A theorem older than proof

The most famous theorem in mathematics is also one of the oldest.

:::theorem{name="Pythagoras’ theorem"}
In a right-angled triangle with legs $a$ and $b$ and hypotenuse $c$,
$$a^2 + b^2 = c^2.$$
:::

The statement was known long before anyone proved it. A clay tablet from Larsa in Mesopotamia, catalogued as Plimpton 322 and written around 1800 BC, lists fifteen pairs of numbers such as $119$ and $169$, which are the short leg and hypotenuse of right triangles with whole-number sides: $119^2 + 120^2 = 169^2$.:cite[robson2002] Indian builders' manuals, the *Śulbasūtras* (c. 800–500 BC), state the rule for the diagonal of a rectangle, and the Chinese *Zhoubi Suanjing* explains it with a figure of the $3, 4, 5$ triangle.

What these sources give are rules and worked examples, not arguments that the rule must always hold. Whether the Babylonians had reasons we would call proofs is debated; they certainly left none in writing.

:::history{year="c. 300 BC" title="Euclid’s Elements" people="Euclid of Alexandria"}
The Greek contribution was not the theorem but the demand for a proof. Euclid's *Elements* (around 300 BC) starts from five postulates and a handful of “common notions”, then derives 465 propositions, each from the ones before. The theorem we call Pythagoras' is Proposition 47 of Book I, and its converse is Proposition 48.:cite[euclid] For two thousand years the *Elements* was *the* model of rigorous reasoning. Abraham Lincoln, already a congressman, worked through its first six books to learn what it means to *demonstrate* something.
:::

:::bio{name="Pythagoras of Samos" born="c. 570 BC" died="c. 495 BC" place="Samos and Croton"}
Pythagoras founded a religious and philosophical community in Croton, in southern Italy, whose members believed that “all is number”. He wrote nothing, and everything we know was written down centuries later, mixed with legend: that he sacrificed a hundred oxen when he discovered the theorem, that he forbade eating beans. Nobody knows whether he or his followers proved the theorem that bears his name, or how. We will meet the Pythagoreans again in Chapter 3, where the same theorem led them to a discovery they are said to have tried to hide.
:::

## Four ways to see it

There are hundreds of proofs of Pythagoras' theorem — Elisha Loomis collected 367 of them.:cite[loomis] Here are four. As you read each one, ask yourself two questions: *why* does it work, and *what exactly* does it use?

### Rearranging four triangles

Take four copies of the triangle and put them in a square of side $a + b$. Arranged one way, they leave a tilted square of side $c$ uncovered. Arranged another way, they leave two squares, of sides $a$ and $b$. Press **Rearrange** and watch.

::rearrangement-proof

:::proof
The big square has area $(a + b)^2$ in both pictures, and the four triangles cover the same area $4 \cdot \tfrac12 ab$ in both. So the uncovered areas are equal: $c^2 = a^2 + b^2$.
:::

That is a real proof, but it leans on the picture for one claim you may not have noticed: that the uncovered region in the first arrangement *is a square*. Its sides all have length $c$, but a rhombus has equal sides too. Why are its corners right angles? At each corner of the tilted region, three angles sit along a straight side of the big square: the two acute angles of a triangle, $\alpha$ and $\beta$, and the corner of the tilted region. Since the angles of a triangle add up to $180°$ and one of them is $90°$, we have $\alpha + \beta = 90°$, and the corner is $180° - 90° = 90°$.

:::key
A picture can *suggest* a proof. The proof is the list of facts that make the picture correct. Learning to spot what a picture is quietly assuming is one of the skills this course trains.
:::

### “Behold!”

The Indian mathematician Bhāskara II (1114–1185) is said to have given this figure with a single word of explanation: *Behold!* Four copies of the triangle fit inside the square on the hypotenuse, with a small square in the middle.

::bhaskara-figure

The small square has side $b - a$, so counting the area of the big square two ways gives

$$c^2 = 4 \cdot \tfrac12 ab + (b - a)^2.$$

The rest is algebra — and algebra is something the course's **step checker** can verify. Try it: type the chain of equalities from $4 \cdot \tfrac12 ab + (b-a)^2$ to $a^2 + b^2$, one step per line.

```step
title: Finishing Bhāskara’s proof
prompt: Show that $4 \cdot \tfrac12 ab + (b - a)^2 = a^2 + b^2$. Write each step on its own line, starting the next line with `=`.
start: 4*(1/2)ab + (b-a)^2
target: a^2 + b^2
relation: '='
initial: 4*(1/2)ab + (b-a)^2
hints:
  - Simplify $4 \cdot \tfrac12 ab$ first.
  - 'Expand $(b-a)^2 = b^2 - 2ab + a^2$.'
solution: |
  $4 \cdot \tfrac12 ab + (b-a)^2 = 2ab + (b-a)^2 = 2ab + b^2 - 2ab + a^2 = a^2 + b^2.$
```

When a step is proved by algebra, the checker says **✓ algebra**: both sides reduce to the same polynomial. If a step is wrong, it finds values that break it. Try changing a sign to see what happens.

### Two squares become one

The next proof avoids algebra altogether. Put the squares on the two legs side by side, cut along two lines of length $c$, and turn the two triangles you have cut off by a quarter turn about the marked corners.

::chair-dissection

The pieces fill the square on the hypotenuse exactly. This is a *dissection proof*: two shapes are cut into the same pieces, so they have the same area. Versions of it go back to the ninth-century Baghdad mathematician Thābit ibn Qurra.:cite[maor]

:::question
The two cuts start at the point on the bottom edge at distance $a$ from the left corner. Why that point? What would go wrong if you started the cuts anywhere else?
:::

### A president's trapezoid

In 1876, a congressman from Ohio named James Garfield published a proof in the *New England Journal of Education*.:cite[garfield1876] Five years later he became the twentieth President of the United States. His figure is half of the rearrangement picture: two copies of the triangle and a right-angled isosceles triangle with legs $c$ form a trapezoid with parallel sides $a$ and $b$ and height $a + b$.

The area of a trapezoid is the average of its parallel sides times its height, so

$$\frac{a + b}{2}\,(a + b) \;=\; 2 \cdot \tfrac12 ab + \tfrac12 c^2 .$$

```step
title: Garfield’s algebra
prompt: 'Starting from the trapezoid’s area $\tfrac12(a+b)(a+b)$, show that it equals $ab + \tfrac12(a^2 + b^2)$. Comparing with $ab + \tfrac12 c^2$ then finishes the proof.'
start: (a+b)(a+b)/2
target: ab + (a^2 + b^2)/2
relation: '='
initial: (a+b)(a+b)/2
hints:
  - Expand $(a+b)^2$.
solution: $\tfrac12(a+b)^2 = \tfrac12(a^2 + 2ab + b^2) = ab + \tfrac12(a^2+b^2)$.
```

### Similar triangles

The last proof is the one most textbooks use, and the idea behind it — that similar figures scale their areas by the *square* of their size — is the real reason the theorem is about squares. Use the zoom to go from the one-line idea to the full proof.

::::zoom{levels="Idea, Sketch, Proof" title="Pythagoras by similar triangles"}
:::level[Idea]
Drop the altitude from the right angle. It cuts the triangle into two smaller triangles, both similar to the original. Similar triangles have proportional sides, and the proportions add up to Pythagoras.
:::
:::level[Sketch]
Let the altitude from the right angle $C$ meet the hypotenuse $AB$ at $D$, splitting $c$ into $p = AD$ and $q = DB$. Triangle $ACD$ is similar to $ABC$ (they share the angle at $A$ and both have a right angle), so $\dfrac{p}{b} = \dfrac{b}{c}$, i.e. $b^2 = pc$. In the same way $a^2 = qc$. Add: $a^2 + b^2 = (p + q)c = c^2$.
:::
:::level[Proof]
Let $ABC$ have its right angle at $C$, with $a = BC$, $b = CA$, $c = AB$. Let $D$ be the foot of the perpendicular from $C$ to $AB$. Because the angles at $A$ and $B$ are acute, $D$ lies strictly between $A$ and $B$; write $p = AD$ and $q = DB$, so that $p + q = c$.

Triangles $ADC$ and $ACB$ both have a right angle (at $D$ and at $C$) and share the angle at $A$. Their third angles are therefore equal too, so they are similar, with $AD \leftrightarrow AC$, $AC \leftrightarrow AB$. Corresponding sides are proportional: $\dfrac{AD}{AC} = \dfrac{AC}{AB}$, that is, $\dfrac{p}{b} = \dfrac{b}{c}$, so $b^2 = pc$.

Likewise triangles $BDC$ and $BCA$ share the angle at $B$ and have right angles at $D$ and $C$, so $\dfrac{q}{a} = \dfrac{a}{c}$ and $a^2 = qc$.

Adding, $a^2 + b^2 = pc + qc = (p + q)c = c \cdot c = c^2$.
:::
::::

Notice how much the full proof adds to the sketch. It checks that $D$ lies *between* $A$ and $B$ (otherwise $p + q$ would not be $c$), and it says exactly which angles match. The sketch is how you would explain the proof to a friend; the full version is what you would write if the friend were a sceptic looking for holes. Both are useful, and the zoom lets you move between them. Most proofs in this course come with one.

```parsons
title: Rebuild the similar-triangles proof
prompt: Put the steps of the proof in order. One line does not belong.
lines:
  - Drop the perpendicular from $C$ to the hypotenuse; call its foot $D$, with $p = AD$ and $q = DB$.
  - Since the angles at $A$ and $B$ are acute, $D$ lies between $A$ and $B$, so $p + q = c$.
  - Triangles $ADC$ and $ACB$ are similar (right angle and a shared angle at $A$), so $p/b = b/c$ and $b^2 = pc$.
  - Triangles $BDC$ and $BCA$ are similar in the same way, so $a^2 = qc$.
  - Adding, $a^2 + b^2 = (p+q)c = c^2$.
distractors:
  - Since $a^2 + b^2 = c^2$, the angle at $C$ is a right angle.
swappable: [[2, 3]]
explain: The extra line is the *converse* of the theorem — a different statement, which the proof does not use (and which would make the argument circular if it did).
```

## What makes something a proof?

We have seen four different arguments for the same fact. What do they have in common?

Each starts from things we already accept — facts about areas, the angle sum of a triangle, the algebra of brackets — and moves in small steps, each of which follows from what came before, until it reaches the statement to be proved. This is all a proof is:

:::definition
A **proof** of a statement is a finite sequence of steps, each of which is an **axiom** (a starting assumption), a previously proved result, or follows from earlier steps by a rule of logic, and whose last step is the statement.
:::

This definition says nothing about how the proof was *found*, and that is exactly the difficulty. Checking a proof is mechanical: you go through it step by step. Finding one is not. None of the four proofs above is an obvious thing to try. Each depends on an idea — a way of looking at the problem — that makes the rest routine.

This course is about those ideas. They are not random flashes of genius. There are recurring techniques — proof by contradiction, induction, counting in two ways, looking for an invariant, the diagonal argument — and the best way to learn them is to see them at work in the proofs that made them famous.

:::warning
A proof has to be *complete*: “it's obvious from the picture” is not a step. The classic missing-square puzzle cuts a $13 \times 5$ “triangle” into four pieces and rearranges them into the same outline with a hole. The trick is that neither outline is really a triangle: its long side bends very slightly. Pictures are only as good as the facts you can check in them.
:::

## A statement and its converse

Euclid follows Proposition I.47 with its **converse**, I.48: if the sides of a triangle satisfy $a^2 + b^2 = c^2$, then the angle opposite $c$ is a right angle. A statement “if $P$ then $Q$” and its converse “if $Q$ then $P$” are different claims. One can be true while the other is false: *if a number is divisible by 4, it is even* is true; *if a number is even, it is divisible by 4* is false. Here both directions happen to be true, but each needs its own proof. Confusing a statement with its converse is one of the most common mistakes in proofs, and Chapter 1 takes it apart.

```quiz
q: Which statement is the converse of “if a triangle is equilateral, then all its angles are $60°$”?
options:
  - text: If a triangle is not equilateral, then not all its angles are $60°$.
    why: That is the *inverse*. It happens to be true here, but it is a different statement (it is equivalent to the converse, as Chapter 1 shows).
  - text: If all the angles of a triangle are $60°$, then it is equilateral.
    correct: true
    why: The converse swaps the hypothesis and the conclusion.
  - text: If not all the angles are $60°$, then the triangle is not equilateral.
    why: That is the *contrapositive*, which is always equivalent to the original statement.
```

## How to find a proof

In 1945 the Hungarian mathematician George Pólya published *How to Solve It*, a small book about the process of solving problems rather than their solutions.:cite[polya1945] He divided it into four phases, and they will run through the whole course:

1. **Understand the problem.** What is given? What must be shown? Can you restate it? Draw a figure. Try small cases — this is where the evidence you gathered at the start of the chapter belongs.
2. **Devise a plan.** Have you seen a related problem? Can you solve a special case, or a more general one? Can you work backwards from what you want?
3. **Carry out the plan**, checking each step.
4. **Look back.** Can you check the result? Can you see it at a glance? Can you use the method for another problem?

The four proofs of Pythagoras' theorem illustrate the last point well. Once you have seen that areas can be counted in two ways, you have a technique, not just a proof.

:::bio{name="George Pólya" born=1887 died=1985 place="Budapest, Zürich and Stanford"}
Pólya was a leading analyst and probabilist who also cared deeply about how mathematics is learned. His *How to Solve It* has sold over a million copies. He liked to say that if you can't solve a problem, there is an easier problem you *can* solve: find it. He is also the author of the “proof” that all horses are the same colour, which you will take apart in Chapter 5.
:::

## How this course works

Every chapter is built around one theorem — sometimes two or three — chosen because it is beautiful, historically important, or both. You will usually meet the theorem as a question first, gather evidence with an interactive figure, and then build the proof, often in several passes. Along the way you will find:

- **Theorems and proofs** set out as in a textbook, with a **zoom** on the important ones.
- **History and biographies**: who proved what, when, and often what went wrong first.
- **Step checks.** Type a chain of equalities or inequalities; a small computer algebra system checks each step. **✓ algebra** means the step is proved exactly. **✓ tested** means the step held at a few hundred test values — very probably right, but not a proof. **✗** comes with a counterexample. Appendix B explains what the checker can and cannot do.
- **Fill-in-the-blanks** proofs, jumbled proofs to put in order, and false proofs in which to find the bug.
- **Write-a-proof exercises**, with hints, a checklist and a model proof. If you add your own Anthropic API key, an AI tutor can read your attempt, point to the first gap and ask you a question about it. It is set up never to write the proof for you.

Your progress and drafts are saved in this browser.

## Exercises

```bug
title: Every number equals the next one
prompt: 'This argument “proves” that $n = n + 1$ for every $n$. Click the first line that does not follow from the lines before it.'
lines:
  - Start from the true equation $n^2 - (2n+1)n = (n+1)^2 - (2n+1)(n+1)$ (both sides equal $-n^2 - n$).
  - 'Add $\left(\frac{2n+1}{2}\right)^2$ to both sides.'
  - 'Each side is now a perfect square: $\left(n - \frac{2n+1}{2}\right)^2 = \left(n + 1 - \frac{2n+1}{2}\right)^2$.'
  - 'Take square roots: $n - \frac{2n+1}{2} = n + 1 - \frac{2n+1}{2}$.'
  - Add $\frac{2n+1}{2}$ to both sides, so $n = n + 1$.
wrong: 3
why: |
  From $x^2 = y^2$ you may only conclude $x = y$ **or** $x = -y$. Here $x = n - \frac{2n+1}{2} = -\frac12$ and $y = n + 1 - \frac{2n+1}{2} = \frac12$: the squares are equal but the numbers are not. The step silently assumed $x$ and $y$ have the same sign.
notes:
  '0': Expand both sides to check — they really are equal.
  '2': 'This is completing the square: $x^2 - 2xh + h^2 = (x - h)^2$ with $h = \frac{2n+1}{2}$.'
```

```prove
title: The largest right triangle
prompt: |
  Prove that a right triangle with hypotenuse $c$ has area at most $\frac{c^2}{4}$, and that the area equals $\frac{c^2}{4}$ exactly when the triangle is isosceles.
hints:
  - The area is $\frac12 ab$ and Pythagoras gives $a^2 + b^2 = c^2$. So you want $2ab \le a^2 + b^2$.
  - 'Which square is never negative? Try $(a - b)^2$.'
rubric:
  - You stated what has to be shown in terms of $a$ and $b$ ($ab \le \frac{c^2}{2}$, or equivalent).
  - You used $a^2 + b^2 = c^2$.
  - You justified the inequality (for example from $(a - b)^2 \ge 0$) rather than just asserting it.
  - You dealt with the equality case in both directions.
solution: |
  The area is $\frac12 ab$, so we must show $\frac12 ab \le \frac14 c^2$, i.e. $2ab \le c^2 = a^2 + b^2$. This is equivalent to $0 \le a^2 - 2ab + b^2 = (a - b)^2$, which holds because squares of real numbers are never negative. Equality holds exactly when $(a - b)^2 = 0$, that is, when $a = b$: the isosceles right triangle.
tutor: The learner should reduce the claim to 2ab ≤ a² + b² using Pythagoras, justify it by (a − b)² ≥ 0, and handle the equality case (if and only if a = b).
```

```step
title: Check the key inequality
prompt: Use the step checker to verify the heart of the last proof. Write a chain that starts at $a^2 + b^2 - 2ab$ and shows it is $\ge 0$.
start: a^2 + b^2 - 2ab
target: '0'
relation: '>='
initial: a^2 + b^2 - 2ab
hints:
  - Rewrite the expression as a single square first.
solution: '$a^2 + b^2 - 2ab = (a - b)^2 \ge 0$.'
```

:::challenge
**Integer right triangles.** Show that in every right triangle whose sides are whole numbers, at least one leg is even. (Hint: what are the possible remainders of a square when divided by $4$?) In Chapter 7 we will find *every* such triangle, and use them to prove the only theorem whose proof Fermat left us.
:::

## Further reading

- Eli Maor, *The Pythagorean Theorem: A 4,000-Year History* — the theorem's story, told well.:cite[maor]
- George Pólya, *How to Solve It* — short, practical and still the best introduction to problem solving.:cite[polya1945]
- Richard Guy, “The strong law of small numbers” — thirty-five patterns, some true and some not. Can you tell which?:cite[guy1988]
