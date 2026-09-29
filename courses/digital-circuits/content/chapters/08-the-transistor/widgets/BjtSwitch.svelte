<!--
  The NPN transistor as a switch and as an amplifier: an LED in the collector, a base resistor you can turn.
  With a small resistor the base current is far more than the lamp needs and the transistor saturates (a
  closed switch); with a large one the collector current is exactly β times the base current, which is
  less than the LED could take, and the transistor is an amplifier. The readouts show the base and collector
  currents, their ratio and the region the engine reports. Built on Chapter 1's TunableCircuit.

    ::bjt-switch{n="8.2" caption="…"}
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout } from '$lib/bench/format';
  import circuit from '../circuits/npn-switch.json';

  let { title = 'A small current controls a large one', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  const REGIONS: Record<string, string> = { cutoff: 'cut-off (switch open)', active: 'active (amplifier)', saturation: 'saturation (switch closed)' };
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  kind="Lab bench"
  controls={[
    { id: 'RB', key: 'resistance', label: 'Base resistor', min: 1000, max: 1e6, log: true, value: 4700, format: (v) => formatReadout(v, 'Ω', 2) },
    { id: 'Q1', key: 'beta', label: 'Transistor gain β', min: 20, max: 500, log: true, value: 100, format: (v) => v.toFixed(0) },
  ]}
  probes={[
    { label: 'Base current', value: (e) => formatReadout(e.current('A1', 0), 'A') },
    { label: 'Collector current', value: (e) => formatReadout(e.current('A2', 0), 'A') },
    {
      label: 'Ratio Ic ÷ Ib',
      value: (e) => {
        const ib = e.current('A1', 0);
        return ib > 1e-9 ? `× ${(e.current('A2', 0) / ib).toFixed(0)}` : '–';
      },
    },
    { label: 'Region', value: (e) => REGIONS[String(e.state('Q1').region)] ?? '–' },
    { label: 'LED brightness', value: (e) => `${Math.round(100 * Number(e.state('D1').brightness ?? 0))} % of its rating` },
  ]}
/>
