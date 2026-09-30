<!--
  Cycles per instruction, measured: six programs run on the interpreter, each bar the average cycles one instruction took,
  split into the 3 cycles of fetch and decode every instruction pays and the cycles of its own work. A clock slider turns
  the counts into times: time = instructions × CPI / clock.

    ::cpi-chart{n="23.8" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { MEASURED, ips, measure, seconds, type Measurement } from './cpi';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const data: Measurement[] = MEASURED.map((id) => measure(id));
  let hz = $state(1e6);
  let picked = $state('multiply');

  const MAX = 8;
  const fmtHz = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toPrecision(3)} MHz` : v >= 1e3 ? `${+(v / 1e3).toPrecision(3)} kHz` : `${+v.toPrecision(3)} Hz`);
  function fmtTime(s: number): string {
    if (s >= 1) return `${+s.toPrecision(3)} s`;
    if (s >= 1e-3) return `${+(s * 1e3).toPrecision(3)} ms`;
    if (s >= 1e-6) return `${+(s * 1e6).toPrecision(3)} µs`;
    return `${+(s * 1e9).toPrecision(3)} ns`;
  }
  const sel = $derived(data.find((d) => d.id === picked)!);
  const avg = $derived(data.reduce((s, d) => s + d.cpi, 0) / data.length);
</script>

<Widget title="How many cycles does an instruction take?" subtitle="Measured on six programs" {n} {caption} kind="Measurement">
  {#snippet controls()}
    <Slider label="Clock" bind:value={hz} min={1e3} max={1e8} log format={fmtHz} />
  {/snippet}

  <div class="cc">
    <ul class="bars" aria-label="Cycles per instruction of each program">
      {#each data as d (d.id)}
        <li>
          <button type="button" class="row" class:on={picked === d.id} aria-pressed={picked === d.id} onclick={() => (picked = d.id)}>
            <span class="name">{d.title}</span>
            <span class="bar" role="img" aria-label="{d.title}: {d.cpi.toFixed(2)} cycles per instruction, {(d.overhead / d.instructions).toFixed(0)} of them fetch and decode">
              <span class="seg fd" style="width:{(3 / MAX) * 100}%"></span>
              <span class="seg ex" style="width:{((d.cpi - 3) / MAX) * 100}%"></span>
            </span>
            <span class="v">{d.cpi.toFixed(2)}</span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="axis ui" aria-hidden="true">
      <span></span>
      <span class="ticks">{#each [0, 2, 4, 6, 8] as t (t)}<span style="left:{(t / MAX) * 100}%">{t}</span>{/each}</span>
      <span></span>
    </div>
    <p class="unit ui">cycles per instruction</p>
    <ul class="legend ui">
      <li><span class="key fd"></span>fetch and decode: 3 cycles, every time</li>
      <li><span class="key ex"></span>the instruction’s own work</li>
    </ul>

    <div class="law ui">
      <p class="sel"><b>{sel.title}</b>: {sel.instructions} instructions in {sel.cycles} cycles ({sel.bytes} bytes of program and data).</p>
      <p class="eq">
        <span>{sel.instructions}</span> instructions × <span>{sel.cpi.toFixed(2)}</span> cycles ÷ <span>{fmtHz(hz)}</span> = <b>{fmtTime(seconds(sel.cycles, hz))}</b>
      </p>
      <p class="rate">At {fmtHz(hz)}, with an average CPI of {avg.toFixed(1)}, the Octet executes about <b>{+(ips(hz, avg) / 1e6).toPrecision(3)} million</b> instructions a second. With fetch and decode free it would do {+(ips(hz, avg - 3) / 1e6).toPrecision(3)} million.</p>
    </div>
  </div>
</Widget>

<style>
  .cc {
    display: grid;
    gap: 0.6rem;
  }
  .bars {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 3px;
  }
  .bars li {
    margin: 0;
    padding: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 7.2rem minmax(0, 1fr) 2.6rem;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: var(--fg);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    text-align: left;
    cursor: pointer;
  }
  .row:hover {
    border-color: var(--line-strong);
  }
  .row.on {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .row:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    display: flex;
    height: 1.15rem;
    border-radius: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--line) 40%, transparent);
  }
  .seg.fd,
  .key.fd {
    background: var(--series-1);
  }
  .seg.ex,
  .key.ex {
    background: var(--series-2);
  }
  .v {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-align: right;
  }
  .axis {
    display: grid;
    grid-template-columns: 7.2rem minmax(0, 1fr) 2.6rem;
    gap: 0.6rem;
    padding: 0 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    color: var(--mute);
  }
  .ticks {
    position: relative;
    height: 0.9rem;
  }
  .ticks span {
    position: absolute;
    transform: translateX(-50%);
  }
  .ticks span:first-child {
    transform: none;
  }
  .ticks span:last-child {
    transform: translateX(-100%);
  }
  .unit {
    margin: -0.3rem 0 0;
    text-align: center;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.2rem;
    margin: 0.2rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.76rem;
    color: var(--mute);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .key {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
  }
  .law {
    margin-top: 0.4rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .law p {
    margin: 0 0 0.35rem;
  }
  .law p:last-child {
    margin: 0;
  }
  .eq {
    font-size: 0.98rem;
    color: var(--fg);
  }
  .eq span {
    font-family: var(--font-mono);
  }
  .eq b {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
  @media (max-width: 520px) {
    .row {
      grid-template-columns: 5.4rem minmax(0, 1fr) 2.4rem;
    }
    .axis {
      grid-template-columns: 5.4rem minmax(0, 1fr) 2.4rem;
    }
  }
</style>
