<!--
  A bench power supply with a voltage knob and a current-limit knob, and a load to connect. The CV and CC
  lamps show which of the supply's two modes is in charge; try the LED with no resistor at two different limits.
  Physics in supply.ts (the analog engine's `supply` element).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { formatReadout, formatSI } from '$lib/bench/format';
  import { LOADS, runSupply, type Load } from './supply';

  let { n }: { n?: string } = $props();

  let volts = $state(5);
  let limit = $state(0.5);
  let load = $state<Load>('led');
  let connected = $state(false);

  const out = $derived(runSupply(load, volts, limit, connected));
  const loadText = $derived(LOADS.find((l) => l.value === load)!.text);
  const nb = (s: string) => s.replace(/ /g, ' ');

  const story = $derived.by(() => {
    if (!connected) return 'Output off: the terminals sit at the voltage you set, and no current flows. This is the moment to set the limit.';
    if (out.burned) return `The LED burned out. With a limit of ${nb(formatSI(limit, 'A', 3))} the supply let far more than the LED’s 30 mA rating through, and the little junction cooked in milliseconds.`;
    if (out.cc) return `Constant-current mode. The load asked for more than ${nb(formatSI(limit, 'A', 3))}, so the supply lowered its own voltage to ${nb(formatSI(out.volts, 'V', 3))} to hold the current at the limit.`;
    return `Constant-voltage mode. The load takes ${nb(formatSI(out.amps, 'A', 3))}, below the limit, so the supply simply holds ${nb(formatSI(out.volts, 'V', 3))}.`;
  });
</script>

<Widget title="Bench supply" {n} kind="Instrument" caption="Choose the LED with no resistor. Connect it with the limit at 500 mA, then again at 20 mA. A current limit turns a fault into a warning light.">
  <div class="lab ui">
    <div class="panel">
      <div class="disp">
        <div class="cell">
          <span class="v">{nb(formatReadout(out.volts, 'V', 3))}</span>
          <span class="k">output voltage</span>
        </div>
        <div class="cell">
          <span class="v">{nb(formatReadout(Math.abs(out.amps) < 1e-9 ? 0 : out.amps, 'A', 3))}</span>
          <span class="k">output current</span>
        </div>
        <div class="modes">
          <span class="lamp cv" class:on={!out.cc}><i></i>CV</span>
          <span class="lamp cc" class:on={out.cc}><i></i>CC</span>
        </div>
      </div>
      <div class="knobs">
        <Slider label="Voltage" min={0} max={15} step={0.1} bind:value={volts} format={(v) => nb(formatSI(v, 'V', 3))} />
        <Slider label="Current limit" min={0.001} max={5} log bind:value={limit} format={(v) => nb(formatSI(v, 'A', 2))} />
      </div>
    </div>

    <div class="load">
      <Segmented label="Load" bind:value={load} options={LOADS.map((l) => ({ value: l.value, label: l.label }))} size="sm" />
      <div class="conn">
        <Toggle label={connected ? 'Load connected' : 'Load disconnected'} bind:checked={connected} />
        {#if load === 'led' || load === 'led-resistor'}
          <span class="led" class:burnt={out.burned} style:--b={out.brightness ?? 0} role="img" aria-label={out.burned ? 'LED burned out' : (out.brightness ?? 0) > 0.02 ? 'LED lit' : 'LED dark'}
            ><i></i></span
          >
        {/if}
      </div>
      <p class="what">{loadText}</p>
    </div>
    <p class="story" class:bad={out.burned} role="status">{story}</p>
  </div>
</Widget>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
  }
  .panel {
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 0.8rem;
    background: light-dark(#f0e7d3, #16202d);
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .disp {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: center;
    background: #1c2a24;
    color-scheme: dark;
    border-radius: 6px;
    padding: 0.55rem 0.9rem;
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.5);
  }
  .cell {
    display: flex;
    flex-direction: column;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1.7rem;
    font-weight: 600;
    color: #5cf0a0;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px rgb(92 240 160 / 0.4);
    min-width: 6.5ch;
  }
  .k {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7fbf9f;
  }
  .modes {
    margin-left: auto;
    display: flex;
    gap: 0.8rem;
  }
  .lamp {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: #6f8a7c;
  }
  .lamp i {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: #2d3d35;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
  }
  .lamp.cv.on {
    color: #5cf0a0;
  }
  .lamp.cv.on i {
    background: #5cf0a0;
    box-shadow: 0 0 8px #5cf0a0;
  }
  .lamp.cc.on {
    color: #ff7a6b;
  }
  .lamp.cc.on i {
    background: #ff6464;
    box-shadow: 0 0 10px #ff6464;
  }
  .knobs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.4rem 1.6rem;
  }
  .load {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .conn {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }
  .what {
    margin: 0;
    font-size: 0.84rem;
    color: var(--mute);
  }
  .led {
    width: 1.4rem;
    height: 1.4rem;
    display: grid;
    place-items: center;
  }
  .led i {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--sig-x) calc(var(--b) * 100%), var(--surface-3));
    box-shadow: 0 0 calc(var(--b) * 14px) calc(var(--b) * 3px) color-mix(in srgb, var(--sig-x) 70%, transparent);
    border: 1px solid var(--line-strong);
  }
  .led.burnt i {
    background: repeating-linear-gradient(45deg, var(--fg) 0 2px, transparent 2px 5px);
    opacity: 0.5;
  }
  .story {
    margin: 0;
    padding: 0.5rem 0.7rem;
    font-size: 0.88rem;
    line-height: 1.5;
    border-left: 3px solid var(--copper);
    background: var(--copper-soft);
    border-radius: 0 5px 5px 0;
  }
  .story.bad {
    border-left-color: var(--bad);
    background: var(--bad-soft);
  }
</style>
