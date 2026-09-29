---
number: 11
title: Boolean algebra
summary: 'The algebra of AND, OR and NOT: its laws, De Morgan’s bubble pushing, sums of products, and the discovery that a single kind of gate, NAND or NOR, is enough to build any circuit there is.'
duration: About 1½ hours
prerequisites: [shannons-switches, real-gates]
---

You write Boolean algebra every day. `if (!(a && b))` is Boolean algebra, and so is the moment of doubt when you wonder whether you may rewrite it as `if (!a && !b)`. You may not, and the rest of this chapter is a machine for knowing why without running the code.

```quiz
q: 'For which values of the booleans a and b are `!(a && b)` and `!a && !b` the same?'
options:
  - text: For all of them, because the ! goes through the brackets.
    why: 'Try a = 1, b = 0: a && b is 0, so the left side is 1. On the right, !a is 0, so the whole thing is 0. The ! does not simply go through: something else has to change on the way.'
  - text: Only when a and b have the same value.
    correct: true
    why: 'If both are 0 both sides are 1, and if both are 1 both sides are 0. When the two differ the left side is 1 and the right side is 0. Half the rows agree.'
  - text: For none of them.
    why: 'They agree on two of the four rows: a = b = 0 and a = b = 1.'
```

Chapter 6 discovered that networks of switches compute: series is AND, parallel is OR, and a relay’s normally-closed contact is NOT. Chapter 10 then opened the box of a gate and put it back. This chapter is about the logic inside the box. What does a circuit of gates compute? When are two circuits the same function? And how few kinds of gate do we really need? The answers come from an algebra written down in 1854, eighty-three years before Shannon found it inside a relay circuit, by a professor who had never seen one.

## Three operations and a table

A **Boolean variable** has two values, 0 and 1. That is all it has, and all it needs to have: it might be a switch (open or closed), a wire (low or high), or a condition in your program (false or true). A **Boolean function** takes some variables and gives one. There are three basic ones, and they are the three you already know:

| Operation | Maths | Code | Gate | Value |
|---|---|---|---|---|
| :term[AND]{id=and} | A · B | `a && b` | flat back, round front | 1 only if both are 1 |
| :term[OR]{id=or} | A + B | `a \|\| b` | curved back, pointed front | 1 if at least one is 1 |
| :term[NOT]{id=not} | ¬A | `!a` | triangle with a bubble | the other value |

The notation is borrowed from arithmetic, on purpose and with a trap. A · B looks like a product and behaves like one: 0 · anything is 0, 1 · A is A. A + B looks like a sum but is not: **1 + 1 = 1**, because the lamp of Chapter 6 is lit when both parallel switches are closed, not twice as lit. We write A · B as AB when nothing is ambiguous, and we bind NOT tightest, then AND, then OR, exactly as × binds tighter than + in school. So A + B·C means “A, or both B and C”, and Chapter 6’s `(A && B) || C` is AB + C.

A function of *n* variables has 2<sup>*n*</sup> rows in its :term[truth table]{id=truth-table}, and because each row can independently be 0 or 1 there are 2<sup>2<sup>*n*</sup></sup> different functions of *n* variables: 16 for two, 256 for three, 65,536 for four, and about 4.3 billion for five. Most of them have no name. We shall see that every single one can be built from the three above.

## The laws

Two expressions are the same function if they have the same truth table. Checking that is a matter of writing out 2<sup>*n*</sup> rows, and the whole subject amounts to finding shortcuts. The shortcuts are laws: identities that hold for every value of the variables, that you can apply to an expression without evaluating it.

| Law | AND form | OR form |
|---|---|---|
| Identity | A · 1 = A | A + 0 = A |
| Null (domination) | A · 0 = 0 | A + 1 = 1 |
| Idempotent | A · A = A | A + A = A |
| Complement | A · ¬A = 0 | A + ¬A = 1 |
| Double negation | ¬¬A = A | |
| Commutative | A · B = B · A | A + B = B + A |
| Associative | (A · B) · C = A · (B · C) | (A + B) + C = A + (B + C) |
| Distributive | A · (B + C) = A·B + A·C | A + B·C = (A + B) · (A + C) |
| Absorption | A · (A + B) = A | A + A·B = A |

The first three rows say what 0 and 1 do. The commutative and associative laws are why Chapter 6’s networks did not care about order or bracketing. The complement law is the one that encodes the whole idea: a variable and its complement can never both be 1, and one of them always is.

Notice that the table is in two columns, and that each entry on the right is the entry on the left with AND and OR swapped, and 0 and 1 swapped. This is the :term[principle of duality]{id=duality}: swap AND with OR and 0 with 1 in any true identity and you get another true identity. It is a free doubling of every law you learn, and it will reappear as De Morgan’s laws in a moment. It is also Chapter 6’s “mirror”: Shannon’s hindrance convention is what the algebra looks like with 0 and 1 swapped.

Most of these you can accept at a glance. The one that will surprise you is the OR form of the distributive law, and it makes a good test of your intuition.

```quiz
q: 'Which of these is equal to A + B·C for every value of A, B and C?'
options:
  - text: (A + B) · C
    why: 'Try A = 1, B = 0, C = 0. The left side is 1 + 0 = 1, and this is (1 + 0) · 0 = 0.'
  - text: (A + B) · (A + C)
    correct: true
    why: 'OR distributes over AND, just as AND distributes over OR. Multiply out: (A + B)(A + C) = A·A + A·C + B·A + B·C = A + AC + AB + BC, and A absorbs AC and AB, leaving A + BC.'
  - text: A·B + C
    why: 'Try A = 1, B = 0, C = 0: the left side is 1 and this is 0 + 0 = 0.'
```

You do not have to trust either the algebra or me. The checker below tries every row of the truth table, which is a proof: for a finite set of cases, checking them all *is* the proof, and mathematicians call it perfect induction. Try the laws from the list. Then type your own pair of expressions, and try to find a pair that looks equal but is not.

::laws-checker{n="11.1" caption="Pick a law, or type two expressions (! for NOT, & or · for AND, | or + for OR, ^ for XOR). The table shows every row; rows where the sides differ are red. The last line is the smallest sum of products, which Chapter 12 explains how to find."}

The distributive law on the right has a Chapter 6 reading. The switch network A + BC has three switches: A in parallel with the series pair B, C. The network (A + B)(A + C) has four: two parallel pairs in series, each containing a copy of A. The law says that they conduct in exactly the same cases, so the four-switch network wastes a switch. Each law is a way to remove hardware without changing what a circuit does.

:::history{year=1854 title="An Investigation of the Laws of Thought" people="George Boole"}
In 1854 George Boole, professor of mathematics at Queen’s College, Cork, published *An Investigation of the Laws of Thought*, in which he wrote logic as algebra.:cite[boole1854]

He had sketched the idea in a short book in 1847, *The Mathematical Analysis of Logic*. His symbols stood for classes of things: *xy* for the things that are both *x* and *y*, and 1 and 0 for everything and nothing. He gave the unfamiliar law *x*² = *x* as the fundamental law of thought, since to select the sheep from a flock of sheep changes nothing. His *+* joined classes that did not overlap, and the inclusive *or* of this chapter was made standard by later logicians, among them William Stanley Jevons and Charles Sanders Peirce.:cite[sep-algebra-logic] Boole had no circuits in mind. Eighty-three years later a graduate student at MIT recognised his algebra in the relay switches of a telephone exchange (Chapter 6).
:::

### Proving by algebra

The laws are there to be used. Chapter 6 claimed that a switch in parallel with a series pair that contains it is pointless. Here is the proof, in four short steps.

```parsons
title: 'Absorption, by algebra'
prompt: 'Put these steps in order to prove A + A·B = A using the laws of the table.'
lines:
  - 'A + A·B = A·1 + A·B'
  - 'A·1 + A·B = A · (1 + B)'
  - 'A · (1 + B) = A · 1'
  - 'A · 1 = A'
distractors:
  - 'A · (1 + B) = A · B'
  - 'A · 1 = 1'
```

The steps use the identity law, the distributive law, the null law (1 + B = 1) and the identity law again. Each step is one change to the expression, and each change is one of the table’s rows applied to part of it: that is what the algebra is for.

## De Morgan and the bubble

The doubt in the opening question has an exact answer, discovered twice: by medieval logicians, and by Augustus De Morgan in 1847. The negation of “a and b” is not “not a and not b”. It is “**not a, or not b**”: AND becomes OR as the negation goes through.

::::equation{#de-morgan caption="De Morgan’s laws. Negating an AND gives the OR of the negations, and negating an OR gives the AND of the negations."}
$$\term{nand}{\overline{A\cdot B}} = \term{orinv}{\bar A + \bar B}\qquad \term{nor}{\overline{A+B}} = \term{andinv}{\bar A\cdot \bar B}$$

```terms
nand:
  label: 'NOT (A AND B)'
  what: The output of a NAND gate. It is 0 only when both inputs are 1.
  why: 'It is false exactly when the AND is true.'
  effect: The 7400 chip of the 1960s had four of these, and the first computers of the integrated age were built from little else.
orinv:
  label: 'NOT A, OR NOT B'
  what: An OR gate whose two inputs are each inverted.
  why: 'The pair is true when at least one of the inputs is 0, which is the same as saying they are not both 1.'
  effect: This is the same function as the NAND, drawn with the bubbles on the inputs instead of the output.
nor:
  label: 'NOT (A OR B)'
  what: The output of a NOR gate. It is 1 only when both inputs are 0.
  why: 'It is true exactly when the OR is false.'
  effect: The Apollo Guidance Computer was built almost entirely from NOR gates.
andinv:
  label: 'NOT A, AND NOT B'
  what: An AND gate whose two inputs are each inverted.
  why: 'Both inputs are 0 exactly when neither is 1.'
  effect: The same function as the NOR, drawn with the bubbles on the inputs.
```
::::

These two rules are :term[De Morgan’s laws]{id=de-morgan}. Here is the same thing in hardware, and it is one of the most useful pictures in logic design. A small circle on a gate’s output means “inverted” (Chapter 9 used it for NAND and NOR). Put the circle on the *inputs* of the opposite gate instead, and you have drawn the same function:

::circuit{src="11-boolean-algebra/circuits/de-morgan.json" title="De Morgan’s twins" n="11.2" mode="logic" speed=1e-6 caption="Click A and B. The NAND on the top row and the OR of two inverters on the bottom row are different circuits with different parts, and their outputs are always the same."}

The rule for :term[bubble pushing]{id=bubble-pushing} has three clauses. *A bubble may be pushed through a gate, from output to inputs or the other way. The gate changes from AND to OR (or back), and every bubble on it flips: a bubble that was there is removed, and a bubble that wasn’t is added. Two bubbles on the same wire cancel, because ¬¬x = x.* You never have to remember the laws as formulae. Draw the gate, move the bubble, and read.

Try it. The figure below starts with three NAND gates wired in a tree, the standard way to build A·B + C·D from NAND gates alone. Drag a bubble across a gate, or click it. Watch the expression, and the truth table that compares each redrawn circuit with the one you started from.

::bubble-pushing{n="11.3" caption="Drag the bubble at the output of the right-hand NAND to the left, across its gate (or click it). The bubbles meet those of the first two NANDs and cancel, and the circuit becomes AND, AND, OR. Try the other circuits, then switch to Edit and add a single bubble: that is not a legal move, and the table turns red."}

:::lab[Push, cancel, break]
1. Start with **NAND–NAND** and click the bubble at the output of the last gate. The gate turns into an OR with bubbles on both inputs, and those bubbles meet the outputs of the first two gates. Two bubbles on a wire cancel, so all of the bubbles vanish. You are left with two ANDs feeding an OR: Y = A·B + C·D, a sum of products. So *two layers of NAND gates are a sum of products*. Click the same gate again: the bubbles come back and it is a NAND–NAND tree once more.
2. Load **AND-OR-INVERT** and push the output bubble of the OR gate back. The OR becomes an AND with a bubble on each input, and the input that comes from the AND gate now carries a bubble at the end of its wire. Click that bubble’s *back* direction (drag it left, or press ← with it focused) to push it back through the AND gate. The expression ends as (¬A + ¬B)·¬C, and the truth table still agrees with the original on all eight rows.
3. Now switch to **Edit** and click one input bubble of the NAND. You have just added a bubble that no rule supports. The comparison turns red and names the first row where the circuit disagrees with the one you began with. This is what the checker is for: the moves are legal because they never change the function, but a slip changes it, and the table catches the slip.
:::

Why does a chip designer care about all this? Because of Chapter 9. A CMOS NAND or NOR gate is four transistors, and an AND or OR is six: a NAND followed by an inverter. The natural gates of the technology are the *inverting* ones. A designer who thinks in ANDs and ORs (because that is how the specification reads) but builds in NANDs and NORs uses bubble pushing to translate, and the result has fewer transistors and is faster, because each inverting gate is a single stage.

:::history{year=1847 title="Formal Logic" people="Augustus De Morgan"}
The rules that carry his name were written down by Augustus De Morgan, professor of mathematics at University College London, in his *Formal Logic* of 1847.:cite[demorgan1847]

The book appeared in the same year as Boole’s first, and the two men were on friendly terms; De Morgan’s own aim was to widen the traditional syllogism, and he stated the laws in words about the “contrary” of a compound and of an aggregate. Versions of them were known to medieval logicians, but De Morgan gave them the place in a system of logic that made them tools.:cite[sep-algebra-logic] It was Boole’s algebra and De Morgan’s laws together that made Shannon’s thesis possible: with them, the mirror image in his hindrance notation (Chapter 6) is a theorem.
:::

:::deeper[Duality and the general De Morgan law]
The duality principle and De Morgan’s laws are two halves of one statement. Write *f*<sup>d</sup> for the **dual** of a function *f*, given by the same expression with every AND and OR swapped (and 0 and 1 swapped). Then for every function built from AND, OR and NOT:

¬*f*(A, B, C, …) = *f*<sup>d</sup>(¬A, ¬B, ¬C, …)

That is, to negate a whole expression, swap AND and OR and negate every variable. The proof is an induction on the expression, and the bubble-pushing rule is its inductive step: a bubble on the output of a gate of any kind moves to its inputs as the gate changes to its dual. So the bubble at the output of a big circuit can be pushed, gate by gate, all the way to its inputs, and as it passes through every gate on the way the whole circuit becomes its dual with complemented inputs.
:::

:::programmer[De Morgan for conditions]
Every programmer meets De Morgan while refactoring conditions. `if (!(x > 0 && y > 0))` is the same as `if (x <= 0 || y <= 0)`: the bubble went through the AND (making it OR) and through each comparison (making `>` into `<=`). (For integers. With floating-point NaN every comparison is false, so this particular rewrite fails: the laws hold for booleans, not for everything a language calls a comparison.) Guard clauses that return early are the same law applied to control flow. If you ever wonder whether a rewrite of a long condition is safe, the laws checker above will tell you in a moment, and unlike a unit test it tests *every* case.
:::

## From a truth table to a circuit

Write a function as a truth table and you can always turn it into a circuit, mechanically, with no cleverness at all. The recipe uses just the three operations.

Look at any row where the function is 1. That row is a particular combination of inputs, say A = 1, B = 0, C = 1. The expression **A · ¬B · C** is 1 for this combination and *for no other*: each :term[literal]{id=literal} (a variable or its complement) is 1 exactly when the row has its value, and the AND is 1 only if all of them are. An AND of literals that is 1 in exactly one row is a :term[minterm]{id=minterm}. Do this for every row where the function is 1 and OR the results. The OR is 1 in exactly those rows. The result is the :term[sum of products]{id=sum-of-products} (SOP) of the function, and, since it was made from the truth table without any choice, it is unique: the *canonical* sum of products.

The number of the row, read as a binary number with A as its top bit, names the minterm: **m<sub>5</sub>** is A·¬B·C (row 101). A function is often written as the list of its minterms, Σ m(3, 5, 6, 7) for the carry-out of a full adder.

The dual recipe starts from the rows where the function is 0. The OR of literals that is 0 in exactly one row is a :term[maxterm]{id=maxterm}: for the row A = 0, B = 1, C = 1 it is **A + ¬B + ¬C**, which is 0 there and 1 everywhere else. AND the maxterms of all the zero rows and you get the :term[product of sums]{id=product-of-sums} (POS), which is 0 exactly where the function is. It is the dual of the first form, and the two are equal: for the carry, Π M(0, 1, 2, 4) = (A + B + C)(A + B + ¬C)(A + ¬B + C)(¬A + B + C), and both expressions are the same function.

Both forms are circuits with two layers: an AND for each term (or an OR, for a POS) feeding one gate of the opposite kind, with inverters on the inputs that need them. The figure builds one from any truth table you enter.

::synthesiser{n="11.4" caption="Click the outputs of the truth table to change them, or pick an example. The expression and the circuit follow. Click a row (or a toggle in the drawing) to see which term fires: its AND gate lights up and lights the OR. Switch between the two canonical forms and the minimised sum of products (Chapter 12)."}

:::lab[Build functions]
1. Pick **Majority**. The sum of products has four terms: rows 3, 5, 6 and 7. Set the inputs to each row in turn and watch *one* AND gate light (two would be a bug: the minterms of different rows are never 1 together, which is why the OR of them is exact). Then choose the *Minimised* form: three terms of two literals, four gates instead of eight, and no inverters.
2. Load **XOR** and switch to *Product of sums*. It is (A + B)(¬A + ¬B): at least one is 1, and at least one is 0. Compare with the sum of products, which is also two terms. XOR is the same size both ways.
3. Choose **4-bit parity** and read the cost line: eight terms of four literals, four inverters and a tree of ORs (gates here have at most four inputs): 15 gates in all. Now click *Minimised*. Nothing gets smaller: no two of the rows can be merged, and parity is the standard example of a function for which two layers of logic are as bad as they can be. Chapter 12 returns to it.
4. Set a truth table with your own pattern of 1s. Any of the 65,536 four-input functions works, and the drawing shows each of them as a circuit of AND, OR and NOT.
:::

This is more important than it looks. It says that **AND, OR and NOT are enough**: whatever function of whatever inputs you wish to build, there is a circuit made of these three gates that computes it. A set of operations with this property is called :term[functionally complete]{id=functionally-complete}. The recipe is not economical (it needs a term for every row), but it always works, and Chapter 12 is about making it economical. It also shows why Part VI is possible. A programmable logic array is a chip with an AND plane, an OR plane and fuses that choose which literals go to which terms: a sum of products, waiting for a truth table.

:::hood[How the synthesiser makes its netlist]
The figure does not draw a diagram of a circuit; it builds the circuit, hands it to the same `Schematic` that draws Chapter 6’s, and lets the digital engine run it. There are three steps.

**1. Terms.** `synthesise` (in `widgets/synth.ts`) turns the rows into lists of literals. A minterm has one literal per variable, and the minimised form (Chapter 12) comes from `quineMcCluskey`. A product of sums uses the same code with every literal flipped, because a maxterm is the complement of a minterm.

**2. A gate network.** `twoLevelDag` creates one inverter per complemented variable and shares it among the terms that use it, one AND (or OR) per term, and one gate of the opposite kind for the whole function. Real gates have a limited number of inputs, so a wide gate becomes a tree of gates of at most four inputs:

```ts
const literal = (l: Lit): string => {
  if (!l.neg) return inputs[l.v]!;
  let id = inverted.get(l.v);
  if (!id) {
    id = `n${l.v}`;
    gates.push({ id, kind: 'not', inputs: [inputs[l.v]!] });
    inverted.set(l.v, id);
  }
  return id;
};
```

**3. Placement.** `layoutDag` (in `widgets/layout.ts`) puts each gate in a column one further right than its deepest input and gives every signal its own vertical track between columns, so that wires that share a track are one net and wires on different tracks cannot touch. The circuit model connects wires by geometry, and a wire end that happens to land on another wire would silently join two signals; the layout rules keep the row on which a signal leaves a column apart from every row on which a different signal enters the next. A test lays out three hundred random networks, flattens each, simulates every input combination on the digital engine and compares with a direct evaluation; a network that the layout got wrong fails there, not in front of you.
:::

## One gate is enough

If AND, OR and NOT are enough, are they all needed? De Morgan’s laws say no. AND can be made from OR and NOT (bubbles on the inputs and the output of an OR are an AND), and OR from AND and NOT. So NOT and one of the other two are enough. Then a more surprising fact.

:::key[NAND is universal]
Every Boolean function can be built from :term[NAND]{id=nand} gates alone, and every function can be built from NOR gates alone. A gate with this property is called **universal**.
:::

The construction takes three lines, and each starts with NAND and ends with a use of bubble pushing.

- **NOT.** Tie the two inputs of a NAND together: ¬(A·A) = ¬A.
- **AND.** A NAND followed by a NOT: ¬¬(A·B) = A·B.
- **OR.** ¬(¬A · ¬B) = A + B, by De Morgan. A NAND whose two inputs have first been inverted.

```quiz
q: 'How many two-input NAND gates does it take to make an OR gate?'
options:
  - text: One.
    why: 'A single NAND gives 1 for A = B = 0, where an OR gives 0, and 0 for A = B = 1, where an OR gives 1. It is the opposite of an OR in those two rows, so it needs more.'
  - text: Two.
    why: 'Two would give a NOT of a NAND, which is an AND. The OR needs each input inverted first, and that is one gate each.'
  - text: Three.
    correct: true
    why: 'One to invert A, one to invert B, and one NAND of the two inverted signals: ¬(¬A · ¬B) = A + B.'
```

::circuit{src="11-boolean-algebra/circuits/nand-only.json" title="Everything from NAND" n="11.5" mode="logic" speed=1e-6 caption="Three circuits, each made only of NAND gates. Try all four combinations of A and B: the top output is the NOT of A, the middle one A AND B and the bottom one A OR B. Count the gates: one, two and three."}

NOR is universal for the same reason, with AND and OR exchanging roles (¬(A+A) = ¬A; the OR is a NOR followed by a NOT; and the AND is ¬(¬A + ¬B)). So a factory that can make exactly one kind of gate, in any quantity, can make a computer. In CMOS the NAND is the more popular of the two, because its transistors in series are the n-channel ones, which conduct better than p-channel ones, and the NOR puts the slower p-channel transistors in series. In RTL the parallel transistors of Chapter 8 made the NOR the natural gate, which is why the Moon computer below is built from it.

There is a price. Universality is not efficiency. An AND made of two NANDs takes eight transistors, where the CMOS AND gate (a NAND and an inverter in one) takes six, and an OR made of three NANDs takes twelve. Designers use the inverting gates directly, as in the bubble-pushed circuits above, instead of building AND and OR out of them.

:::history{year=1913 title="Sheffer’s stroke" people="Henry Maurice Sheffer, Charles Sanders Peirce"}
In 1913 the American logician Henry Sheffer published a set of five postulates for Boolean algebra that used a single operation, which he wrote with a vertical stroke.:cite[sheffer1913] His stroke meant “neither … nor” (our NOR), and a footnote remarks that the “not both” form (NAND) would serve as well.:cite[mactutor-sheffer]

Sheffer showed that every connective of logic can be defined from the stroke alone, and his name stuck to the idea, though today “Sheffer stroke” usually means NAND and the NOR is called *Peirce’s arrow*: Charles Sanders Peirce had noticed the same thing around 1880 in a note that stayed unpublished until his papers appeared in the 1930s.:cite[iep-sheffer] The idea is at home in logic; it took the transistor to make it a manufacturing principle. (The logician’s side of the story is told in the sister course *Proofcraft*.)
:::

The most famous computer made of one kind of gate carried astronauts to the Moon. The **Apollo Guidance Computer** used a three-input NOR gate, in the resistor–transistor logic of Chapter 8, as its only logic element. The first version, Block I, was built from about 4,100 integrated circuits with one gate each. Block II, the version that flew the lunar landings, halved the count to about 2,800, each package holding *two* three-input NORs: some 5,600 gates.:cite[shirriff2019] Every instruction, every address calculation and the arithmetic of a landing was made of those gates and nothing else.

:::history{year=1969 title="The Moon computer made of NOR gates" people="Eldon Hall, the MIT Instrumentation Laboratory, Fairchild"}
On 20 July 1969 the lunar module of Apollo 11 landed under the guidance of a computer whose logic was one kind of gate: a three-input NOR, made as an integrated circuit, two to a package, about 2,800 packages in the Block II machine.:cite[shirriff2019]

Eldon Hall, who led the computer’s design at MIT’s Instrumentation Laboratory, describes in his book how the team settled on integrated circuits, then new and untried, and on a single gate type.:cite[hall1996] The reasons are the lesson of this section. One gate type means one circuit to characterise and test, one production line and one spare part, and, by the theorem above, it costs the designer nothing in what can be built. The National Air and Space Museum keeps one of the dual-NOR packages in its collection.:cite[nasm-agc-ic]
:::

### XOR from four NANDs

The exclusive-or is the most useful gate that is not one of the three: 1 when the inputs differ. From the recipe it is A·¬B + ¬A·B, and every one of the operations of that expression is now a NAND. But there is a much better circuit, the classic four-gate XOR:

::circuit{src="11-boolean-algebra/circuits/xor-nand.json" title="XOR from four NANDs" n="11.6" mode="logic" speed=1e-6 caption="The top output is the four-NAND circuit and the bottom one is an XOR gate: click A and B, and check that they agree. Follow the middle NAND (fed by A and B): its output goes to both of the next two, and it is what stops them both answering when A = B = 1."}

To check it, call the first NAND’s output N = ¬(A·B). Take A = 1, B = 0: N is 1, so the second NAND sees 1 and 1 and gives 0, the third sees 0 and 1 and gives 1, and the last NAND, with a 0 among its inputs, gives 1. With A = B = 1, N is 0, which forces both the second and the third NAND to 1, and the last NAND, seeing two 1s, gives 0. With A = B = 0, N is 1 but the second and third NANDs each have a 0 input, so both give 1 and again the output is 0. The output is 1 exactly when A and B differ.

The circuit is small because N is *shared*: computed once and used twice, where the sum of products A·¬B + ¬A·B needs two inverters, two ANDs and an OR of its own. Sharing like this is what Chapter 12 calls *multi-level* logic.

## XOR, XNOR and parity

The truth table of XOR (written A ⊕ B) is the one from the staircase light: 0, 1, 1, 0. It has a family of properties that make it the workhorse of arithmetic and error detection:

- A ⊕ 0 = A, so XOR with 0 passes the value through.
- A ⊕ 1 = ¬A, so XOR with 1 inverts. **An XOR gate is a programmable inverter**, and this is how adders subtract and how a stream of bits is scrambled.
- A ⊕ A = 0. Anything XORed with itself vanishes.
- It is commutative and associative, so A ⊕ B ⊕ C ⊕ … has no ambiguity.

The last property has a consequence: A ⊕ B ⊕ C ⊕ … is 1 exactly when an *odd* number of the inputs are 1. This is the :term[parity]{id=parity} of the inputs, and a chain (or tree) of XOR gates computes it. It is why the staircase light with three switches works (Chapter 6’s challenge) and why a parity bit, one extra bit chosen so that the number of ones in a byte is always even, catches every single-bit error in a memory or on a serial line. XNOR, its negation, is the equality gate: 1 when the two inputs are the same, `a === b` for bits. A row of them compares two words, and Chapter 13 does exactly that.

XOR also has the ugliest sum of products. The four-input parity function, three XOR gates, has the eight-term sum of products of the last lab; every additional input doubles it. That is why designers keep an XOR gate in the library rather than deriving it.

## A programmer’s view

Every bitwise operator in your language is a row of gates. `x & y` on 32-bit integers is 32 AND gates side by side, each taking one bit of *x* and one of *y*; `~x` is 32 inverters; `x ^ y` is 32 XORs. All the bits are computed at once, and nothing about the operation depends on the width. The logical operators `&&`, `||` and `!` are the same gates on a single bit, with one difference that does not exist in hardware:

:::programmer[Short-circuiting does not exist in a circuit]
In `a && f(b)`, the language may skip `f(b)` when `a` is false. That is an optimisation of *time*, and it also makes the expression depend on evaluation order (if `f` has side effects, or divides by zero). A circuit has no order: an AND gate has two wires coming in, and both are always there, computed at the same time by their own hardware. The circuit for `a && f(b)` contains a circuit for `f(b)` that is always running, whatever `a` is. So `a && b` in hardware is *always* the pure function AND, which is why it obeys every law in this chapter without exception.

The `?:` operator, or an `if` that assigns, is a circuit too: `y = s ? b : a` is Y = S·B + ¬S·A, two ANDs and an OR with an inverter, and the reader can build it with the synthesiser (the *Multiplexer* example). Chapter 13 gives it a name and a symbol. Hardware computes *both* branches and then selects: every conditional in a circuit is a selection, never a jump.
:::

## Exercises

```quiz
q: 'Simplify A·B + A·¬B.'
options:
  - text: A
    correct: true
    why: 'A·B + A·¬B = A·(B + ¬B) = A·1 = A, by the distributive, complement and identity laws. Whatever B is, the term with the right B fires when A is 1.'
  - text: B
    why: 'The two terms are A·B and A·¬B: both need A to be 1, so the function is 0 when A is 0 whatever B does.'
  - text: A + B
    why: 'For A = 0 and B = 1 this gives 1, but both product terms are 0 there.'
```

```quiz
q: 'Which of these is NOT equivalent to ¬(A · (B + C))?'
options:
  - text: ¬A + ¬B·¬C
    why: 'Yes it is: De Morgan on the outer AND gives ¬A + ¬(B + C) and again on the OR gives ¬A + ¬B·¬C.'
  - text: ¬A + ¬B + ¬C
    correct: true
    why: 'This one negates the OR as if it were an AND. ¬(B + C) is ¬B · ¬C, not ¬B + ¬C. For A = 1, B = 1, C = 0 the original is 0 and this is 1 (from ¬C).'
  - text: ¬(A·B) · ¬(A·C)
    why: 'Yes it is: A·(B + C) = A·B + A·C by the distributive law, and the negation of the OR is the AND of the negations.'
```

```quiz
q: 'A chip has only two-input NOR gates. How many does it take to make, in this order, a NOT, an AND and an OR (with no sharing between them)?'
options:
  - text: 1, 2 and 3.
    why: 'That count is for NAND. With NOR the roles of AND and OR are swapped.'
  - text: 1, 3 and 2.
    correct: true
    why: 'NOT is a NOR with its inputs tied. OR is a NOR followed by a NOT: two. AND is ¬(¬A + ¬B): a NOT for each input and a NOR, three.'
  - text: 2, 3 and 3.
    why: 'A NOT needs only one NOR, with both inputs connected to the signal.'
```

### Build the parts

These four gates go into your parts bin. Each exercise below is a small circuit editor: pick a gate from the palette, click the canvas to place it, drag from a pin to wire it, and press Check, which tries every row of the truth table. Only the gates the exercise allows are offered, so the constraint is part of the puzzle.

```build
id: boolean/and
title: AND from NAND
part: and
allowed: [nand]
prompt: |
  Build an **AND** gate from **NAND** gates only. The pins A, B and Y are already on the canvas: place gates, wire them, and press Check. When it passes, the circuit goes into your parts bin as **AND**.
hints:
  - A NAND is an AND followed by a NOT. Which gate turns a NAND into an AND?
  - Tie the two inputs of a NAND together and it becomes an inverter.
explain: |
  ¬¬(A·B) = A·B: a NAND, then a NAND wired as an inverter. Two gates, eight transistors in CMOS, where the dedicated AND gate takes six.
solution: {"version":1,"title":"AND from NANDs","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"nand","x":7,"y":3,"label":""},{"id":"g2","type":"nand","x":16,"y":3,"label":""},{"id":"Y","type":"port","x":24,"y":4,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[5,3],[7,3]]},{"points":[[5,5],[7,5]]},{"points":[[13,4],[14,4]]},{"points":[[14,3],[14,5]]},{"points":[[14,3],[16,3]]},{"points":[[14,5],[16,5]]},{"points":[[22,4],[24,4]]}]}
```

```build
id: boolean/or
title: OR from NAND
part: or
allowed: [nand]
prompt: |
  Build an **OR** gate from **NAND** gates only. De Morgan gives you the plan: A + B = ¬(¬A · ¬B).
hints:
  - Each input needs inverting first. That takes one NAND each, with its two inputs tied together.
  - A third NAND joins the two inverted signals.
explain: |
  Three NANDs: two as inverters and one that combines. Bubble pushing says the same: an OR is a NAND with a bubble on each input, and a NAND wired as an inverter *is* a bubble.
solution: {"version":1,"title":"OR from NANDs","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":4,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":6,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"nand","x":9,"y":3,"label":""},{"id":"g2","type":"nand","x":9,"y":8,"label":""},{"id":"g3","type":"nand","x":19,"y":6,"label":""},{"id":"Y","type":"port","x":27,"y":7,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[5,4],[6,4]]},{"points":[[6,3],[6,5]]},{"points":[[6,3],[9,3]]},{"points":[[6,5],[9,5]]},{"points":[[5,6],[7,6]]},{"points":[[7,6],[7,10]]},{"points":[[7,8],[9,8]]},{"points":[[7,10],[9,10]]},{"points":[[15,4],[16,4]]},{"points":[[16,4],[16,6]]},{"points":[[16,6],[19,6]]},{"points":[[15,9],[17,9]]},{"points":[[17,8],[17,9]]},{"points":[[17,8],[19,8]]},{"points":[[25,7],[27,7]]}]}
```

```golf
id: boolean/xor-golf
title: XOR golf
part: xor
par: 4
metric: gates
allowed: [nand]
prompt: |
  Make an **exclusive OR** from NAND gates, with as few gates as you can. Par is four. Think about which NAND could be **shared**.
hints:
  - Start with a NAND of A and B, and see what its output tells the next gates.
  - The classic circuit feeds that first NAND to two more, one that also sees A and one that also sees B.
explain: |
  Four NANDs, with the first shared by two of the others: Figure 11.6. A sum of products for XOR needs two inverters, two ANDs and an OR, and the NAND–NAND translation does no better than five gates.
solution: {"version":1,"title":"XOR from four NANDs","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"nand","x":9,"y":6,"label":""},{"id":"g2","type":"nand","x":20,"y":4,"label":""},{"id":"g3","type":"nand","x":20,"y":9,"label":""},{"id":"g4","type":"nand","x":30,"y":7,"label":""},{"id":"Y","type":"port","x":38,"y":8,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[9,3],[15,3]]},{"points":[[9,10],[15,10]]},{"points":[[5,3],[7,3]]},{"points":[[7,3],[7,6]]},{"points":[[7,6],[9,6]]},{"points":[[7,3],[9,3]]},{"points":[[5,5],[6,5]]},{"points":[[6,5],[6,10]]},{"points":[[6,8],[9,8]]},{"points":[[6,10],[9,10]]},{"points":[[15,3],[16,3]]},{"points":[[16,3],[16,4]]},{"points":[[16,4],[20,4]]},{"points":[[15,7],[17,7]]},{"points":[[17,6],[17,11]]},{"points":[[17,6],[20,6]]},{"points":[[17,11],[20,11]]},{"points":[[15,10],[18,10]]},{"points":[[18,9],[18,10]]},{"points":[[18,9],[20,9]]},{"points":[[26,5],[27,5]]},{"points":[[27,5],[27,7]]},{"points":[[27,7],[30,7]]},{"points":[[26,10],[28,10]]},{"points":[[28,9],[28,10]]},{"points":[[28,9],[30,9]]},{"points":[[36,8],[38,8]]}]}
```

```build
id: boolean/xnor
title: XNOR, the equality gate
part: xnor
prompt: |
  Build the **XNOR** gate: 1 when A and B are **equal**. You may use any of the basic gates.
hints:
  - XNOR is the negation of XOR.
explain: |
  An XOR followed by a NOT. A row of eight of them, and one AND to collect the results, compares two bytes: Chapter 13.
solution: {"version":1,"title":"XNOR","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"xor","x":7,"y":3,"label":""},{"id":"g2","type":"not","x":15,"y":4,"label":""},{"id":"Y","type":"port","x":22,"y":4,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[5,3],[7,3]]},{"points":[[5,5],[7,5]]},{"points":[[13,4],[15,4]]},{"points":[[20,4],[22,4]]}]}
```

```debug
id: boolean/debug-nor
title: A slip in a NOR
prompt: |
  This circuit is meant to be a **NOR**: Y is 1 only when A and B are both 0. Someone pushed a bubble through and forgot the gate. Try the inputs, find the row that goes wrong, and fix the circuit.
spec:
  expression: "Y = !(A | B)"
start: {"version":1,"title":"A NOR with a slip","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"not","x":8,"y":3,"label":""},{"id":"g2","type":"not","x":8,"y":6,"label":""},{"id":"g3","type":"or","x":16,"y":4,"label":""},{"id":"Y","type":"port","x":24,"y":5,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[5,3],[8,3]]},{"points":[[5,5],[6,5]]},{"points":[[6,5],[6,6]]},{"points":[[6,6],[8,6]]},{"points":[[13,3],[14,3]]},{"points":[[14,3],[14,4]]},{"points":[[14,4],[16,4]]},{"points":[[13,6],[16,6]]},{"points":[[22,5],[24,5]]}]}
solution: {"version":1,"title":"NOR","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"not","x":8,"y":3,"label":""},{"id":"g2","type":"not","x":8,"y":6,"label":""},{"id":"g3","type":"and","x":16,"y":4,"label":""},{"id":"Y","type":"port","x":24,"y":5,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[5,3],[8,3]]},{"points":[[5,5],[6,5]]},{"points":[[6,5],[6,6]]},{"points":[[6,6],[8,6]]},{"points":[[13,3],[14,3]]},{"points":[[14,3],[14,4]]},{"points":[[14,4],[16,4]]},{"points":[[13,6],[16,6]]},{"points":[[22,5],[24,5]]}]}
hints:
  - Which rows of the truth table does the circuit get wrong?
  - The inverters put a bubble on each input. What does the gate after them have to be, by De Morgan?
fault: The final gate was an OR. ¬A + ¬B is a NAND; a NOR is ¬A · ¬B, which needs an AND.
```

:::challenge[Build a majority gate from NANDs]
The **majority** of three bits is 1 when at least two of them are 1. Its minimal sum of products is AB + AC + BC. Using De Morgan, draw it as a circuit of NAND gates only, with two layers, and count the gates. (Answer: NAND(A,B), NAND(A,C) and NAND(B,C) feed a three-input NAND: four gates. The bubbles on the outputs of the first layer cancel the bubbles on the inputs of an OR: exactly the NAND–NAND figure above, with three terms instead of two. Check it in the bubble-pushing figure by loading NAND–NAND and picturing a third leg.)
:::

:::challenge[Two-level XOR]
Use the synthesiser to find how many gates a two-level sum of products needs for the 3-input parity function (the *Full-adder sum* example), and compare with two XOR gates. (Answer: three inverters, four ANDs and one OR, a total of eight gates and 19 gate inputs, against two.)
:::

## Build it for real

:::real{parts="74HC00, LED, 1 kΩ resistor, 5 V USB supply module, breadboard, jumper wires"}
**XOR from four NANDs.** The 74HC00 is four two-input NAND gates in one 14-pin package: the gate inputs are pins 1 and 2, 4 and 5, 9 and 10, and 12 and 13; the outputs are pins 3, 6, 8 and 11; pin 7 is ground and pin 14 is +5 V. Wire it as Figure 11.6: call the inputs A and B (two jumper wires that you move between +5 V and ground). Gate 1 is pins 1 and 2 with A on pin 1 and B on pin 2; its output, pin 3, is the shared NAND. Gate 2, pins 4 and 5, takes A on pin 4 and the shared NAND on pin 5. Gate 3, pins 9 and 10, takes B on pin 9 and the shared NAND on pin 10. Gate 4, pins 12 and 13, takes gate 2’s output (pin 6) and gate 3’s (pin 8), and its output on pin 11 drives the LED through the 1 kΩ resistor to ground. Try all four combinations of A and B: the LED is lit when they differ. Every input of every gate is used, so nothing is floating (Chapter 10). Then take out the LED’s wire from pin 11, and put it on pin 3 to see the middle NAND on its own.
:::

## What’s next

We have an algebra, a way to write down any function, and a way to build it from three gates or from one. What we lack is economy. The canonical sum of products of a four-input function can have sixteen terms of four literals each, and the *same* function can very often be written with two terms of two. The laws can do that by hand, but only if you spot the right step, and only a proof tells you when to stop. Chapter 12 turns the search for the smallest circuit into a picture, the Karnaugh map, and then into an algorithm that a computer can run for any number of variables.
