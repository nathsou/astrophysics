---
number: 6
title: Shannon’s switches
summary: Switches in series compute AND, switches in parallel compute OR, the staircase light computes XOR — and a switch worked by electricity lets one circuit control another, which is all a computer needs.
duration: About 1 hour
prerequisites: [relays]
---

Most houses have a staircase with a light switch at the bottom and another at the top. Flip either one and the light changes: on if it was off, off if it was on. Nobody thinks twice about it. But look at it as a programmer: two inputs, one output, and a rule that the output flips whenever *either* input flips. That rule has a name, and the circuit inside the wall is computing it.

```quiz
q: 'The staircase light is on. You flip the switch at the bottom, then your friend at the top flips theirs. What does the light do?'
options:
  - text: It goes off, then comes back on.
    correct: true
    why: 'Each flip changes the light, whatever the other switch is doing. Two flips bring it back to where it started.'
  - text: It goes off and stays off.
    why: 'That would be true if the top switch could only turn the light *on*. But it toggles the light, exactly as the bottom one does.'
  - text: It depends on which way the top switch was pointing.
    why: 'Surprisingly, it doesn’t. Whichever position the top switch is in, flipping it changes the light.'
```

This chapter is about the idea that turns that observation into a method: **a network of switches computes a logical function of the positions of its switches**. Add a switch that is itself worked by electricity, the relay of Chapter 5, and the output of one network can become the input of the next. Then you can build a machine that calculates.

The idea was spotted in 1886, ignored for fifty years, and written down in 1937 by a 21-year-old student in what has often been called the most influential master’s thesis ever written. By the end of the chapter you will have built an adder from nothing but switches, coils and lamps, in the way the first binary adder in America was built: on a kitchen table.

## Two switches, one lamp

Start with the simplest circuit there is: a battery, a lamp and a switch, in a loop. Close the switch and current flows round the loop and the lamp lights. Open it and the loop is broken, so nothing flows anywhere and the lamp is dark. So far a switch is just a gate in a wall.

Now put **two switches** in the same loop, one after the other. Electricians say they are in :term[series]{id=series}.

::circuit{src="06-shannons-switches/circuits/series.json" title="Two switches in series" n="6.1" caption="Click the switches A and B. The current has one path and must pass through both, so the lamp lights only when A and B are both closed."}

If either switch is open, the loop is broken. The lamp lights when A is closed **and** B is closed:

| A | B | Lamp |
|---|---|---|
| open | open | off |
| open | closed | off |
| closed | open | off |
| closed | closed | **on** |

Write 1 for “closed” and for “lit”, and 0 for “open” and “dark”, and this is a :term[truth table]{id=truth-table}: a list of every combination of inputs and the output each one gives. This one is the truth table of **AND**.

Now put the two switches side by side, so that the current has two paths to choose from. They are in :term[parallel]{id=parallel}.

::circuit{src="06-shannons-switches/circuits/parallel.json" title="Two switches in parallel" n="6.2" caption="Click A and B. Either path will do, so the lamp lights when A or B, or both, are closed."}

Now one closed switch is enough, because the current takes whichever path is complete. The lamp lights when A **or** B is closed: the truth table of **OR**. This is the inclusive *or* that programmers write as `||`, not the *either… or* of everyday speech: with both switches closed the lamp is lit, not dark.

The count of lit rows already tells the two apart. With *n* switches there are 2<sup>*n*</sup> combinations, of which a series chain lights the lamp in exactly one (all closed) and a parallel bank in all but one (all open).

:::programmer[Series is `&&`, parallel is `||`]
A network of switches between two terminals is a Boolean expression over its switches, and you can read the expression off the drawing: switches in series are joined by `&&`, branches in parallel by `||`, and brackets follow the nesting. This network conducts exactly when `(A && B) || C`:

```text
     ┌── A ──── B ──┐
  ───┤              ├───
     └──── C ───────┘
```

Going the other way, *any* expression built from variables, `&&` and `||` can be drawn as such a network. Notice what you cannot write with these two operators: `!A`, a switch that conducts when its input is *off*. Hold that thought until the relay.
:::

:::note[Why does the lamp care about both switches?]
Chapter 2’s rule for resistors gives the reason. A closed switch is almost a perfect conductor (the simulator uses 10 mΩ) and an open one is almost a perfect insulator (1 TΩ, a million million ohms). Two of them in series add up to something tiny only if *both* are closed; two in parallel are tiny if *either* is closed. The lamp does not know any logic. It only knows whether the loop it sits in is complete.
:::

::series-parallel{n="6.3" caption="Toggle A, B and C. The expression is the network, and the highlighted path is why the lamp is lit."}

:::lab[Count the lit rows]
Use the figure above. Before you touch a switch, predict how many of the eight combinations light the lamp for `(A && B) || C`. Then click through all eight rows of the truth table and count. (Five: the four rows with C closed, plus the one row with A and B closed and C open.)

Now switch the figure to `A && (B || C)`: A in series with a parallel pair. Predict again before you count. The answer is three: A must be closed, and at least one of B and C. The two networks use the same three switches and differ only in how they are joined, yet they light different rows. Wiring *is* the expression.
:::

:::history{year=1886 title="A letter fifty years early" people="Charles Sanders Peirce, Allan Marquand"}
On 30 December 1886 the philosopher Charles Sanders Peirce wrote to a former student that “electricity would be the best thing to rely on” for a logic machine.

Allan Marquand, at Princeton, had built a mechanical machine that solved simple problems in logic with rods and levers, and Peirce, who had been developing the algebra of logic for two decades, suggested that switching electric circuits would do the same work better. He sketched how switches in series and in parallel correspond to *and* and *or*.:cite[peirce1886] Marquand drew a design for an electrical version the following year, but nothing was built, and the letter lay unread by engineers for half a century.
:::

### Order and grouping do not matter

Series and parallel do not care about order or grouping. A in series with B is the same circuit as B in series with A, and three switches in series are the same however you bracket them. That is why `&&` and `||` are commutative and associative. There are subtler laws too. Put A in parallel with (A in series with B). When A is closed the lamp is lit, and when A is open the lower branch is broken as well, so B can do nothing: `A || (A && B)` is just `A`. That is the *absorption law*, and it is a fact about wires as much as about symbols. Chapter 11 collects all such laws into Boolean algebra. For now, the point is that each law is a way to remove a switch from a circuit without changing what it does.

## The staircase light

Back to the staircase. Two on–off switches cannot do it. In series, the top switch could only ever turn the light *off*; in parallel, only *on*. The trick is a different kind of switch.

A :term[changeover switch]{id=changeover-switch} (single-pole, double-throw, or SPDT) has three terminals. Its common terminal C is always connected to one of the other two: to 0 in one position, to 1 in the other. It does not turn anything on or off. It *chooses a path*. Wire two of them back to back, with two wires between them that electricians call the **:term[travellers]{id=traveller}**, and you have this:

```quiz
q: 'Both switches start at position 0 and the lamp is lit. Before you try it: how many of the four combinations of the two switches light the lamp?'
options:
  - text: One, like the series circuit.
    why: 'Then flipping one switch from the lit state could never turn the lamp off and on again the way a staircase does. Count again: two switches, each in two positions.'
  - text: Two.
    correct: true
    why: 'The lamp is lit when the two switches point to the same traveller (0 and 0, or 1 and 1) and dark when they differ. Half the rows.'
  - text: Three, like the parallel circuit.
    why: 'Parallel lights all but one row. Here each flip toggles the lamp, so exactly half the rows can be lit.'
```

::circuit{src="06-shannons-switches/circuits/staircase.json" title="The staircase light" n="6.4" current=true caption="Click either switch (the little levers). Write the truth table before you check it. The lamp starts lit, with both switches at 0."}

Follow the current from the battery: into the common terminal of the bottom switch, along whichever traveller it has chosen, then into the top switch, which completes the path only if it has chosen the *same* traveller. So the lamp is on when both switches are in the same position:

| Bottom | Top | Lamp |
|---|---|---|
| 0 | 0 | **on** |
| 0 | 1 | off |
| 1 | 0 | off |
| 1 | 1 | **on** |

This is **:term[XNOR]{id=xnor}**, “equals”: the lamp shows whether the two switches agree. Swap the two travellers at one end and it becomes **:term[XOR]{id=xor}**, “differs”. Either way, flipping any one input flips the output, which is precisely what a staircase needs. It is also the heart of binary addition, as you will see at the end of the chapter.

:::real{parts="2 × SPDT slide switches, 2 × AA cells in a holder, LED, 330 Ω resistor, breadboard"}
The staircase circuit works at any voltage, so it makes a safe first build. Wire the two switches’ common pins to the battery and the LED (with the 330 Ω resistor in series; Chapter 7 explains why an LED needs one), and connect the switches’ other pins in pairs with two wires. Check it against the table above. A household staircase light is exactly this circuit at mains voltage, with the two travellers running through the wall. Do not open one up.
:::

## Negation needs a relay

Series and parallel give you AND and OR, and you cannot get NOT out of them. Every switch so far conducts *more* when you close it, so no arrangement of them can make a lamp go *out* when a switch is closed. (The staircase seems to escape, since flipping a switch can put the lamp out. But that is only because a changeover switch already contains a negation: it closes one path at exactly the moment that it opens the other.)

There is also a deeper problem. In every circuit so far a finger works the switches and a lamp displays the result. The output cannot work another switch, so you cannot build in stages: the answer to one calculation cannot be the question of the next.

The **relay** of Chapter 5 solves both problems at once. Its coil is worked by *current*, and its contacts are switches, including a :term[normally closed]{id=normally-closed} contact (NC), which conducts when the coil is *off* and breaks when it is on. Here is a NOT gate:

::circuit{src="06-shannons-switches/circuits/relay-not.json" title="A relay NOT gate" n="6.5" caption="Close the switch. The coil pulls the armature away from NC and the lamp goes out. Open it again and the lamp relights: the lamp shows NOT A."}

Two things in this figure are new. The **+6 V** symbols are the battery’s positive terminal, drawn as a symbol instead of a wire to save space; every one of them is the same wire, and ground is the return. And the small diode across the coil is the flyback diode of Chapter 5: it gives the collapsing magnetic field somewhere to go when the switch opens, and has no effect on the logic. (Delete it in your head, and the simulator warns you about a 600 V spike.)

There are two supplies here: the one that works the coil and the one that lights the lamp. They happen to be the same voltage, but the coil circuit and the lamp circuit are otherwise separate. That is what a relay is: a way for one circuit to control another.

And because a relay’s contact can switch current into *another relay’s coil*, one relay circuit can drive the next. That is the missing ingredient: a network whose output feeds another network, and another, as deep as you like.

```quiz
q: 'In the next figure, each relay’s NC contact feeds the coil of the next relay, and the last one lights the lamp. With A open, is the lamp on or off?'
options:
  - text: Off.
    why: 'Follow it stage by stage. Each relay inverts the signal it is given; three inversions is an odd number, so the lamp shows the opposite of A, and A is open (0).'
  - text: On.
    correct: true
    why: 'A open → relay 1 off → its NC is closed, so relay 2 is on → its NC is open, so relay 3 is off → its NC is closed and the lamp is lit. Three inversions of 0 give 1: NOT NOT NOT A is the same as NOT A.'
  - text: It flickers, because the relays fight.
    why: 'No fight: each relay has its own coil and its own supply. Every stage is settled before the next one moves.'
```

::circuit{src="06-shannons-switches/circuits/relay-chain.json" title="Relays driving relays" n="6.6" speed=0.02 caption="This figure runs 50 times slower than real life, so you can watch the ripple. Close A: relay 1 moves, then 2, then 3, and only then does the lamp fade out. Each stage inverts, so three stages are the same as one."}

Two things are worth noticing here. First, every stage has its own supply: the lamp at the end is powered by the battery, not by your finger and not by the first switch. However long the chain, the signal reaches the end at full strength. That property, called :term[restoration]{id=restoration} (or *gain*), is what makes deep logic possible, and Chapter 8 shows that it is the whole reason digital circuits work at all.

Second, the chain is *slow*. Each relay takes about 5 ms to move, and each must wait for the one before it. The simulator’s relays take about 14 ms to send a change from A to the last contact (you can measure it on the figure), so a signal passing through a thousand relays would take several seconds. Keep that number in mind.

## Shannon’s algebra

In 1936 Claude Shannon, fresh from a double degree in mathematics and electrical engineering at the University of Michigan, went to MIT as a research assistant on Vannevar Bush’s differential analyser, a room-sized mechanical computer for solving differential equations, controlled by a large panel of relays. Designing relay circuits was then a craft: engineers drew them by trial and error, and had no way of knowing whether a circuit was the simplest that would do the job.

Shannon had taken a philosophy course that included George Boole’s algebra of logic, and he noticed that it was exactly the tool relay designers lacked. His master’s thesis, *A Symbolic Analysis of Relay and Switching Circuits*, showed three things.:cite[shannon1938]

1. **Every series–parallel network is an expression, and every expression is a network.** This is the correspondence of the programmer’s box above.
2. **The laws of Boolean algebra are circuit transformations.** If two expressions are equal, their circuits are interchangeable. You can simplify a circuit by simplifying its expression, on paper, and *prove* that the simpler circuit does the same job.
3. **Design can run backwards.** Write down what you want a circuit to do as logic, manipulate the expression, and draw the circuit. The thesis includes an electric combination lock and a circuit that adds binary numbers.

:::history{year=1937 title="The most influential master’s thesis" people="Claude Shannon"}
Shannon submitted his thesis to MIT on 10 August 1937. He was 21.

Published in a shortened form in the *Transactions of the American Institute of Electrical Engineers* the following year, it won him the 1940 Alfred Noble Prize. It is hard to overstate what it did: circuit design became something you could reason about, calculate and verify, and every digital circuit since, including the chip that is displaying this page, has been designed with Shannon’s method. Howard Gardner called it “possibly the most important, and also the most famous, master’s thesis of the century”.:cite[shannon1938]
:::

:::note[Shannon’s hindrances]
Shannon’s notation was the mirror image of ours. He described each switch by its **:term[hindrance]{id=hindrance}**: 0 when closed (no hindrance to current) and 1 when open. In that convention series connection is **addition** (two switches in series have no hindrance only if both have none) and parallel connection is **multiplication**. It is the same algebra seen in a mirror. De Morgan’s laws, which Chapter 11 covers, *are* the mirror. Engineers soon adopted the modern convention, in which 1 means “conducts”, and so does this course.
:::

:::bio{name="Claude Elwood Shannon" born=1916 died=2001}
Mathematician and engineer, born in Petoskey, Michigan. After the thesis he wrote a doctorate on the algebra of genetics, worked on fire control and cryptography at Bell Labs during the Second World War, and in 1948 published *A Mathematical Theory of Communication*, which defined the bit and founded information theory. He also built a mechanical mouse that found its way through a maze, juggling machines, and a box whose only function, when you switched it on, was to switch itself off.
:::

## The kitchen-table adder

At almost the same moment, and independently, a mathematician at Bell Telephone Laboratories in New York arrived at the same idea from the other direction. George Stibitz was studying the relay switching systems of the telephone network. In November 1937 he took some discarded relays home, and on his kitchen table, with dry cells, torch bulbs and strips of metal cut from a tobacco tin, he wired up a circuit that added two one-digit binary numbers and showed the answer on two bulbs. His colleagues called it the **Model K**, for kitchen.:cite[chm-stibitz]

To add two binary digits you need two outputs: the **sum** digit, and the **carry** into the next column.

| A | B | Carry | Sum |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 0 |

Read down the columns. The carry is 1 only when both inputs are: that is AND, two contacts in series. The sum is 1 when the inputs differ: that is XOR, a staircase circuit. So a :term[one-bit adder]{id=half-adder} is a staircase circuit and a series circuit sharing the same two inputs. But the two inputs are worked by hand, and each has to work a staircase contact *and* a series contact. One switch cannot move two contacts of different circuits.

A relay can. Each input switch works **two relays**, and each relay’s contacts sit in its own circuit. The relays RA1 and RA2 follow switch A; RB1 and RB2 follow switch B. RA1 and RB1 are wired as the staircase. RA2 and RB2 are wired in series.

::circuit{src="06-shannons-switches/circuits/model-k.json" title="The Model K, rebuilt" n="6.7" caption="Click the switches A and B. The lamp Carry is fed through two contacts in series (AND). The lamp Sum is fed through two changeover contacts (XOR). Flags with the same name are the same wire: A, B, the travellers T0 and T1, and the middle wire P."}

Nothing in that figure is new: it is Figure 6.1’s series circuit and Figure 6.4’s staircase, each contact now worked by a relay coil instead of a finger. The flags are there only to keep the drawing readable: everything named T0 is one wire, and so is everything named T1, and RA1’s contacts are joined to RB1’s by them exactly as the travellers joined the two switches of the staircase. The travellers are crossed, which turns the staircase’s XNOR into the XOR that the sum needs.

```quiz
q: 'In the Model K, which two circuits from this chapter compute the sum and the carry?'
options:
  - text: 'Sum: switches in parallel (OR). Carry: switches in series (AND).'
    why: 'OR gives 1 + 1 = 1, but in binary 1 + 1 = 10: the sum digit is 0 and the carry is 1.'
  - text: 'Sum: the staircase (XOR). Carry: switches in parallel (OR).'
    why: 'The carry must be 0 when only one input is 1. An OR would light it.'
  - text: 'Sum: the staircase (XOR). Carry: switches in series (AND).'
    correct: true
    why: 'The sum digit is 1 when exactly one input is 1. The carry is 1 when both are.'
```

:::lab[Watch the relays]
Set the speed slider on Figure 6.7 to 0.01×, which turns 5 ms into half a second. Then:

1. Close A. Watch the two A relays: the armature moves, and the sum lamp follows a moment later. Notice how *little* time passes between “switch closed” and “relay pulled in” compared with how long the lamp takes to glow. The relay is quick; the filament is slow.
2. Close B as well. Which relays move? Which lamp goes out, and which comes on? (Sum goes out and carry comes on: 1 + 1 = 10.)
3. Turn on the current dots. The carry lamp’s current has to pass through two contacts in series, and both must be closed. Open A, and see how the current stops at the first open contact.
4. Set the speed back to 1× and try all four combinations against the table above.

Look closely at the moment a relay pulls in, and you will see its contact *bounce*: it makes and breaks a few times in the first millisecond. The simulator does that on purpose, because real contacts do, and it is the reason Chapter 4 ended with debouncing.
:::

:::history{year=1937 title="The Model K" people="George Stibitz"}
Stibitz’s adder was built in November 1937 from relays thrown away at Bell Labs, dry cells, torch bulbs and strips cut from a tobacco tin, and it added two binary digits.

It was a toy, but it convinced Bell Labs that relays could do arithmetic. A few years later Stibitz and the switching engineer Samuel Williams built the relay-based Complex Number Calculator, which first ran in New York in January 1940. In September 1940 Stibitz took a teletype to a mathematics meeting at Dartmouth College and let the audience send it problems over a telegraph line to the machine in New York, some 400 km away. It answered in about a minute. It is often called the first remote use of a computer.:cite[chm-stibitz]
:::

## Computers made of relays

Once you can build AND, OR and NOT, and wires that carry the result of one stage to the next, you can build anything a computer does. Chapters 11–23 show how. The engineers of the late 1930s and 1940s did it with relays.

- **Konrad Zuse’s Z3**, completed in Berlin in 1941, used about 2,600 relays. It is often described as the first working, programmable, fully automatic digital computer.:cite[zuse-z3]
- **Harvard’s Mark II** (1947) was made of relays too. On 9 September 1947 its operators found a moth trapped between the contacts of relay 70 in panel F.:cite[nmah-bug]

:::history{year=1941 title="The Z3" people="Konrad Zuse"}
Konrad Zuse built the Z3 in a Berlin workshop with almost no money, and it was working by May 1941.

It read a program from punched film, calculated in binary floating point, and was built from about 2,600 relays: roughly 600 in the arithmetic unit, 1,400 in the memory and the rest in the control unit. An addition took about a second and a multiplication about three. The original was destroyed in a bombing raid in 1943; Zuse built a replica in 1961, now in the Deutsches Museum in Munich.:cite[zuse-z3]
:::

:::history{year=1947 title="The first actual bug" people="The Harvard Mark II operators"}
The Mark II’s operators taped a moth into their logbook on 9 September 1947 and wrote “First actual case of bug being found”.

A relay computer was a room full of clicking contacts, and anything that got between a contact and its partner stopped the machine. The page, with the moth still taped to it, is now in the Smithsonian’s National Museum of American History.:cite[nmah-bug] Grace Hopper, who worked at the Harvard computing laboratory, loved to tell the story. The word *bug* for a fault was already old engineering slang, and the joke was that this one was literal.
:::

Relays have two weaknesses. They are **slow**: a relay takes milliseconds to move, so relay computers ran at a few to a few dozen operations per second. And they **wear out**: every operation flexes a spring and hammers a contact. To go faster, computing needed a switch with no moving parts, worked by electricity alone, that could switch millions of times a second without tiring. The rest of Part II builds that switch, starting with the strange materials that make it possible.

:::hood[How the simulator sees your switches]
The live circuits in this chapter run on the course’s analog engine, which knows nothing about logic. It knows *conductances*. A closed switch is a resistor of 10 mΩ, and an open one a resistor of 1 TΩ, and the engine solves the resulting network of resistors exactly as Chapter 2 did. AND and OR are not programmed anywhere: they are what Kirchhoff’s laws give you. Here is the whole model of a switch (`src/lib/sim/analog/models/switches.ts`):

```ts
registerAnalogModel('switch', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const g = () => (bool(p, 'closed') ? G_CLOSED : G_OPEN);
  return {
    stamp(c) {
      conductance(c, a, b, g());
    },
    ...
```

`G_CLOSED` is 100 siemens (10 mΩ) and `G_OPEN` is 10⁻¹² siemens. A click on the schematic calls `setParam('closed', …)` and the next step re-stamps the conductance.

The relay is where the time comes in. Its coil is an inductor, so the current builds up over a time L/R, here 0.1 H / 70 Ω = 1.4 ms. The armature is a two-state machine with hysteresis, watching the coil current:

```ts
const RELAY_PULL_IN = 0.7;
const RELAY_DROP_OUT = 0.3;
…
const rated = Math.max(1e-9, num(p, 'coilVoltage', 5) / Rc());
const i = Math.abs(coil.i);
if (!energised && i >= RELAY_PULL_IN * rated) {
  energised = true;
  plan(c.t, true);
} else if (energised && i <= RELAY_DROP_OUT * rated) {
  energised = false;
  plan(c.t, false);
}
```

When the current passes 70 % of its rated value (6 V / 70 Ω = 86 mA) the relay pulls in; it lets go only when the current has fallen below 30 %. The gap is hysteresis, and it stops a relay from chattering when its coil voltage hovers near the threshold. Crossing the threshold does not move the contacts at once. It *schedules* two events:

```ts
function plan(t: number, on: boolean): void {
  const op = Math.max(1e-6, num(p, 'operateTime', 0.005));
  const opening: RelayEvent['contact'] = on ? 'nc' : 'no';
  const closing: RelayEvent['contact'] = on ? 'no' : 'nc';
  events = [
    { t: t + 0.3 * op, contact: opening, closed: false },
    { t: t + op, contact: closing, closed: true },
  ];
```

The contact that opens does so 30 % of the way through the operate time, and the one that closes does so at the end, so there is a moment (3.5 ms with the default relay) in which the common contact touches neither. The relay *breaks before it makes*. The engine is told about each scheduled event through a `breakpoint`, so that a time step ends exactly at the moment a contact changes, and the analysis is never smeared across a switching instant. Chapter 5’s box tells the rest of the story: the flyback spike, and the bounce that follows `closing`.
:::

## Exercises

```quiz
q: 'A lamp is wired through switch A in series with a parallel pair of switches B and C. For which positions is it lit?'
options:
  - text: 'A, or B and C'
    why: 'That would be A in parallel with the series pair B and C.'
  - text: 'A and B, or A and C'
    correct: true
    why: 'The current must pass A, then either B or C: `A && (B || C)`, which is the same as `(A && B) || (A && C)`.'
  - text: 'Only when A, B and C are all closed'
    why: 'B and C are in parallel, so only one of them needs to be closed.'
```

```quiz
q: 'Why can’t a network of hand-worked on–off switches compute NOT A?'
options:
  - text: 'Because closing a switch can only make more paths, never fewer: the lamp can go from dark to lit but never the other way.'
    correct: true
    why: 'Series–parallel networks are *monotone*: closing a switch never breaks a path. NOT needs a contact that opens when its input turns on, like the normally-closed contact of a relay.'
  - text: 'Because the battery would be short-circuited.'
    why: 'No. The problem is that no arrangement of normally-open switches conducts *less* when one of them is closed.'
  - text: 'Because NOT needs two batteries.'
    why: 'A relay NOT gate works from one supply, or from two, as in Figure 6.5. That is not the issue.'
```

```quiz
q: 'You want a lamp that is lit when A is closed and B is open. What is the least you need?'
options:
  - text: 'A and B in series.'
    why: 'That lights the lamp when both are closed, not when B is open.'
  - text: 'A and B in parallel.'
    why: 'That lights the lamp when either is closed, including when B is closed as well.'
  - text: 'A in series with the normally-closed contact of a relay whose coil is worked by B.'
    correct: true
    why: 'The relay contact conducts when B is off, so the series pair conducts exactly when A is closed and B is not: `A && !B`. This is the smallest circuit, but it needs a relay, which is a negation.'
```

:::challenge[A full adder]
The Model K adds two bits. To add two *numbers* of several bits, each column must add three: A, B and the **carry in** from the column to its right. The truth table has eight rows, and two outputs.

- The **carry out** is 1 when at least two of the three inputs are 1. That is a series–parallel network: `(A && B) || (Cin && (A || B))`. Draw it, and check that it is 1 on exactly four of the eight rows.
- The **sum** is 1 when an *odd* number of the three inputs are 1. This one is not series–parallel, but you have met it: it is a staircase with three switches. Household wiring puts an *intermediate* switch between the two changeover switches. In one position it passes the two travellers straight through; in the other it crosses them. Draw the three-switch staircase, and check that flipping any one switch flips the lamp.

Chapter 14 builds the full adder from gates and chains several of them into a ripple-carry adder.
:::

## What you have now

You now have the whole logical toolkit of a computer, built from switches and lamps:

| Function | Built from | In maths | In code |
|---|---|---|---|
| AND | switches in series | A · B | `a && b` |
| OR | switches in parallel | A + B | `a \|\| b` |
| NOT | a normally-closed relay contact | ¬A | `!a` |
| XOR | two changeover contacts, travellers crossed | A ⊕ B | `a !== b` |
| XNOR | two changeover contacts, travellers straight | ¬(A ⊕ B) | `a === b` |

What is more, relays give you stages, each stage restoring the signal to full strength. What you do not have is speed. Every relay takes several milliseconds to move, and every operation wears out its contacts.

:::real{parts="2 × 5 V relay (SPDT), 2 × 1N4148 diode, LED, 330 Ω resistor, 5 V USB supply module, 2 × pushbutton or toggle switch"}
A relay AND or OR gate needs nothing more than the parts in Figure 6.5, plus a second relay. For AND, put the contacts of two relays in series; for OR, in parallel. Give each coil its own switch, and put a 1N4148 diode across each coil, its stripe (cathode) towards the positive side: without it the collapsing field will produce a spike of a few hundred volts every time you open the switch. Light an LED, through the 330 Ω resistor, from the 5 V supply through the contacts. Hold the switches in each of the four positions and compare the LED with the truth tables. The click you hear is the armature: it is the sound of a logic gate, and it is the sound the first computers made.
:::

## What’s next

A relay is a switch worked by electricity, but it is also a hand-made mechanism, and its speed is limited by the time an armature takes to travel. To go faster the switch must lose its moving parts. Chapter 7 starts the search for one in the physics of silicon: what a semiconductor is, why a crystal that hardly conducts can be made to conduct in one direction only, and what happens when you build a diode.
