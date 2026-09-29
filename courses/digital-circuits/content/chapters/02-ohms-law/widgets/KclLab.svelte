<!--
  Kirchhoff's current law: three ammeters round a junction. Change the two branch resistors and the sum of the
  two branch currents keeps matching the current that arrives.
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout, formatSI } from '$lib/bench/format';
  import circuit from '../circuits/kcl.json';

  let { title = 'Currents at a junction', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  scale={1.3}
  controls={[
    { id: 'R2', key: 'resistance', label: 'R2', min: 220, max: 10000, log: true, value: 2000, format: (v) => formatSI(v, 'Ω') },
    { id: 'R3', key: 'resistance', label: 'R3', min: 220, max: 10000, log: true, value: 2000, format: (v) => formatSI(v, 'Ω') },
  ]}
  probes={[
    { label: 'Arriving (A1)', value: (e) => formatReadout(e.current('A1', 0), 'A') },
    { label: 'Through R2 (A2)', value: (e) => formatReadout(e.current('A2', 0), 'A') },
    { label: 'Through R3 (A3)', value: (e) => formatReadout(e.current('A3', 0), 'A') },
    { label: 'A2 + A3', value: (e) => formatReadout(e.current('A2', 0) + e.current('A3', 0), 'A') },
  ]}
/>
