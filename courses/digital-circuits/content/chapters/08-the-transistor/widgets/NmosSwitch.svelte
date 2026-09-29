<!--
  The n-channel MOSFET as a switch: a battery on the gate whose voltage you turn, an LED in the drain. Below
  the threshold voltage (1 V here) nothing flows; above it a channel forms and the LED lights. The gate
  ammeter reads zero throughout: the gate is an insulator, so it takes no current, only a voltage. Built
  on Chapter 1's TunableCircuit.

    ::nmos-switch{n="8.3" caption="…"}
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout } from '$lib/bench/format';
  import circuit from '../circuits/nmos-led.json';

  let { title = 'A voltage controls a channel', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  const REGIONS: Record<string, string> = { off: 'off (no channel)', linear: 'linear (a resistor)', saturation: 'saturation (a current source)' };
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  kind="Lab bench"
  controls={[{ id: 'VG', key: 'voltage', label: 'Gate voltage', min: 0, max: 5, step: 0.05, value: 5, format: (v) => `${v.toFixed(2)} V` }]}
  probes={[
    { label: 'Gate current', value: (e) => formatReadout(e.current('A1', 0), 'A') },
    { label: 'Drain current', value: (e) => formatReadout(e.current('A2', 0), 'A') },
    { label: 'Channel', value: (e) => REGIONS[String(e.state('M1').region)] ?? '–' },
    { label: 'LED', value: (e) => `${Math.round(100 * Number(e.state('D1').brightness ?? 0))} %` },
  ]}
/>
