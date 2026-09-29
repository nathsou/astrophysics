<!--
  Pick the resistor: a red LED on a 9 V battery with a resistor from the E12 series. Read the LED's current
  and the resistor's power, and see which values are safe. A part that exceeds its rating burns (with smoke);
  moving the slider rebuilds the circuit.
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { formatReadout, formatSI } from '$lib/bench/format';
  import circuit from '../circuits/led-resistor.json';

  let { title = 'Pick the resistor', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  /** The E12 series, 47 Ω to 2.2 kΩ. */
  const E12 = [47, 56, 68, 82, 100, 120, 150, 180, 220, 270, 330, 390, 470, 560, 680, 820, 1000, 1200, 1500, 1800, 2200];
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  kind="Exercise"
  scale={1.2}
  controls={[{ id: 'R1', key: 'resistance', label: 'Resistor (E12 series)', min: 47, max: 2200, value: 390, stops: E12, format: (v) => formatSI(v, 'Ω') }]}
  probes={[
    { label: 'LED current', value: (e) => (e.state('D1').burned ? 'burned out' : formatReadout(e.current('A1', 0), 'A')) },
    { label: 'Power in resistor', value: (e) => formatReadout(Number(e.state('R1').power), 'W') },
    {
      label: 'Verdict',
      value: (e) => {
        if (e.state('D1').burned) return 'LED burned out';
        const i = e.current('A1', 0);
        if (i > 0.03) return 'over the LED’s 30 mA limit';
        if (i > 0.021) return 'above 20 mA: too much';
        if (i > 0.005) return 'good: 5–20 mA';
        return 'dim';
      },
    },
  ]}
/>
