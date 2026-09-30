---
number: 19
title: State machines
summary: A drawing of bubbles and arrows becomes flip-flops and gates. Moore and Mealy machines, the three ways to number the states, and the same machine written as a match in DCL.
duration: About 2 hours
prerequisites: [registers-and-counters]
---

A turnstile at a station has two states and two things that can happen to it. **Locked**: a push does nothing, a coin unlocks it. **Unlocked**: a coin does nothing (you have paid already), a push lets you through and locks it again. There is nothing else to the machine. It does not count the people who pass and it does not know the time. It only *remembers which of two situations it is in*, and what it does next depends on that memory and on what has just happened.

Every counter and register of the last chapter was a memory that changed in one fixed way. This chapter is about memories that change *in response to something*, which is the difference between a stopwatch and a turnstile. A circuit made of a register and some logic that decides what to put in it is called a **state machine**, and nearly every piece of digital hardware that does more than one thing, from a keyboard controller to the control unit of the CPU you build in Part V, is one.

## A turnstile remembers

Here is the turnstile as a circuit. One flip-flop holds the state (1 means unlocked) and a little logic decides what it should hold after the next clock edge. Before you touch it, think about the coin and the push arriving in the *same* clock cycle at a locked turnstile.

```quiz
q: 'The turnstile is locked, and in the same clock cycle someone drops in a coin and someone else pushes the bar. What state is it in after the next clock edge?'
options:
  - text: Locked, because the push arrived and locked it.
    why: 'A push locks an *unlocked* turnstile. A locked one has nothing to lock, so the push does nothing.'
  - text: Unlocked, because the coin counts and the push does not.
    correct: true
    why: 'From Locked the only arrow that leaves is the coin, and the push is ignored there. In the drawn circuit the next state is `coin OR (unlocked AND NOT push)`: with the coin present the OR is 1 whatever the rest says.'
  - text: Undefined, because two inputs changed at once.
    why: 'Only for a circuit with no clock. A synchronous machine looks at its inputs once per cycle, at the edge, and every combination of inputs means something.'
```

::circuit{src="19-state-machines/circuits/turnstile.json" title="A turnstile" n="19.1" mode="logic" speed=1e-6 caption="Flip the coin and push switches, then hold the clock-edge button: the state changes only at the edge. Try coin and push together while locked, and a push while unlocked. The flag U is the flip-flop's output, brought back to the AND gate."}

Read the drawing as a loop: the flip-flop's output goes into the logic, the logic's output goes into the flip-flop, and the clock decides when the answer is taken. That is the whole of a synchronous state machine, and it has the same shape whatever the machine does:

```text
                ┌─────────────────────┐
   inputs ─────▶│    next-state       │───▶ D  ┌───────────┐
                │      logic          │        │ flip-flops│──▶ state
        ┌──────▶│                     │        │  (clock)  │──┐
        │       └─────────────────────┘        └───────────┘  │
        │                                                     │
        └─────────────────────────────────────────────────────┘
                            state ──▶ output logic ──▶ outputs
```

The :term[state]{id=state} is whatever the flip-flops hold. With *n* flip-flops a machine has at most 2<sup>*n*</sup> states, and it can be in only one of them at a time. The machine changes state only at clock edges, and the **next-state logic** is an ordinary combinational circuit: Chapters 11 and 12 built and shrank those.

## Diagrams and tables

Nobody designs a machine by writing its gates first. You draw its states as bubbles and its changes as arrows, and only then turn the drawing into logic. This is a :term[state machine]{id=state-machine} (also *finite-state machine*, FSM, or *finite automaton*): a finite set of states, a start state, and a rule that says, for every state and every input, which state comes next and what the outputs are.

The turnstile's drawing has two bubbles, and the same information can be written as a :term[state table]{id=state-table}, one row per state and input combination:

| State | coin | push | Next state |
|---|---|---|---|
| Locked | 0 | – | Locked |
| Locked | 1 | – | Unlocked |
| Unlocked | 1 | – | Unlocked |
| Unlocked | 0 | 0 | Unlocked |
| Unlocked | 0 | 1 | Locked |

A dash means "either". The table is complete: it says what happens for every combination, and a table with a gap would be a machine that does something unspecified. The designer later in this chapter fills the gaps for you with one rule: **an input combination with no arrow leaves the machine where it is**. That is why the turnstile needs only two arrows.

:::programmer[A state machine is a `switch` in a loop]
Software people write state machines all the time, usually without the name: a parser, a protocol handler, a regular expression engine, a game character with an `IDLE`, `JUMPING` and `FALLING` mode. The pattern is a variable holding the state and a `switch` on it inside a loop:

```ts
type State = 'Locked' | 'Unlocked';
let state: State = 'Locked';

function tick(coin: boolean, push: boolean): void {
  switch (state) {
    case 'Locked':   state = coin ? 'Unlocked' : 'Locked'; break;
    case 'Unlocked': state = !coin && push ? 'Locked' : 'Unlocked'; break;
  }
}
```

In hardware the loop is the clock, the variable is the register, and the `switch` is the next-state logic. One difference matters: software evaluates *one* `case`. Hardware evaluates *all* of them at once, every cycle, and a multiplexer picks the answer for the current state. That is why, later in the chapter, the same machine will be written as a `match`.
:::

## Two kinds of output

A machine is only useful if it does something to the outside world, so it needs outputs. There are two ways to compute them, and they differ in *when* the output can change.

- In a :term[Moore machine]{id=moore-machine} the output depends on the **state alone**. It changes only just after a clock edge, when the state changes. The turnstile's `unlocked` lamp is a Moore output: it is the flip-flop itself. On a diagram the output is written *inside the bubble*.
- In a :term[Mealy machine]{id=mealy-machine} the output depends on the state **and the inputs**. It can change the moment an input changes, in the middle of a cycle. On a diagram the output is written *on the arrow*, after a slash: `coin/1` means "when coin is 1, take this arrow and output 1".

A concrete case shows the difference. An *edge detector* produces a one-cycle pulse when its input goes from 0 to 1. The Mealy version remembers the previous input and outputs `IN AND NOT previous`: the pulse appears in the same cycle in which the input rose. The Moore version cannot do that, because its output may not look at the input; it has to wait until the flip-flop has *recorded* that the edge happened, and pulses one cycle later. Make a prediction, then look.

```quiz
q: 'In the circuit below, IN rises between two clock edges. The Mealy output is IN AND NOT previous; the Moore output is that same signal passed through one flip-flop. When does each output pulse, relative to the clock edge that follows the rise of IN?'
options:
  - text: The Mealy output pulses before that clock edge, and the Moore output for one cycle after it.
    correct: true
    why: 'The Mealy output is combinational in IN, so it goes high as soon as IN does, before the edge, and falls again when the edge updates the previous-input flip-flop. The Moore output is registered: it goes high just after the edge and stays for one cycle.'
  - text: Both pulse together, after the clock edge.
    why: 'Only the registered (Moore) one does. The Mealy output has a combinational path from IN and reacts at once.'
  - text: The Moore output pulses first, since its flip-flop is closer to the clock.
    why: 'A flip-flop can only report at an edge, and it needs the edge to capture IN. It can never be earlier than the combinational path.'
```

::circuit{src="19-state-machines/circuits/edge-detector.json" title="Mealy and Moore" n="19.2" mode="logic" speed=1e-7 window=800e-9 traces="CLK,IN,MEALY,MOORE" caption="Toggle IN a few times while the clock runs and read the timing diagram. The amber Mealy pulse begins as soon as IN rises and ends at the next clock edge; the green Moore pulse begins at that edge and lasts a whole cycle. Try a very short pulse on IN: the Mealy output shows it, whether or not an edge comes."}

Which is better? Each has a price.

- A Mealy machine reacts a cycle sooner and usually needs **fewer states**: its output can vary with the input, so states need not be split just to remember "what I am about to output". The 1011 detector you will meet below needs 4 states as a Mealy machine and 5 as a Moore machine.
- A Moore machine's outputs come straight from flip-flops (or from logic on them alone), so they are **stable for the whole cycle**. A Mealy output is a function of the inputs, and if the inputs glitch (Chapter 15) so does the output. Worse, an input that arrives late eats into the time budget of whatever reads the output. The rule of thumb is that Moore outputs are for anything that *acts*, such as a write strobe, a clock enable or a motor driver, and Mealy outputs are for signals that are sampled, and only registered inputs should feed them.

Any Mealy machine can be converted into a Moore machine, and the recipe is worth knowing: **every state must be split by the output that leads into it**, since a Moore state has exactly one output. The designer below has a *Moore ⇄ Mealy* switch that does it for you, and lets you count the extra states.

:::history{year=1955 title="Huffman, Mealy, Moore" people="David Huffman, George Mealy, Edward Moore"}
The idea that a switching circuit with memory is a machine with states came together in three papers in three years. David Huffman, at MIT, published *The synthesis of sequential switching circuits* in 1954: he showed how to reduce a description of a circuit's behaviour to its smallest table of states and then to gates.:cite[huffman1954] George Mealy, at Bell Laboratories, published *A method for synthesizing sequential circuits* in the *Bell System Technical Journal* in September 1955, treating machines whose outputs depend on state and input together.:cite[mealy1955] Edward Moore, also at Bell Labs, wrote *Gedanken-experiments on sequential machines* for the volume *Automata Studies* (1956), where the output depends on the state alone and the question is what can be learned about a machine by experimenting with its inputs and outputs.:cite[moore1956] Their names stuck to the two kinds of output ever since.
:::

## From bubbles to gates

Turning a diagram into a circuit is a procedure with four steps, and every step is something you know already.

1. **Choose a code for each state.** With *n* flip-flops you can name up to 2<sup>*n*</sup> states. Which name goes to which state is up to you, and it matters (next section).
2. **Write the truth tables** of the next-state bits and of the outputs, as functions of the state bits and the inputs. This is the state table with the state names replaced by their codes.
3. **Minimise** those functions (Chapter 12). Codes that no state uses are *don't-cares*: the machine will never be there, so the logic may do anything in those rows.
4. **Build:** one D flip-flop per state bit, with the minimised next-state functions on the D inputs.

Here is the whole thing done for a traffic light. The British sequence is red, red and amber together, green, amber, and red again, so four states in a ring, and one input, `tick`, that comes from a slow clock and says "move on now". It is a Moore machine: each bubble gets its lamps.

The states are in a ring, so number them in **Gray code** (00, 01, 11, 10, Chapter 12): each step changes one bit. Write the codes as Q1 Q0. Then the next state, when `tick` is 1, is Q1' = Q0 and Q0' = NOT Q1: the pair of bits just *rotates*, with a twist. When `tick` is 0 both flip-flops must hold, and this is a job for a flip-flop with an enable, which loads its D input only when EN is 1. The lamps come from the state bits: **red = NOT Q1**, **amber = Q1 ⊕ Q0**, **green = Q1 · Q0**.

::circuit{src="19-state-machines/circuits/traffic-light.json" title="A traffic light in two flip-flops" n="19.3" mode="logic" speed=1 caption="The whole machine is two flip-flops with enable, an inverter, an XOR and an AND. The clock runs at 1 Hz; the TICK switch is the enable. Switch it off and the light freezes; switch it on and it walks the British sequence. The flags Q1, Q0 and R are wires."}

Count the parts: two flip-flops and three gates, and the red lamp is driven by the same inverter that feeds Q0. That is small because the encoding was chosen for this machine, and because the enable flip-flop does the "hold" work for free. With plain D flip-flops and `tick` treated as an ordinary input, the same machine needs more gates, as you will see in the designer.

:::note[Flip-flops with enable]
A D flip-flop with enable loads D only when EN is 1; otherwise it keeps its value. It is a D flip-flop with a multiplexer in front, `D' = EN ? D : Q`, and most chips and every FPGA flip-flop have one built in. It matters here because machines spend most of their time *waiting*. Without the enable, every waiting state needs an arrow back to itself, and that arrow costs product terms. With it, "wait" is a single signal.
:::

## The FSM designer

The designer draws what you have done by hand. It takes a machine as bubbles and arrows, and gives back everything the chapter has described: the state table, the minimised equations, the circuit, the cost of each encoding and the code in DCL. Everything you can do with the mouse you can do with the buttons and forms as well (Tab to a bubble, and the arrow keys move it), so use whichever you prefer.

::fsm-designer{n="19.4" caption="Choose one of the machines, or Blank, and change it. States tab: add, rename, reorder, delete. Arrows tab: add an arrow with the form, or click one bubble and then another. Ports tab: add inputs and outputs. Flip the input switches and press Clock edge; the logic is checked against the diagram at every edge."}

:::lab[Tour the designer]
1. **Run the traffic light.** With `tick` at 1, press *Clock edge* four times and watch the lit bubble and the lamps. Set `tick` to 0 and press again: nothing moves, because no arrow leaves for that input.
2. **Compare the encodings** on the Cost tab. Binary and Gray need 2 flip-flops, one-hot 4. Which needs the fewest gates? Now look at the *widest* column and think about why.
3. **Ask for the circuit.** Choose Gray and open the Circuit tab. Find the inverter that makes red (NOT Q1) and the AND that makes green (Q1 · Q0); amber, which Figure 19.3 makes with an XOR, appears here as two ANDs and an OR. The rest is the hold logic that the enable flip-flops of Figure 19.3 made unnecessary there.
4. **Change the machine.** Pick *Sequence 1011* (a Mealy machine). Feed it the bits 1, 0, 1, 1 one at a time with the *x* switch, pressing *Clock edge* each time: `found` lights during the cycle in which the last 1 is on the input. Then press *Moore* and repeat: the machine now has five states, and the output comes one cycle later.
5. **Break it.** On the Arrows tab add an arrow from one state that overlaps an existing one but goes to a different state. The designer reports the ambiguity and refuses to synthesise it.
:::

## Choosing the encoding

Three ways of numbering the states are in common use.

- **Binary**: the states are numbered 0, 1, 2… in binary. It uses the fewest flip-flops, ⌈log<sub>2</sub> *n*⌉ for *n* states.
- **:term[Gray code]{id=gray-code}**: numbered in Gray order, so states that follow each other in the list differ in one bit. Good for rings and for anything counted through in order.
- **:term[One-hot]{id=one-hot}**: one flip-flop per state, and exactly one of them is 1 at any time. It uses the most flip-flops, *n* for *n* states.

The choice changes the cost of the logic, sometimes a lot, so before you open the Cost tab, predict.

```quiz
q: 'For the traffic light, which of the three encodings needs the fewest gates in two-level AND–OR logic (counting flip-flops as well)?'
options:
  - text: One-hot, because each state has its own flip-flop and no decoding is needed.
    why: 'One-hot logic is simple (its widest AND has two inputs) but there is a lot of it, and it has four flip-flops. For this machine it comes last: 4 flip-flops and 15 gates, 19 in all.'
  - text: Binary, with 2 flip-flops and 10 gates (12 in all).
    correct: true
    why: 'Binary wins here, Gray comes next with 2 flip-flops and 13 gates (15), and one-hot last with 19. Gray does not win for this machine because `tick` is treated as a data input, so the hold terms (“if tick is 0, keep the state”) cost gates in every encoding. In the circuit of Figure 19.3 the enable flip-flop did that work for free.'
  - text: They all cost the same, since they compute the same function.
    why: 'They compute the same *behaviour*, but the function that has to be built is different in each: the rows of the truth table, and the unused codes that may be treated as don’t-cares, are different.'
```

The general picture from many machines is this:

- **Binary and Gray** use the fewest flip-flops and, for small machines, usually the fewest gates. Between them, Gray often wins on machines that go round a ring, and binary elsewhere; a good number is worth checking rather than trusting.
- **One-hot** costs a flip-flop per state, and in gates it rarely wins on its own terms. Its advantage is that the logic is *shallow and narrow*. To find out whether the machine is in state S you look at one wire, not at every state bit, so its AND gates never have more than the inputs plus one flip-flop, however many states there are. A binary encoding of 12 states needs ANDs of 4 state bits plus the inputs. The result is a **faster clock**, and on an FPGA, where flip-flops come free with every lookup table and wide gates cost several tables, one-hot is the usual choice. The designer's *LUT4* column is a rough count for that case (Chapter 28).
- **Gray** has one more benefit that has nothing to do with gate count. When two state bits change at the same clock edge, they change at slightly different moments, and for a few nanoseconds the state bits show a code that belongs to neither the old state nor the new one. If a Moore output is decoded from the state bits, it can *glitch* in that gap (Chapter 15). In a Gray-coded ring only one bit changes per step, so there is no in-between code.

There is one more thing to choose, and it is often worth more than the encoding: **which state gets which code**. Take the four states of the 1011 detector. There are 24 ways to number them in binary, and the cheapest circuit found by the designer's minimiser, over all 24, uses 4 gates; the most expensive uses 11. Drag states up and down the list on the States tab, which reorders the codes, and watch the cost change. There is no fast rule for finding the best assignment, and industrial tools search for one.

:::warning[The states you did not draw]
Four states need two flip-flops, and two flip-flops can hold four values, so nothing is left over. Three states also need two flip-flops, and the fourth code is a state that the machine was never meant to enter. Treating such codes as don't-cares gives smaller logic, and it means that if the register ever *does* land in one (from a power glitch, or a cosmic ray, or a clock that was too fast: Chapter 17) the machine does something arbitrary and may never come back. Safety-critical designs add arrows from every unused code to the reset state, and pay for them in gates.
:::

## The same machine in DCL

Writing a machine as a set of gates is a way of *drawing* it. In DCL, the course's hardware language, you write it the way the diagram reads: an enum of states, a register that holds one, and a `match` that says where each state goes next.

```dcl
enum Light { Red, RedAmber, Green, Amber }

module TrafficLight(clk: clock, tick: bit) -> (red: bit, amber: bit, green: bit) {
  reg state: Light = Light.Red

  next state = if !tick { state } else {
    match state {
      Light.Red => Light.RedAmber,
      Light.RedAmber => Light.Green,
      Light.Green => Light.Amber,
      Light.Amber => Light.Red,
    }
  }
  red = state == Light.Red || state == Light.RedAmber
  amber = state == Light.RedAmber || state == Light.Amber
  green = state == Light.Green
}
```

Nothing in it mentions a code. The compiler chooses one, binary by default, and it reads the source in the same order as the diagram: `reg state` is the flip-flops, `next state = …` is the next-state logic, and the three lines below are the output logic. A `match` compiles to *one* multiplexer, evaluating every arm in parallel, as the note above said; and the compiler checks that the arms cover every state, so a forgotten arrow is a compile error, not a machine that hangs.

To change the encoding you change one word. Put `@onehot` or `@gray` in front of the enum and the compiler makes four flip-flops or a Gray-coded pair; the machine does not change. In the playground, press *Step clock* with `tick` at 1 and watch the lights walk the sequence, then add the attribute and open the Circuit tab.

::dcl-playground{src="designs/traffic-light.dcl" top="TrafficLight" n="19.5" tab="run" caption="Hold tick at 1 and press Step clock: red, red with amber, green, amber, red. Put @onehot in front of the enum, open the Circuit tab and count the flip-flops. Then run the tests, and break one by swapping two arms of the match."}

The designer's **DCL tab** writes this code for any machine you draw, in the encoding you have chosen. Its `Compile it` button hands the text to the real compiler and reports the flip-flops and gates that come out. The count will be higher than the minimised one in the Cost tab: the compiler does not minimise, it turns each `match` into decoders and AND–OR gates, and leaves shrinking the logic to whatever comes next (for a GAL in Chapter 26, the fitter that uses the same minimiser as this chapter).

## A machine with a datapath

The bubbles of a state machine describe *control*, and they get out of hand when a machine also has to count or store. A machine that must receive eight data bits would need eight states, one for each bit, with one arrow between neighbours. One that must count to a thousand would need a thousand states. The way out is to split the machine in two: a small FSM that knows *what phase it is in*, and a register or counter next to it that holds the *data*. The FSM asks the datapath questions (is the counter finished?) and gives it orders (shift now).

A serial receiver is the classic example. A UART line idles high; a byte starts with one low **start bit**, then eight data bits, then a high **stop bit**. The control machine needs only four states:

- **Idle**: waiting for the line to go low.
- **Start**: the line has gone low; is it still low a half-bit later, or was that a glitch? (If it went back high, return to Idle.)
- **Data**: shift a bit in at each bit time; when the counter reports the eighth (`last`), go on.
- **Stop**: check the stop bit, signal `valid`, return to Idle.

Load *UART receiver* in the designer to see it. Its Moore outputs are `busy`, `shift` and `valid`, and its one input beyond the line itself, `last`, is the counter's answer. That is the split every processor is made of, and Chapter 22 builds the control unit of a CPU the same way: a state machine issuing the control lines of a datapath, one cycle at a time. Chapter 24 completes the UART.

:::history{year=1936 title="The machine with a tape" people="Alan Turing"}
A finite-state machine has a fixed, finite memory, and that limits what it can do: it cannot, for example, check that a string has as many opening as closing brackets, however long, because it would need to count without limit. In 1936 Alan Turing described an abstract machine that is just a finite-state controller of this kind connected to an unbounded tape it can read and write, and showed that this simple arrangement can compute anything that can be computed at all.:cite[turing1936] Every processor is such a machine, with the tape replaced by memory of finite size: the subject of the next chapter. (The Computability course of this series goes into Turing machines in detail.)
:::

:::hood[Synthesising a state machine]
The designer's synthesis is small enough to read (`widgets/synth.ts`). It turns the drawing into a multi-output truth table over the state bits and the inputs. For each state and each input combination it asks the diagram (`step`) for the next state and the outputs, and records a *cube*: the state's code, with the input combination. Binary and Gray codes test every state bit; one-hot tests only the state's own flip-flop, which is what makes its gates narrow:

```ts
function cubeOf(codes: Codes, code: number, pattern: string, ni: number): Cube {
  const k = codes.bits;
  const bits = codes.encoding === 'onehot' ? Array.from({ length: k }, (_, b) => (((code >> (k - 1 - b)) & 1) ? '1' : '-')).join('') : codeText(code, k);
  return cubeFromString(bits + pattern.padEnd(ni, '-'));
}
```

The unused binary or Gray codes become don't-care cubes. The functions are then minimised in two ways, and the cheaper result in gates is kept: each function alone (Espresso or exact Quine–McCluskey, from Chapter 12) with identical terms merged, and the multi-output minimiser the PAL fitter uses, which shares terms between functions to save rows of an AND plane, not gates:

```ts
const shared = minimiseMulti(spec);
const a = costOf(merged, n, flipFlops);
const b = costOf(shared, n, flipFlops);
return b.gates < a.gates || (b.gates === a.gates && b.gateInputs < a.gateInputs) ? shared : merged;
```

Cost is counted the way the text counts it: an AND gate for each term of two or more literals, an OR gate for each function of two or more terms, an inverter for each variable that appears complemented. A test then checks the result exhaustively: for every state and every input combination, the minimised logic must give the same outputs and the same next state as the diagram.

The exercises below are checked differently, because a circuit that reads a clock and holds state has no truth table. The checker (`src/lib/sim/check/sequential.ts`) wraps both the reader's circuit and the state table as *machines*, and explores their **product**: it starts both at reset, tries every input combination, and keeps a set of the pairs (state of the table, state of the circuit) already seen, replaying from reset to reach each new pair:

```ts
const key = `${ref.signature()}#${cand.signature()}`;
if (!seen.has(key)) {
  seen.add(key);
  next.push([...path, v]);
}
```

If any pair ever gives different outputs, the path that reached it is the shortest counterexample, and it is shown to you as a sequence of inputs. If the search finishes with every pair agreeing, the two are equivalent for *every* input sequence, not just the ones that were tried, and the exercise reports "proven". When the machines are too large for that, it falls back to directed and random stimulus.
:::

## Exercises

```quiz
q: 'A machine has 9 states. How many flip-flops do binary and one-hot encodings need?'
options:
  - text: 'Binary 4, one-hot 9.'
    correct: true
    why: '⌈log₂ 9⌉ = 4 flip-flops name up to 16 states, and one-hot uses one per state. The seven unused binary codes are don’t-cares (or should be made safe).'
  - text: 'Binary 3, one-hot 9.'
    why: 'Three flip-flops name only 2³ = 8 states.'
  - text: 'Binary 9, one-hot 4.'
    why: 'The other way round.'
```

```quiz
q: 'A rising-edge detector is built as a Moore machine. How many more states does it need than the Mealy version?'
options:
  - text: 'None: the two need the same states.'
    why: 'The Mealy version needs two states, “input was low” and “input was high”. The Moore version must also remember that it is currently *emitting* the pulse.'
  - text: 'One more: it must split “input high” into “edge just seen” and “still high”.'
    correct: true
    why: 'Mealy: {low, high}, output on the arrow low → high. Moore: {low, edge, high}, output in state edge only. That is the general rule for converting: states are split by the output that leads into them.'
  - text: 'Twice as many.'
    why: 'Only the states that can be entered with different outputs are split. Here that is one state.'
```

```quiz
q: 'A Mealy machine’s output feeds the write-enable pin of a memory. Which is the better design?'
options:
  - text: 'Leave it. A Mealy output is fine if the logic is fast enough.'
    why: 'A glitch on a write strobe writes garbage. A Mealy output changes when the inputs do, and inputs can glitch (Chapter 15).'
  - text: 'Use a Moore output, or register the Mealy output first, so it changes only just after a clock edge.'
    correct: true
    why: 'A signal that acts must come from a register, not from logic. Registering the Mealy output gives you the Moore machine with its one-cycle delay.'
  - text: 'Use one-hot encoding, which cannot glitch.'
    why: 'Encoding affects the state bits, not the glitches that inputs cause in an output that depends on them. A one-hot Mealy output still follows its inputs combinationally.'
```

The three circuit exercises use a state table as their specification. The checker starts your circuit at power-up (the flip-flops begin at 0), drives it with every input sequence it can, and shows you the shortest sequence that makes it differ from the table.

```build
id: fsm/turnstile
title: Build the turnstile
prompt: |
  Build the **turnstile** of Figure 19.1 from a D flip-flop and gates. Inputs `coin` and `push`, output `unlocked`. The machine is Moore: `unlocked` is 1 exactly in the Unlocked state. Locked goes to Unlocked on a coin (whatever `push` says). Unlocked goes back to Locked on a push without a coin, and otherwise stays.

  The flip-flop starts at 0, which is Locked, so it needs no reset. Its output is the state; what goes into D is the next state.
spec:
  fsm:
    type: moore
    inputs: [coin, push]
    outputs: [unlocked]
    initial: Locked
    states:
      Locked: { out: "0", next: { "1-": Unlocked, "0-": Locked } }
      Unlocked: { out: "1", next: { "1-": Unlocked, "00": Unlocked, "01": Locked } }
allowed: [not, and, or, dff]
hints:
  - Let the flip-flop hold “unlocked”. When is the next value 1?
  - It is 1 if a coin comes, or if it is already 1 and no push comes. That is `coin OR (Q AND NOT push)`.
explain: |
  D = coin + Q·¬push and unlocked = Q: one flip-flop, an inverter, an AND and an OR. It is the machine of Figure 19.1, and the designer’s Logic tab gives the same equation for the Blank machine with these two states.
solution: 19-state-machines/exercises/turnstile-solution.json
```

```debug
id: fsm/traffic-light
title: The amber that never goes out
prompt: |
  This is the traffic light of Figure 19.3: two flip-flops with enable (`tick` is the enable), a Gray code, and three lamp gates. The sequence is right, but the amber lamp is lit during *green* as well. Run it, find the state in which it is wrong, and fix the lamp logic without touching the flip-flops.
spec:
  fsm:
    type: moore
    inputs: [tick]
    outputs: [red, amber, green]
    initial: Red
    states:
      Red: { out: "100", next: { "1": RedAmber, "0": Red } }
      RedAmber: { out: "110", next: { "1": Green, "0": RedAmber } }
      Green: { out: "001", next: { "1": Amber, "0": Green } }
      Amber: { out: "010", next: { "1": Red, "0": Amber } }
allowed: [not, and, or, xor, dffe]
start: 19-state-machines/exercises/traffic-start.json
solution: 19-state-machines/exercises/traffic-solution.json
hints:
  - The state codes are Q1 Q0 = 00, 01, 11, 10 for Red, RedAmber, Green, Amber. In which of them should amber be lit?
  - Amber is lit in 01 and 10, where exactly one of the two bits is 1. What gate is 1 when its inputs differ?
fault: The amber lamp is driven by an OR gate, which is 1 in 01, 10 and 11, so it also lights in Green (11). Amber must be lit when exactly one state bit is 1, which is an XOR.
```

```golf
id: fsm/detector-golf
title: The 1011 detector at par
prompt: |
  Build the **1011 detector** of the designer (a Mealy machine: `found` is 1 in the cycle in which the last 1 of 1011 is on the input, overlaps allowed) with as few parts as you can. Flip-flops count as parts, like gates. The table has four states, so two flip-flops.

  Par is **six**: two flip-flops and four gates. The designer reaches it with the right *assignment* of codes to states; a bad assignment costs eleven gates. Find the assignment.
spec:
  fsm:
    type: mealy
    inputs: [x]
    outputs: [found]
    initial: Idle
    states:
      Idle: { next: { "0": "Idle/0", "1": "Got1/0" } }
      Got1: { next: { "0": "Got10/0", "1": "Got1/0" } }
      Got10: { next: { "0": "Idle/0", "1": "Got101/0" } }
      Got101: { next: { "0": "Got10/0", "1": "Got1/1" } }
allowed: [not, and, or, dff]
par: 6
metric: gates
hints:
  - Put the states in the designer’s list and drag them up and down; watch the Cost tab.
  - Give the states whose successors on x = 0 are the same neighbouring codes. Idle is 00. Try Got10 = 01, Got101 = 10, Got1 = 11.
explain: |
  With Idle = 00, Got10 = 01, Got101 = 10, Got1 = 11 (written Q1 Q0) the equations collapse: D1 = x, so the first flip-flop simply remembers the last input bit; D0 = ¬Q0·x + Q1; and found = Q1·¬Q0·x. Two flip-flops, one inverter, two ANDs and an OR make six parts. It is the best of the 24 binary assignments the designer tried, and no smaller circuit of AND, OR, NOT and two flip-flops is known here; if you find one, you have beaten the minimiser.
solution: 19-state-machines/exercises/detector-solution.json
```

## Build it for real

:::real{parts="74HC74 (dual D flip-flop), 74HC08, 74HC86, red, amber and green LEDs, 3 × 330 Ω resistors, pushbutton, 10 kΩ resistor, 5 V USB supply module, breadboard"}
**The traffic light of Figure 19.3, in three chips.** The 74HC74 holds two D flip-flops, each with a Q and a Q̄ output. Call the first Q1 (pins 2 to 6: D on pin 2, clock on pin 3, Q on pin 5, Q̄ on pin 6) and the second Q0 (D on pin 12, clock on pin 11, Q on pin 9). Wire Q1's D input (pin 2) to Q0 (pin 9), and Q0's D input (pin 12) to Q1's *inverted* output (pin 6), which is NOT Q1 and therefore also the **red** lamp. Amber is Q1 XOR Q0: one gate of the 74HC86 with its inputs on pins 5 and 9. Green is Q1 AND Q0: one gate of the 74HC08, on the same two pins. Each lamp is an LED through a 330 Ω resistor to ground. Join both clock pins (3 and 11) to a pushbutton, with the 10 kΩ pull-down resistor to ground (bounce will make it skip states: debounce it as in Chapter 17, or use a slow 555 as a clock). Tie the preset inputs (pins 4 and 10) to +5 V, and the clear inputs (pins 1 and 13) to +5 V too, but touch them to ground for a moment after switching on so that the light starts in red (00). The 74HC74 has no enable pin, so this version steps at every clock edge; that is why there is no `tick`. Tie the unused inputs of the gates to ground (Chapter 10). Power is 5 V: pin 14 is +5 V and pin 7 is ground on the 74HC74, and pins 14 and 7 on the gates as well.
:::

## What’s next

A state machine has *memory*, but only the little that its flip-flops hold: a handful of bits. The bits that a program works on, and the program itself, need thousands to billions of them. The next chapter is about how that is done: how one flip-flop's worth of storage is packed into a cell of six transistors, or of one transistor and one tiny capacitor that leaks; how an address selects one word out of millions through a decoder; and why the memory in a computer comes in layers, from a few bytes that answer in a third of a nanosecond to terabytes that take a hundred microseconds.
