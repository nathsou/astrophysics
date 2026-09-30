<!--
  A labelled map of Octet's datapath: click a block to read what it is and which control lines work it.
  Static (no simulation): the picture the rest of the chapter fills in.

    ::datapath-map{n="21.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import DatapathDiagram from './DatapathDiagram.svelte';
  import type { Block, ExplorerState } from './explorer';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const blank: ExplorerState = { r: [0, 0, 0, 0], flags: { z: false, c: false, n: false, v: false }, bus: 'zzzzzzzz', contention: false, pc: 0, sp: 0xf0, mar: 0, ir: 0x86, a: 0, b: 0, t: 0, alu: 0, mem: 0 };
  let picked = $state<Block | undefined>('IR');

  const INFO: Record<string, { name: string; text: string; lines: string }> = {
    PC: { name: 'PC, the program counter', text: 'Holds the address of the next instruction byte. It is a counter that can also load: it counts up as each byte is fetched, and loads a new address for a jump, a call or a return.', lines: 'OE_PC puts it on the bus · PC_INC counts · PC_LD loads from the bus' },
    SP: { name: 'SP, the stack pointer', text: 'Holds the address of the last byte pushed. It is a register with a small adder in front of it that adds +1 or −1 to itself. It has no way to load from the bus: it starts at 0xF0, and only ever counts.', lines: 'OE_SP puts it on the bus · SP_INC and SP_DEC count' },
    T: { name: 'T, the temporary register', text: 'A spare byte. CALL needs it: the target address arrives from memory, but the bus is busy carrying the return address, so the target waits in T.', lines: 'OE_T puts it on the bus · LD_T loads it' },
    MAR: { name: 'MAR, the memory address register', text: 'Holds the address of the memory byte to read or write. The memory sees only MAR, never the bus, so an address must be moved into MAR one cycle before the byte moves.', lines: 'LD_MAR loads it from the bus' },
    MEM: { name: 'RAM, 256 bytes', text: 'The byte at the address in MAR is always there to be read; it reaches the bus when OE_MEM is on. A write takes the bus at the clock edge when MEM_WR is on.', lines: 'OE_MEM puts M[MAR] on the bus · MEM_WR stores the bus into M[MAR]' },
    IR: { name: 'IR, the instruction register', text: 'Holds the instruction being executed. Its bits go straight to the control unit, and the two register fields, bits 3–2 (Rd) and bits 1–0 (Rs), choose which of R0–R3 the register file reads and writes.', lines: 'LD_IR loads it from the bus' },
    RF: { name: 'R0–R3, the register file', text: 'Four bytes. Two read ports are always on: the one addressed by Rd can put its byte on the bus (OE_RD), and so can the one addressed by Rs (OE_RS). One write port takes the bus into Rd when WE_R is on.', lines: 'OE_RD and OE_RS put a register on the bus · WE_R writes Rd' },
    A: { name: 'A and B, the ALU’s operand latches', text: 'The bus can carry only one byte per cycle, but the ALU needs two operands at once. So each is caught in a latch (A first, then B) and the ALU reads both. B is a mirror of A in the picture.', lines: 'LD_A and LD_B load them from the bus' },
    B: { name: 'A and B, the ALU’s operand latches', text: 'The bus can carry only one byte per cycle, but the ALU needs two operands at once. So each is caught in a latch (A first, then B) and the ALU reads both.', lines: 'LD_A and LD_B load them from the bus' },
    ALU: { name: 'ALU, the arithmetic and logic unit', text: 'Combines A and B (or A and the constant 1, or A and itself) and is always computing. Its result reaches the bus only when OE_ALU is on. ALU_OP0–2 choose add, subtract, AND, OR, XOR, shift right or NOT.', lines: 'OE_ALU · ALU_OP0–2 · BSEL_A · BSEL_1' },
    FLAGS: { name: 'Flags Z, C, N and V', text: 'Four flip-flops that remember what the ALU said about its last result: zero, carry (or borrow), negative and signed overflow. Conditional jumps read them.', lines: 'LD_FLAGS loads them from the ALU' },
  };
  const info = $derived(picked ? INFO[picked] : undefined);
</script>

<Widget title="The datapath, mapped" subtitle="Octet’s registers, ALU and memory, hung on one bus" {caption} n={fig} kind="Figure" live={false}>
  <DatapathDiagram s={blank} plain onpick={(b) => (picked = b)} {picked} />
  <div class="info ui" role="status" aria-live="polite">
    {#if info}
      <h5>{info.name}</h5>
      <p>{info.text}</p>
      <p class="lines"><b>Control lines:</b> {info.lines}</p>
    {:else}
      <p>Click a block.</p>
    {/if}
  </div>
</Widget>

<style>
  .info {
    margin-top: 0.8rem;
    border-top: 1px solid var(--line);
    padding-top: 0.6rem;
    font-size: 0.88rem;
    line-height: 1.5;
  }
  h5 {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
  }
  p {
    margin: 0.2rem 0;
  }
  .lines {
    color: var(--ink-2);
    font-size: 0.82rem;
  }
  .lines b {
    color: var(--copper-ink);
  }
</style>
