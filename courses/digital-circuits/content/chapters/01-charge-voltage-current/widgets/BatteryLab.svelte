<!--
  Lab: turn the battery's voltage and read the current. A 1 kΩ resistor, an ammeter and a voltmeter.
-->
<script lang="ts">
  import TunableCircuit from './TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout } from '$lib/bench/format';
  import circuit from '../circuits/ohm-lab.json';

  let { title = 'Voltage in, current out', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  kind="Lab bench"
  controls={[{ id: 'B1', key: 'voltage', label: 'Battery voltage', min: 0, max: 12, step: 0.5, value: 6, format: (v) => `${v.toFixed(1)} V` }]}
  probes={[
    { label: 'Battery', value: (e) => formatReadout(Number(e.state('B1').value), 'V') },
    { label: 'Current (ammeter)', value: (e) => formatReadout(e.current('A1', 0), 'A') },
  ]}
/>
