<!--
  The 555 astable as a calculator that is also a simulation: pick R1, R2 and C, and the analog engine runs the
  555 of Figure 17.8 (comparators, latch, discharge transistor) and draws the capacitor and output voltages,
  next to what the formula 1.44 / ((R1 + 2·R2)·C) predicts.

    ::astable-555{n="17.9" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { DEFAULT_ASTABLE, predicted, simulate, type Astable, type Waveforms } from './astable555';
  import { formatSI } from '$lib/bench/format';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let r1 = $state(DEFAULT_ASTABLE.r1);
  let r2 = $state(DEFAULT_ASTABLE.r2);
  let c = $state(DEFAULT_ASTABLE.c);
  // The first picture is computed at once (also when the page is prerendered), so that the figure is never empty.
  let w: Waveforms | undefined = $state.raw(simulate(DEFAULT_ASTABLE));
  let shown = `${DEFAULT_ASTABLE.r1}|${DEFAULT_ASTABLE.r2}|${DEFAULT_ASTABLE.c}`;
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const a: Astable = $derived({ r1, r2, c });
  const p = $derived(predicted(a));

  // Later ones take a moment (a fraction of a second): wait until the sliders rest.
  $effect(() => {
    const now = { r1, r2, c };
    const key = `${r1}|${r2}|${c}`;
    if (key === shown) return;
    busy = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      w = simulate(now);
      shown = key;
      busy = false;
    }, 140);
    return () => clearTimeout(timer);
  });
  onMount(() => () => clearTimeout(timer));

  let W = $state(640);
  const H = 70;
  const L = 8;
  const R = 46;
  const tEnd = $derived(w ? w.t[w.t.length - 1]! : 1);
  const yv = (volts: number, y0: number) => y0 + H - 6 - (volts / 5.4) * (H - 12);
  const line = (v: Float64Array, y0: number) => {
    if (!w) return '';
    let d = '';
    const step = Math.max(1, Math.floor(w.t.length / 900));
    for (let i = 0; i < w.t.length; i += step) d += `${i ? 'L' : 'M'}${(L + (w.t[i]! / tEnd) * (W - L - R)).toFixed(1)} ${yv(v[i]!, y0).toFixed(1)}`;
    return d;
  };
  function reset() {
    r1 = DEFAULT_ASTABLE.r1;
    r2 = DEFAULT_ASTABLE.r2;
    c = DEFAULT_ASTABLE.c;
  }
  const pct = (x: number) => `${(100 * x).toFixed(0)} %`;
</script>

<Widget title="The 555 as a clock" subtitle="Choose R1, R2 and C; the simulated 555 and the formula agree" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <div class="ctl">
      <Slider label="R1" bind:value={r1} min={100} max={10000} log format={(v) => formatSI(v, 'Ω', 3)} />
      <Slider label="R2" bind:value={r2} min={1000} max={100000} log format={(v) => formatSI(v, 'Ω', 3)} />
      <Slider label="C" bind:value={c} min={1e-7} max={1e-4} log format={(v) => formatSI(v, 'F', 3)} />
    </div>
  {/snippet}
  <div class="w">
    <div class="plot" bind:clientWidth={W}>
      <svg width={W} height={2 * H + 6} role="img" aria-label="The capacitor voltage, a triangle-like wave between one third and two thirds of 5 volts, above the output, a square wave.">
        {#each [0, 1] as k (k)}
          <line class="rail" x1={L} x2={W - R} y1={yv(0, k * (H + 6))} y2={yv(0, k * (H + 6))} />
        {/each}
        <line class="thr" x1={L} x2={W - R} y1={yv(5 / 3, 0)} y2={yv(5 / 3, 0)} />
        <line class="thr" x1={L} x2={W - R} y1={yv((5 * 2) / 3, 0)} y2={yv((5 * 2) / 3, 0)} />
        <text class="lab" x={W - R + 4} y={yv((5 * 2) / 3, 0) + 3}>⅔ V cc</text>
        <text class="lab" x={W - R + 4} y={yv(5 / 3, 0) + 3}>⅓ V cc</text>
        <text class="name" x={W - R + 4} y="12">CAP</text>
        <text class="name" x={W - R + 4} y={H + 18}>OUT</text>
        {#if w}
          <path class="cap" d={line(w.cap, 0)} />
          <path class="out" d={line(w.out, H + 6)} />
        {/if}
      </svg>
    </div>
    <div class="nums ui" class:busy>
      <div><span>Simulated</span><b>{w && Number.isFinite(w.frequency) ? formatSI(w.frequency, 'Hz', 3) : '…'}</b><small>duty {w && Number.isFinite(w.duty) ? pct(w.duty) : '…'}</small></div>
      <div><span>Formula 1.44 / ((R1 + 2R2)C)</span><b>{formatSI(p.frequency, 'Hz', 3)}</b><small>duty {pct(p.duty)}</small></div>
      <div><span>High / low time</span><b>{formatSI(p.high, 's', 3)} / {formatSI(p.low, 's', 3)}</b><small>{busy ? 'simulating…' : 'from the formula'}</small></div>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .w {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .plot {
    min-width: 0;
  }
  svg {
    display: block;
    max-width: 100%;
    font-family: var(--font-mono);
  }
  .rail {
    stroke: var(--line-strong);
  }
  .thr {
    stroke: var(--mute);
    stroke-dasharray: 3 3;
    stroke-width: 0.8;
  }
  .cap {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 1.6;
  }
  .out {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.8;
  }
  .lab {
    fill: var(--mute);
    font-size: 9px;
  }
  .name {
    fill: var(--fg);
    font-size: 10px;
    font-weight: 700;
  }
  .nums {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.5rem;
    transition: opacity 120ms;
  }
  .nums.busy {
    opacity: 0.6;
  }
  .nums > div {
    display: grid;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
  }
  .nums span,
  .nums small {
    font-size: 0.7rem;
    color: var(--mute);
  }
  .nums b {
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }
</style>
