---
number: 99
title: Exercise fixture
summary: Every circuit and program exercise block, for the compiler tests. Not a real chapter.
---

Examples of the five circuit and program exercise blocks. Each block's `solution` passes its own checker (see
`src/lib/components/exercise/fixture.test.ts`), and each `start` of a debug block fails it.

## Build a part

```build
id: fixture/full-adder
title: Build a full adder
part: full-adder
allowed: [xor, and, or]
prompt: |
  Add three bits, **A**, **B** and a carry in **CIN**, and give the sum **S** and the carry out **COUT**. The pins are
  already on the canvas: place gates, wire them, and press Check.
hints:
  - The sum is the XOR of all three inputs.
  - The carry out is 1 when at least two inputs are 1, which is `AB + CIN(A ⊕ B)`.
explain: |
  A full adder is two half adders and an OR. When it passes, it goes into your **parts bin**, ready for the 8-bit adder.
solution: {"version":1,"title":"Full adder","engine":"digital","components":[{"id":"A","type":"port","x":4,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":4,"y":4,"params":{"name":"B","dir":"in"},"label":""},{"id":"CIN","type":"port","x":4,"y":8,"params":{"name":"CIN","dir":"in"},"label":""},{"id":"U1","type":"xor","x":14,"y":1,"params":{}},{"id":"U2","type":"xor","x":33,"y":4,"params":{}},{"id":"U3","type":"and","x":14,"y":6,"params":{}},{"id":"U4","type":"and","x":33,"y":9,"params":{}},{"id":"U5","type":"or","x":52,"y":8,"params":{}},{"id":"S","type":"port","x":66,"y":0,"params":{"name":"S","dir":"out"},"flip":true,"label":""},{"id":"COUT","type":"port","x":66,"y":4,"params":{"name":"COUT","dir":"out"},"flip":true,"label":""},{"id":"L1","type":"label","x":6,"y":8,"params":{"name":"CIN"},"label":""},{"id":"L2","type":"label","x":31,"y":6,"params":{"name":"CIN"},"flip":true,"label":""},{"id":"L3","type":"label","x":31,"y":11,"params":{"name":"CIN"},"flip":true,"label":""},{"id":"L4","type":"label","x":22,"y":7,"params":{"name":"n2"},"label":""},{"id":"L5","type":"label","x":50,"y":8,"params":{"name":"n2"},"flip":true,"label":""},{"id":"L6","type":"label","x":41,"y":5,"params":{"name":"S"},"label":""},{"id":"L7","type":"label","x":64,"y":0,"params":{"name":"S"},"flip":true,"label":""}],"wires":[{"points":[[4,0],[11,0],[11,1],[14,1]]},{"points":[[4,0],[11,0],[11,6],[14,6]]},{"points":[[4,4],[12,4],[12,3],[14,3]]},{"points":[[4,4],[12,4],[12,8],[14,8]]},{"points":[[20,2],[26,2],[26,4],[33,4]]},{"points":[[20,2],[26,2],[26,9],[33,9]]},{"points":[[39,10],[52,10]]},{"points":[[58,9],[59,9],[59,4],[66,4]]},{"points":[[4,8],[6,8]]},{"points":[[31,6],[33,6]]},{"points":[[31,11],[33,11]]},{"points":[[20,7],[22,7]]},{"points":[[50,8],[52,8]]},{"points":[[39,5],[41,5]]},{"points":[[64,0],[66,0]]}]}
```

## Build to an expression

```build
id: fixture/majority
title: Majority vote
spec:
  expression: "Y = A & B | A & C | B & C"
allowed: [and, or, not]
budget: { gates: 5 }
prompt: The output is 1 when at least two of the three inputs are 1. Use at most five gates.
hints: ["Three AND gates and two ORs."]
```

## Build a state machine

```build
id: fixture/toggle
title: A toggle
spec:
  fsm:
    type: moore
    inputs: [T]
    outputs: [Q]
    initial: off
    states:
      off: { out: "0", next: { "0": off, "1": on } }
      on: { out: "1", next: { "0": on, "1": off } }
allowed: [dff, tff, xor, not, and, or]
prompt: Q flips on each clock edge while T is 1, and holds while T is 0.
solution: {"version":1,"engine":"digital","components":[{"id":"T","type":"port","x":6,"y":2,"params":{"name":"T","dir":"in"},"label":""},{"id":"CLK","type":"port","x":6,"y":6,"params":{"name":"CLK","dir":"in"},"label":""},{"id":"Q","type":"port","x":40,"y":2,"flip":true,"params":{"name":"Q","dir":"out"},"label":""},{"id":"U1","type":"tff","x":20,"y":2}],"wires":[{"points":[[6,2],[20,2]]},{"points":[[6,6],[16,6],[16,4],[20,4]]},{"points":[[26,2],[40,2]]}]}
```

## Debug a circuit

```debug
id: fixture/debug-carry
title: The carry is wrong
prompt: This half adder adds 1 + 1 and gets the wrong carry. Find the faulty gate and fix it.
spec:
  truthTable:
    inputs: [A, B]
    outputs: [S, C]
    rows: ["00 00", "01 10", "10 10", "11 01"]
start: {"version":1,"title":"Half adder","engine":"digital","components":[{"id":"A","type":"port","x":4,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":4,"y":4,"params":{"name":"B","dir":"in"},"label":""},{"id":"U1","type":"xor","x":9,"y":1,"params":{}},{"id":"U2","type":"or","x":9,"y":6,"params":{}},{"id":"S","type":"port","x":19,"y":0,"params":{"name":"S","dir":"out"},"flip":true,"label":""},{"id":"C","type":"port","x":19,"y":4,"params":{"name":"C","dir":"out"},"flip":true,"label":""}],"wires":[{"points":[[4,0],[6,0],[6,1],[9,1]]},{"points":[[4,0],[6,0],[6,6],[9,6]]},{"points":[[4,4],[7,4],[7,3],[9,3]]},{"points":[[4,4],[7,4],[7,8],[9,8]]},{"points":[[15,2],[16,2],[16,0],[19,0]]},{"points":[[15,7],[17,7],[17,4],[19,4]]}]}
solution: {"version":1,"title":"Half adder","engine":"digital","components":[{"id":"A","type":"port","x":4,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":4,"y":4,"params":{"name":"B","dir":"in"},"label":""},{"id":"U1","type":"xor","x":9,"y":1,"params":{}},{"id":"U2","type":"and","x":9,"y":6,"params":{}},{"id":"S","type":"port","x":19,"y":0,"params":{"name":"S","dir":"out"},"flip":true,"label":""},{"id":"C","type":"port","x":19,"y":4,"params":{"name":"C","dir":"out"},"flip":true,"label":""}],"wires":[{"points":[[4,0],[6,0],[6,1],[9,1]]},{"points":[[4,0],[6,0],[6,6],[9,6]]},{"points":[[4,4],[7,4],[7,3],[9,3]]},{"points":[[4,4],[7,4],[7,8],[9,8]]},{"points":[[15,2],[16,2],[16,0],[19,0]]},{"points":[[15,7],[17,7],[17,4],[19,4]]}]}
hints: ["Try all four input pairs. Which row is wrong?", "Select the gate that makes the carry and change it."]
fault: The carry gate was an OR; it must be an AND.
```

```debug
id: fixture/debug-led
title: The LED stays dark
prompt: Close the switch. The LED should light, but it does not. What is wrong?
allowed: [led, resistor, switch, battery]
spec:
  scenarios:
    - { name: "switch closed", set: { S1: true }, expect: { D1: lit } }
    - { name: "switch open", set: { S1: false }, expect: { D1: unlit } }
start: {"version":1,"title":"LED and resistor","engine":"analog","components":[{"id":"B1","type":"battery","x":4,"y":10,"rot":270,"params":{"voltage":9}},{"id":"S1","type":"switch","x":8,"y":2},{"id":"R1","type":"resistor","x":14,"y":2,"params":{"resistance":470}},{"id":"D1","type":"led","x":24,"y":4,"rot":270,"params":{"color":"red"}},{"id":"G1","type":"ground","x":4,"y":12}],"wires":[{"points":[[4,6],[4,2],[8,2]]},{"points":[[4,10],[4,12]]},{"points":[[12,2],[14,2]]},{"points":[[18,2],[24,2],[24,4]]},{"points":[[24,8],[24,12],[4,12]]}]}
solution: {"version":1,"title":"LED and resistor","engine":"analog","components":[{"id":"B1","type":"battery","x":4,"y":10,"rot":270,"params":{"voltage":9}},{"id":"S1","type":"switch","x":8,"y":2},{"id":"R1","type":"resistor","x":14,"y":2,"params":{"resistance":470}},{"id":"D1","type":"led","x":24,"y":4,"rot":90,"params":{"color":"red"}},{"id":"G1","type":"ground","x":4,"y":12}],"wires":[{"points":[[4,6],[4,2],[8,2]]},{"points":[[4,10],[4,12]]},{"points":[[12,2],[14,2]]},{"points":[[18,2],[24,2],[24,4]]},{"points":[[24,8],[24,12],[4,12]]}]}
hints: ["An LED conducts in one direction only."]
```

## Golf

```golf
id: fixture/xor-golf
title: XOR golf
par: 4
metric: gates
part: xor
allowed: [nand]
prompt: Make an exclusive OR out of NAND gates only. Par is four.
hints: ["Take one NAND of A and B, and feed it to two more."]
solution: {"version":1,"title":"XOR","engine":"digital","components":[{"id":"A","type":"port","x":4,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":4,"y":4,"params":{"name":"B","dir":"in"},"label":""},{"id":"U1","type":"nand","x":17,"y":1,"params":{}},{"id":"U2","type":"nand","x":31,"y":0,"params":{}},{"id":"U3","type":"nand","x":31,"y":5,"params":{}},{"id":"U4","type":"nand","x":41,"y":3,"params":{}},{"id":"Y","type":"port","x":51,"y":0,"params":{"name":"Y","dir":"out"},"flip":true,"label":""},{"id":"L1","type":"label","x":6,"y":0,"params":{"name":"A"},"label":""},{"id":"L2","type":"label","x":15,"y":1,"params":{"name":"A"},"flip":true,"label":""},{"id":"L3","type":"label","x":29,"y":0,"params":{"name":"A"},"flip":true,"label":""},{"id":"L4","type":"label","x":6,"y":4,"params":{"name":"B"},"label":""},{"id":"L5","type":"label","x":15,"y":3,"params":{"name":"B"},"flip":true,"label":""},{"id":"L6","type":"label","x":29,"y":7,"params":{"name":"B"},"flip":true,"label":""}],"wires":[{"points":[[23,2],[31,2]]},{"points":[[23,2],[24,2],[24,5],[31,5]]},{"points":[[37,1],[38,1],[38,3],[41,3]]},{"points":[[37,6],[39,6],[39,5],[41,5]]},{"points":[[47,4],[48,4],[48,0],[51,0]]},{"points":[[4,0],[6,0]]},{"points":[[15,1],[17,1]]},{"points":[[29,0],[31,0]]},{"points":[[4,4],[6,4]]},{"points":[[15,3],[17,3]]},{"points":[[29,7],[31,7]]}]}
```

## Measure

```measure
id: fixture/measure-divider
title: Read the divider
circuit: {"version":1,"title":"A divider","engine":"analog","components":[{"id":"B1","type":"battery","x":4,"y":10,"rot":270,"params":{"voltage":10}},{"id":"R1","type":"resistor","x":8,"y":2,"params":{"resistance":1000}},{"id":"R2","type":"resistor","x":18,"y":4,"rot":90,"params":{"resistance":4000}},{"id":"G1","type":"ground","x":4,"y":12},{"id":"G2","type":"ground","x":18,"y":12}],"wires":[{"points":[[4,6],[4,2],[8,2]]},{"points":[[4,10],[4,12]]},{"points":[[12,2],[18,2],[18,4]]},{"points":[[18,8],[18,12]]}]}
question: What is the voltage across R2?
unit: V
probe: { voltage: "R2.1" }
tolerance: 0.03
prompt: Ten volts across a 1 kΩ and a 4 kΩ resistor in series. Measure the voltage across the lower one.
explain: The divider gives $10\,\mathrm{V} \times 4/5 = 8\,\mathrm{V}$.
hints: ["The current is 10 V / 5 kΩ."]
```

```measure
id: fixture/measure-answer
title: Current in the divider
circuit: {"version":1,"title":"A divider","engine":"analog","components":[{"id":"B1","type":"battery","x":4,"y":10,"rot":270,"params":{"voltage":10}},{"id":"R1","type":"resistor","x":8,"y":2,"params":{"resistance":1000}},{"id":"R2","type":"resistor","x":18,"y":4,"rot":90,"params":{"resistance":4000}},{"id":"G1","type":"ground","x":4,"y":12},{"id":"G2","type":"ground","x":18,"y":12}],"wires":[{"points":[[4,6],[4,2],[8,2]]},{"points":[[4,10],[4,12]]},{"points":[[12,2],[18,2],[18,4]]},{"points":[[18,8],[18,12]]}]}
question: What current flows?
unit: A
answer: 2 mA
tolerance: 0.05
```

## Assembly

```asm
id: fixture/double
title: Double it
isa: octet
prompt: Load the byte at `x`, double it, and store it back at `x`.
start: |
  ; R0 = x * 2
          LD   R0, [x]
          HLT
  x:      .byte 0
tests:
  - { name: "21", setup: { mem: { x: 21 } }, expect: { mem: { x: 42 } } }
  - { name: "100 wraps", setup: { mem: { x: 100 } }, expect: { mem: { x: 200 } } }
maxBytes: 12
solution: |
  ; x = x + x
          LD   R0, [x]
          ADD  R0, R0
          ST   [x], R0
          HLT
  x:      .byte 0
hints: ["ADD R0, R0 doubles R0."]
```

```asm
id: fixture/sum-rv
title: Sum to ten
isa: rv32i
prompt: Put 1 + 2 + … + 10 in a0, then stop with ebreak.
start: |
  _start:  li   a0, 0
           ebreak
tests:
  - { expect: { regs: { a0: 55 } } }
solution: |
  _start:  li   a0, 0
           li   t0, 10
  loop:    add  a0, a0, t0
           addi t0, t0, -1
           bnez t0, loop
           ebreak
```
