<!--
  Development lab for the abstraction dial (not linked from the course): a NOT, a NAND, a NOR, an XOR, a
  half adder and a 2:1 multiplexer with `dial=true`, and a six-bit parity tree that is too big for the
  analog level (its Analog button is dark, with the reason as its tooltip).
-->
<script lang="ts">
  import CircuitWidget from '$lib/bench/CircuitWidget.svelte';
  import { labCircuits } from './circuits';

  const captions: Record<string, string> = {
    not: 'The inverter: one pMOS pulls the output up to +5 V when the input is low, one nMOS pulls it down to ground when the input is high.',
    nand: 'NAND: the pMOS transistors are in parallel and the nMOS ones in series. Either input low pulls Y up; both high pull it down.',
    nor: 'NOR: the dual of NAND: pMOS in series, nMOS in parallel.',
    xor: 'XOR, the classic twelve transistors: two inverters make A′ and B′, then one complementary stage computes Y = ¬(A·B + A′·B′).',
    'half-adder': 'A half adder: the sum is an XOR and the carry an AND, which is a NAND followed by an inverter.',
    mux2: 'A 2:1 multiplexer: Y = S ? B : A, as (A · ¬S) + (B · S).',
    parity6: 'Six inputs need five XORs, sixty transistors: too many for the analog engine, so that level is off.',
  };
</script>

<article class="lab">
  <h1>Dial lab</h1>
  <p class="lede">The abstraction dial on small circuits, for design review. Not linked from the course.</p>

  {#each labCircuits as it (it.key)}
    <section id={it.key}>
      <CircuitWidget circuit={it.circuit} dial={true} speed={1e-8} title={it.circuit.title} caption={captions[it.key]} />
    </section>
  {/each}
</article>

<style>
  .lab {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem max(1rem, 3vw) 4rem;
  }
  h1 {
    font-family: var(--font-display);
  }
  .lede {
    color: var(--ink-2);
  }
</style>
