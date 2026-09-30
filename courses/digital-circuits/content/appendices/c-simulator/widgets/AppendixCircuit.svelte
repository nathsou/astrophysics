<!--
  A live circuit kept in this appendix's own `circuits/` folder (the shared `::circuit` reads only chapters):

    ::appendix-circuit{name="led-direct" caption="…" speed=1}

  It passes the circuit to the shared circuit widget, with the same attributes as `::circuit`.
-->
<script lang="ts">
  import Circuit from '$lib/bench/CircuitWidget.svelte';
  import type { Circuit as CircuitData } from '$lib/sim/netlist/types';

  const files = import.meta.glob<CircuitData>('../circuits/*.json', { import: 'default', eager: true });

  let { name, ...rest }: { name: string; [key: string]: unknown } = $props();

  const circuit = $derived(files[`../circuits/${name}.json`]);
</script>

{#if circuit}
  <Circuit {circuit} {...rest} />
{:else}
  <p role="alert">Unknown circuit “{name}”.</p>
{/if}
