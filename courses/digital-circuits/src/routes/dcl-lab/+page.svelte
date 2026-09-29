<!--
  Development lab for the DCL widgets (not linked from the course): the playground and the inference viewer
  with the counter, the traffic light and the ALU, and a small module written inline.
-->
<script lang="ts">
  import DclInference from '$lib/widgets/dcl/DclInference.svelte';
  import DclPlayground from '$lib/widgets/dcl/DclPlayground.svelte';

  const inverter = 'module Half(a: bit, b: bit) -> (sum: bit, carry: bit) {\n  sum = a ^ b\n  carry = a & b\n}\n';
</script>

<article class="lab">
  <h1>DCL lab</h1>
  <p class="lede">The DCL widgets, for design review. Not linked from the course.</p>

  <h2>Inference viewer</h2>
  <DclInference src="designs/counter.dcl" n="29.1" title="A counter, and the gates it becomes" caption="Edit the code: the netlist follows. Hover a line, or a gate." />
  <DclInference src="designs/traffic-light.dcl" n="29.2" />
  <DclInference code={inverter} title="A half adder" n="29.3" />
  <DclInference src="designs/alu.dcl" n="29.4" subtitle="Too big to draw gate by gate: the readout still counts it." />

  <h2>Playground</h2>
  <DclPlayground src="designs/counter.dcl" top="Counter" n="29.5" />
  <DclPlayground src="designs/traffic-light.dcl" top="TrafficLight" n="29.6" />
  <DclPlayground src="designs/alu.dcl" top="Alu" n="29.7" circuit={false} />
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
