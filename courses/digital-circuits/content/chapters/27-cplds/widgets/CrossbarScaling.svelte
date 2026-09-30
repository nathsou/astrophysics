<!--
  One big array or blocks and a matrix: crosspoints against macrocells on logarithmic axes. The counts are the
  vCPLD-32's (scaling.ts).

    ::crossbar-scaling{n="27.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { SIZES, blocked, monolithic, advantage } from './scaling';

  let { n, caption, size: start = 32 }: { n?: string | number; caption?: string; size?: number } = $props();

  // svelte-ignore state_referenced_locally
  let idx = $state(Math.max(0, SIZES.indexOf(start as (typeof SIZES)[number])));
  const m = $derived(SIZES[idx]!);
  const mono = $derived(monolithic(m));
  const blk = $derived(blocked(m));
  const fmt = (v: number) => v.toLocaleString('en-GB');

  const W = 420;
  const H = 210;
  const L = 46;
  const B = 26;
  const T = 10;
  const R = 10;
  const yMin = Math.log10(500);
  const yMax = Math.log10(7e6);
  const x = (v: number) => L + ((Math.log2(v) - Math.log2(8)) / (Math.log2(512) - Math.log2(8))) * (W - L - R);
  const y = (v: number) => H - B - ((Math.log10(v) - yMin) / (yMax - yMin)) * (H - B - T);
  const path = (f: (s: number) => number) => SIZES.map((s, i) => `${i ? 'L' : 'M'}${x(s).toFixed(1)} ${y(f(s)).toFixed(1)}`).join('');
  const ticks = [1e3, 1e4, 1e5, 1e6];
</script>

<Widget {n} title="One big array, or blocks?" subtitle="Configuration bits against macrocells, both axes logarithmic" {caption} onreset={() => (idx = Math.max(0, SIZES.indexOf(start as (typeof SIZES)[number])))}>
  <div class="cs ui">
    <label class="sl">
      <span>Macrocells</span>
      <input type="range" min="0" max={SIZES.length - 1} step="1" bind:value={idx} aria-label="Number of macrocells" aria-valuetext="{m} macrocells" />
      <output>{m}</output>
    </label>

    <svg viewBox="0 0 {W} {H}" role="img" aria-label="On a log-log plot the single array rises with slope two and the blocked device with slope one; at {m} macrocells they need {fmt(mono.total)} and {fmt(blk.total)} bits">
      {#each ticks as t (t)}
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="grid" />
        <text x={L - 5} y={y(t) + 3} text-anchor="end" class="tick">{t >= 1e6 ? '1 M' : t / 1000 + ' k'}</text>
      {/each}
      {#each SIZES as s (s)}
        <text x={x(s)} y={H - 8} text-anchor="middle" class="tick">{s}</text>
      {/each}
      <path d={path((s) => monolithic(s).total)} class="l1" />
      <path d={path((s) => blocked(s).total)} class="l2" />
      <line x1={x(m)} x2={x(m)} y1={T} y2={H - B} class="cur" />
      <circle cx={x(m)} cy={y(mono.total)} r="4.5" class="d1" />
      <circle cx={x(m)} cy={y(blk.total)} r="4.5" class="d2" />
      <text x={x(256) - 8} y={y(monolithic(256).total) - 4} text-anchor="end" class="lab c1">one array</text>
      <text x={x(256) + 6} y={y(blocked(256).total) + 16} text-anchor="middle" class="lab c2">blocks and a matrix</text>
    </svg>

    <div class="tab">
      <div class="col c1"><h5>One array</h5><p><b>{fmt(mono.total)}</b> crosspoints</p><p>{mono.signals} signals × 2 polarities = {mono.fanIn} columns; each product term is a {mono.fanIn}-input AND.</p></div>
      <div class="col c2"><h5>{blk.blocks} block{blk.blocks === 1 ? '' : 's'} of 8 and a matrix</h5><p><b>{fmt(blk.total)}</b> bits ({fmt(blk.array)} array + {fmt(blk.matrix)} multiplexer)</p><p>Each block sees 24 signals: {blk.fanIn} columns; each product term is a {blk.fanIn}-input AND.</p></div>
    </div>
    <p class="ratio">The single array needs <b>{advantage(m).toFixed(1)}×</b> as many bits{advantage(m) < 1 ? ': at this size the matrix is pure overhead, and one array is smaller' : ''}.</p>
  </div>
</Widget>

<style>
  .cs {
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem 1rem 1rem;
  }
  .sl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 3rem;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .sl output {
    font-family: var(--font-mono);
    color: var(--fg);
    text-align: right;
  }
  input[type='range'] {
    accent-color: var(--copper);
    width: 100%;
  }
  svg {
    width: 100%;
    max-height: 15rem;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 9.5px;
  }
  .l1,
  .l2 {
    fill: none;
    stroke-width: 2.4;
  }
  .l1 {
    stroke: var(--series-7);
  }
  .l2 {
    stroke: var(--series-3);
  }
  .cur {
    stroke: var(--line-strong);
    stroke-dasharray: 3 3;
  }
  .d1 {
    fill: var(--series-7);
  }
  .d2 {
    fill: var(--series-3);
  }
  .lab {
    font-size: 10.5px;
    font-family: var(--font-ui);
    font-weight: 600;
  }
  .lab.c1 {
    fill: var(--series-7);
  }
  .lab.c2 {
    fill: var(--series-3);
  }
  .tab {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem;
  }
  .col {
    border: 1px solid var(--line);
    border-left-width: 4px;
    border-radius: 6px;
    padding: 0.4rem 0.7rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .col.c1 {
    border-left-color: var(--series-7);
  }
  .col.c2 {
    border-left-color: var(--series-3);
  }
  .col h5 {
    margin: 0 0 0.2rem;
    font-size: 0.84rem;
    color: var(--fg);
  }
  .col p {
    margin: 0.1rem 0;
  }
  .col b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .ratio {
    margin: 0;
    font-size: 0.86rem;
  }
  .ratio b {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
</style>
