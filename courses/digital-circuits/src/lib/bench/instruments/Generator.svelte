<!--
  Front panel of a function generator on the schematic: waveform, frequency, amplitude, offset and duty.
-->
<script lang="ts">
  import Segmented from '../../components/ui/Segmented.svelte';
  import type { Placed } from '../../sim/netlist/types';
  import { withDefaults, getDef } from '../../sim/netlist/catalog';
  import type { Bench } from '../editor/bench.svelte';
  import Knob from './Knob.svelte';

  let { bench, comp }: { bench: Bench; comp: Placed } = $props();
  const params = $derived(withDefaults(getDef('siggen')!, comp.params));
  const wave = $derived(String(params.waveform));
  const usesDuty = $derived(wave === 'square' || wave === 'pulse');
  const set = (key: string, v: number | string) => bench.setParam(comp.id, key, v);

  // A little picture of the wave, so the waveform buttons say what they do.
  const shape = $derived.by(() => {
    const w = 120;
    const h = 34;
    const duty = Number(params.duty);
    const pts: string[] = [];
    const cycles = 2;
    for (let i = 0; i <= 120; i++) {
      const p = ((i / 120) * cycles) % 1;
      let y: number;
      if (wave === 'sine') y = Math.sin(2 * Math.PI * p);
      else if (wave === 'triangle') y = p < 0.5 ? -1 + 4 * p : 3 - 4 * p;
      else if (wave === 'pulse') y = p < duty ? 1 : -1;
      else y = p < duty ? 1 : -1;
      pts.push(`${((i / 120) * w).toFixed(1)},${(h / 2 - y * (h / 2 - 3)).toFixed(1)}`);
    }
    return pts.join(' ');
  });
</script>

<div class="gen">
  <div class="scr screen" aria-hidden="true">
    <svg viewBox="0 0 120 34" preserveAspectRatio="none"><polyline points={shape} /></svg>
  </div>
  <Segmented
    size="sm"
    label="Waveform"
    options={[
      { value: 'square', label: 'Square' },
      { value: 'sine', label: 'Sine' },
      { value: 'triangle', label: 'Tri' },
      { value: 'pulse', label: 'Pulse' },
    ]}
    value={wave}
    onchange={(v) => set('waveform', v)}
  />
  <div class="knobs">
    <Knob label="Frequency" value={Number(params.frequency)} min={0.01} max={1e8} log unit="Hz" onchange={(v) => set('frequency', v)} />
    <Knob label="Amplitude" value={Number(params.amplitude)} min={0} max={20} step={0.01} unit="V" onchange={(v) => set('amplitude', v)} />
    <Knob label="Offset" value={Number(params.offset)} min={-20} max={20} step={0.01} unit="V" onchange={(v) => set('offset', v)} />
    <Knob label="Duty" value={Number(params.duty)} min={0.01} max={0.99} step={0.01} disabled={!usesDuty} onchange={(v) => set('duty', v)} />
  </div>
  <p class="help">{wave === 'pulse' ? 'Rests at the offset and pulses up by the amplitude.' : 'Swings the offset plus and minus the amplitude.'}</p>
</div>

<style>
  .gen {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .scr {
    height: 3.2rem;
    padding: 0.3rem 0.5rem;
    border-radius: 7px;
    background: var(--scope-bg);
    border: 1px solid color-mix(in srgb, var(--line-strong) 60%, black);
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.5);
  }
  .scr svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  polyline {
    fill: none;
    stroke: var(--phosphor);
    stroke-width: 1.8;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 3px var(--phosphor-glow));
    vector-effect: non-scaling-stroke;
  }
  .knobs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.6rem, 1fr));
    justify-items: center;
    gap: 0.7rem 0.4rem;
  }
  .help {
    margin: 0;
    font-size: 0.74rem;
    color: var(--mute);
  }
</style>
