<!--
  Fan-out: one inverter (an nMOS/pMOS pair on the analog engine) drives N gate inputs, each a small
  capacitor. The trace shows the input and the output over one period of a 5 MHz square wave, with the
  edge of a single load as a dashed reference; the numbers are measured on the trace and compared with the
  RC estimate of Chapter 4.

    ::fan-out{n="10.3"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { C_INPUT, PERIOD, R_ON, VDD, crossing, delayEstimate, edges, fmax, loadCapacitance, riseEstimate, simulate, type Trace } from './fanout';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let loads = $state(4);
  const trace = $derived(simulate(loads));
  const one: Trace = simulate(1);
  const e = $derived(edges(trace));
  const c = $derived(loadCapacitance(loads));

  // Scope geometry.
  const X0 = 40;
  const X1 = 400;
  const Y0 = 24;
  const Y1 = 180;
  const TMAX = PERIOD;
  const px = (t: number) => X0 + (t / TMAX) * (X1 - X0);
  const py = (v: number) => Y1 - 8 - (v / VDD) * (Y1 - Y0 - 16);
  function line(t: Trace, key: 'vin' | 'vout'): string {
    const step = Math.max(1, Math.floor(t.t.length / 500));
    let d = '';
    for (let i = 0; i < t.t.length; i += step) d += `${d ? 'L' : 'M'}${px(t.t[i]!).toFixed(1)} ${py(t[key][i]!).toFixed(1)}`;
    return d;
  }
  const inPath = $derived(line(trace, 'vin'));
  const outPath = $derived(line(trace, 'vout'));
  const refPath = line(one, 'vout');

  // Where the output rises through 10 % and 90 %: the span whose length is the rise time.
  const inFall = $derived(crossing(trace.t, trace.vin, VDD / 2, 'fall'));
  const r10 = $derived(crossing(trace.t, trace.vout, 0.1 * VDD, 'rise', inFall - 1e-12));
  const r90 = $derived(crossing(trace.t, trace.vout, 0.9 * VDD, 'rise', inFall - 1e-12));
  const out50 = $derived(crossing(trace.t, trace.vout, VDD / 2, 'rise', inFall - 1e-12));

  const ns = (s: number) => `${(s * 1e9).toFixed(s < 1e-8 ? 1 : 0)} ns`;
  const pF = (f: number) => `${(f * 1e12).toFixed(0)} pF`;
  const MHz = (f: number) => `${(f / 1e6).toFixed(0)}\u202fMHz`;

  // The loads drawn along the output wire: at most ten, the rest are counted.
  const caps = $derived(Array.from({ length: Math.min(loads, 10) }, (_, i) => 150 + i * 24));
  const busEnd = $derived(caps[caps.length - 1]! + 14);
  const label = $derived(
    `An inverter drives ${loads} gate inputs of ${pF(C_INPUT)} each, ${pF(c)} in all. The output takes ${ns(e.rise)} to rise from 10 to 90 percent and ${ns(e.tpLH)} to cross half the supply after the input changes.`,
  );
</script>

<Widget {n} title="Fan-out" subtitle="Every gate you connect is another capacitor to charge" kind="Lab bench" {caption} onreset={() => (loads = 4)}>
  {#snippet controls()}
    <Slider label="Gate inputs driven (fan-out)" bind:value={loads} min={1} max={20} step={1} format={(v) => `${v}`} />
  {/snippet}

  <div class="fo">
    <svg viewBox="0 0 420 92" class="rig" role="img" aria-label="An inverter driving {loads} capacitors in parallel">
      <!-- The driver: a triangle with a bubble, then the output wire (the bus) with a capacitor to ground per load. -->
      <path class="ink" d="M14 34 H36" />
      <path class="sym" d="M36 18 V50 L76 34 Z" />
      <circle class="sym" cx="80.5" cy="34" r="4.5" />
      <path class="ink" d="M85 34 H{busEnd}" />
      {#each caps as x, i (i)}
        <path class="ink" d="M{x} 34 V44 M{x} 50 V66" />
        <path class="plate" d="M{x - 6} 44 H{x + 6} M{x - 6} 50 H{x + 6}" />
      {/each}
      <path class="ink" d="M{caps[0]! - 12} 66 H{busEnd + 4} M{busEnd - 8} 66 V70 M{busEnd - 16} 70 H{busEnd} M{busEnd - 13} 74 H{busEnd - 3}" />
      <text class="lbl" x="56" y="86" text-anchor="middle">R ≈ {R_ON.toFixed(0)} Ω</text>
      <text class="lbl" x="130" y="28">{loads} × {pF(C_INPUT)} + {pF(loadCapacitance(0))} own = {pF(c)}</text>
      {#if loads > 10}<text class="lbl" x={busEnd + 8} y="50">+{loads - 10}</text>{/if}
    </svg>

    <svg viewBox="0 0 420 210" class="scope" role="img" aria-label={label}>
      {#each [0, 1, 2, 3, 4, 5] as v (v)}
        <line class="grid" x1={X0} x2={X1} y1={py(v)} y2={py(v)} />
        <text class="tick" x={X0 - 6} y={py(v) + 3} text-anchor="end">{v}</text>
      {/each}
      {#each [0, 50, 100, 150, 200] as t (t)}
        <line class="grid" x1={px(t * 1e-9)} x2={px(t * 1e-9)} y1={Y0} y2={Y1} />
        <text class="tick" x={px(t * 1e-9)} y={Y1 + 14} text-anchor="middle">{t}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <text class="axis" x={(X0 + X1) / 2} y="206" text-anchor="middle">time (ns)</text>
      <text class="axis" x="10" y={(Y0 + Y1) / 2} text-anchor="middle" transform="rotate(-90 10 {(Y0 + Y1) / 2})">volts</text>

      <path class="trace in" d={inPath} />
      <path class="trace ref" d={refPath} />
      <path class="trace out" d={outPath} />
      {#if Number.isFinite(r10) && Number.isFinite(r90)}
        <line class="span" x1={px(r10)} x2={px(r90)} y1={py(0.1 * VDD) + 0} y2={py(0.1 * VDD)} />
        <line class="mark" x1={px(r10)} x2={px(r10)} y1={py(0.1 * VDD)} y2={py(0.9 * VDD)} />
        <line class="mark" x1={px(r90)} x2={px(r90)} y1={py(0.1 * VDD)} y2={py(0.9 * VDD)} />
      {/if}
      {#if Number.isFinite(inFall) && Number.isFinite(out50)}
        <line class="delay" x1={px(inFall)} x2={px(out50)} y1={py(VDD / 2)} y2={py(VDD / 2)} />
      {/if}
      <text class="key in" x={X0} y="14">input</text>
      <text class="key out" x={X0 + 50} y="14">output</text>
      <text class="key ref" x={X0 + 106} y="14">output with one load (dashed)</text>
    </svg>

    <dl class="stats ui">
      <div><dt>10–90 % rise time</dt><dd>{ns(e.rise)}</dd><small>RC estimate 2.2 R C = {ns(riseEstimate(loads))}</small></div>
      <div><dt>Delay to the 50 % point</dt><dd>{ns(e.tpLH)}</dd><small>ln 2 · R C = {ns(delayEstimate(loads))}</small></div>
      <div><dt>Fastest clock (half period = 5τ)</dt><dd>{MHz(fmax(e.rise))}</dd><small>with {loads} load{loads === 1 ? '' : 's'} on the wire</small></div>
    </dl>
  </div>
</Widget>

<style>
  .fo {
    display: grid;
    gap: 0.9rem;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    font-family: var(--font-mono);
  }
  .rig,
  .scope {
    max-width: 36rem;
    justify-self: start;
  }
  .ink {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sym {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .plate {
    fill: none;
    stroke: var(--fg);
    stroke-width: 2.2;
    stroke-linecap: round;
  }
  .lbl {
    fill: var(--ink-2);
    font-size: 10px;
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-size: 10px;
  }
  .axis {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .trace {
    fill: none;
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .trace.in {
    stroke: var(--sig-low);
  }
  .trace.out {
    stroke: var(--sig-high);
  }
  .trace.ref {
    stroke: var(--sig-high);
    stroke-width: 1.4;
    stroke-dasharray: 4 3;
    opacity: 0.6;
  }
  .span {
    stroke: var(--copper);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .mark {
    stroke: var(--copper);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .delay {
    stroke: var(--sig-current);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .key {
    font-size: 10px;
    font-weight: 600;
  }
  .key.in {
    fill: var(--sig-low);
  }
  .key.out,
  .key.ref {
    fill: var(--sig-high);
  }
  .key.ref {
    opacity: 0.75;
    font-weight: 500;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.6rem 1rem;
    margin: 0;
  }
  .stats div {
    display: grid;
    gap: 0.1rem;
    border-left: 3px solid var(--copper);
    padding-left: 0.6rem;
  }
  dt {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 600;
  }
  small {
    font-size: 0.74rem;
    color: var(--mute);
  }
</style>
