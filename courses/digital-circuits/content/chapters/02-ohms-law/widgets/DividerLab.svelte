<!--
  A live voltage divider: change the battery and the two resistors and compare the voltmeters with the
  formula Vout = Vin · R2 / (R1 + R2).
-->
<script lang="ts">
  import TunableCircuit from '../../01-charge-voltage-current/widgets/TunableCircuit.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import type { Engine } from '$lib/sim/engine';
  import { formatReadout, formatSI } from '$lib/bench/format';
  import circuit from '../circuits/divider.json';

  let { title = 'A voltage divider', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  /** Voltage of a pin of an element, from the engine. */
  function pinVolts(e: Engine, id: string, pin: string): number {
    const el = e.netlist.elements.find((x) => x.id === id)!;
    return e.voltage(el.pins[el.pinNames.indexOf(pin)]!);
  }
</script>

<TunableCircuit
  circuit={circuit as unknown as Circuit}
  {title}
  {caption}
  {n}
  scale={1.3}
  controls={[
    { id: 'B1', key: 'voltage', label: 'Battery', min: 1, max: 12, step: 0.5, value: 9, format: (v) => `${v.toFixed(1)} V` },
    { id: 'R1', key: 'resistance', label: 'R1', min: 100, max: 10000, log: true, value: 2000, format: (v) => formatSI(v, 'Ω') },
    { id: 'R2', key: 'resistance', label: 'R2', min: 100, max: 10000, log: true, value: 1000, format: (v) => formatSI(v, 'Ω') },
  ]}
  probes={[
    { label: 'Vout (voltmeter)', value: (e) => formatReadout(pinVolts(e, 'V1', '+') - pinVolts(e, 'V1', '-'), 'V') },
    {
      label: 'Vin · R2 / (R1 + R2)',
      value: (_e, v) => formatReadout((v['B1.voltage']! * v['R2.resistance']!) / (v['R1.resistance']! + v['R2.resistance']!), 'V'),
    },
    { label: 'Current', value: (e) => formatReadout(e.current('A1', 0), 'A') },
  ]}
/>
