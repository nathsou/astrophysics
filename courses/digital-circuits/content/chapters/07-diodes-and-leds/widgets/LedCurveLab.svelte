<!--
  Lab: plot an LED's I–V curve with a potentiometer and two meters. The pot is wired as a variable resistor in series with
  a 220 Ω resistor and the LED; the ammeter and the voltmeter give one point of the curve for each turn
  of the knob. Built on Chapter 1's TunableCircuit.

    ::led-curve-lab{n="7.6" caption="…"}
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout } from '$lib/bench/format';
  import circuit from '../circuits/led-iv.json';

  let { title = 'Plot an LED’s curve', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  kind="Lab bench"
  controls={[{ id: 'POT', key: 'position', label: 'Potentiometer (100 kΩ)', min: 0, max: 1, step: 0.005, value: 0.1, format: (v) => `${(v * 100).toFixed(1)} kΩ` }]}
  probes={[
    { label: 'Voltage across the LED', value: (e) => formatReadout(Number(e.state('V1').value), 'V') },
    { label: 'Current (ammeter)', value: (e) => formatReadout(Number(e.state('A1').value), 'A') },
    { label: 'Brightness', value: (e) => `${Math.round(100 * Number(e.state('D1').brightness ?? 0))} %` },
  ]}
/>
