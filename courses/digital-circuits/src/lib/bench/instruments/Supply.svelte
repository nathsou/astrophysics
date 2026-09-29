<!--
  Front panel of a bench power supply on the schematic: voltage and current-limit knobs, CV and CC lights,
  and what the supply is putting out now.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Placed } from '../../sim/netlist/types';
  import { withDefaults, getDef } from '../../sim/netlist/catalog';
  import type { Bench } from '../editor/bench.svelte';
  import { autorange } from './meter';
  import Knob from './Knob.svelte';

  let { bench, comp }: { bench: Bench; comp: Placed } = $props();
  const params = $derived(withDefaults(getDef('supply')!, comp.params));

  let cc = $state(false);
  let vOut = $state(NaN);
  let iOut = $state(NaN);
  onMount(() =>
    bench.onFrame(() => {
      const s = bench.engine?.state(comp.id);
      const c = !!s?.cc;
      const v = typeof s?.value === 'number' ? s.value : NaN;
      const i = typeof s?.current === 'number' ? s.current : NaN;
      if (c !== cc) cc = c;
      if (v !== vOut && !(Number.isNaN(v) && Number.isNaN(vOut))) vOut = v;
      if (i !== iOut && !(Number.isNaN(i) && Number.isNaN(iOut))) iOut = i;
    }),
  );
  const v = $derived(autorange(vOut, 'V', 4));
  const a = $derived(autorange(iOut, 'A', 4));
  const live = $derived(!!bench.engine);
</script>

<div class="supply">
  <div class="face screen" aria-label="Output">
    <div class="line"><span class="num">{live ? v.text : '-.---'}</span><span class="u">{live ? v.prefix : ''}V</span></div>
    <div class="line"><span class="num">{live ? a.text : '-.---'}</span><span class="u">{live ? a.prefix : ''}A</span></div>
  </div>
  <div class="lamps ui" role="group" aria-label="Mode">
    <span class="lamp cv" class:on={live && !cc}><i></i>CV</span>
    <span class="lamp cc" class:on={live && cc}><i></i>CC</span>
  </div>
  <div class="knobs">
    <Knob label="Voltage" value={Number(params.voltage)} min={0} max={30} step={0.1} unit="V" onchange={(x) => bench.setParam(comp.id, 'voltage', x)} />
    <Knob label="Current limit" value={Number(params.limit)} min={0.001} max={5} log unit="A" onchange={(x) => bench.setParam(comp.id, 'limit', x)} />
  </div>
</div>

<style>
  .supply {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.6rem 0.8rem;
    align-items: center;
  }
  .face {
    padding: 0.4rem 0.7rem;
    border-radius: 7px;
    background: var(--scope-bg);
    border: 1px solid color-mix(in srgb, var(--line-strong) 60%, black);
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.5);
    font-family: var(--font-mono);
    color: var(--sig-high);
    text-shadow: 0 0 7px var(--sig-high-glow);
  }
  .line {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 0.35rem;
  }
  .line .num {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    min-width: 5.5rem;
    text-align: right;
  }
  .line .u {
    font-size: 0.9rem;
    min-width: 1.6rem;
  }
  .lamps {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  .lamp {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .lamp i {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  .lamp.on {
    color: var(--fg);
  }
  .lamp.cv.on i {
    background: var(--phosphor);
    box-shadow: 0 0 8px var(--phosphor-glow);
  }
  .lamp.cc.on i {
    background: var(--sig-x);
    box-shadow: 0 0 8px var(--sig-x);
  }
  .knobs {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-around;
    gap: 0.5rem;
    padding-top: 0.2rem;
  }
</style>
