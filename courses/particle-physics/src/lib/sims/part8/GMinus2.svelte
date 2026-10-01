<!--
  The muon g − 2 scoreboard: published measurements and predictions of the muon's anomalous magnetic moment on one axis, and the number of standard deviations
  between any experiment and any prediction (added in quadrature: our arithmetic, not a quoted significance). Values and sources in ./gm2.ts.

    ::g-minus-2{n="32.3" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { VALUES, pull } from './gm2';
  import { sig } from './format';

  let { n, caption, title = 'The muon g − 2: measurements and predictions' }: { n?: string | number; caption?: string; title?: string } = $props();

  let expId = $state('avg25');
  let thId = $state('wp25');
  const exps = VALUES.filter((v) => v.kind === 'experiment');
  const ths = VALUES.filter((v) => v.kind === 'theory');
  const exp = $derived(exps.find((v) => v.id === expId)!);
  const th = $derived(ths.find((v) => v.id === thId)!);
  const result = $derived(pull(exp, th));

  const REF = 116592000;
  const LO = -300, HI = 160;
  const W = 640, ROW = 34, PAD_L = 250, PAD_R = 20, TOP = 26;
  const H = TOP + VALUES.length * ROW + 30;
  const sx = (v: number) => PAD_L + ((v - REF - LO) / (HI - LO)) * (W - PAD_L - PAD_R);
  const ticks = [-300, -200, -100, 0, 100];
</script>

<Widget {title} {n} {caption} kind="Published values">
  {#snippet controls()}
    <Segmented label="Measurement" size="sm" options={exps.map((v) => ({ value: v.id, label: v.label }))} bind:value={expId} />
    <Segmented label="Prediction" size="sm" options={ths.map((v) => ({ value: v.id, label: v.label }))} bind:value={thId} />
  {/snippet}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Muon anomalous magnetic moment: measurements and predictions with one-standard-deviation error bars, in units of 10 to the minus 11, relative to 116 592 000">
    {#each ticks as t}
      <line x1={sx(REF + t)} x2={sx(REF + t)} y1={TOP - 8} y2={H - 26} class="grid" />
      <text x={sx(REF + t)} y={H - 10} text-anchor="middle" class="tick">{t === 0 ? '116 592 000' : (t > 0 ? '+' : '−') + Math.abs(t)}</text>
    {/each}
    {#each VALUES as v, i}
      {@const y = TOP + i * ROW + ROW / 2}
      {@const on = v.id === expId || v.id === thId}
      <text x="8" y={y + 4} class="lbl" class:on>{v.label}</text>
      <line x1={sx(v.value - v.error)} x2={sx(v.value + v.error)} y1={y} y2={y} class="bar {v.kind}" class:on />
      {#if v.kind === 'experiment'}
        <circle cx={sx(v.value)} cy={y} r={on ? 5.5 : 4} class="dot exp" />
      {:else}
        <rect x={sx(v.value) - (on ? 5 : 4)} y={y - (on ? 5 : 4)} width={on ? 10 : 8} height={on ? 10 : 8} class="dot th" />
      {/if}
    {/each}
    <text x={W - PAD_R} y="12" text-anchor="end" class="tick">a_μ in units of 10⁻¹¹, ±1σ: circles are measurements, squares are predictions</text>
  </svg>
  <div class="readout ui" aria-live="polite">
    <p>
      <strong>{exp.label}</strong> minus <strong>{th.label}</strong>: {sig(result.diff, 3)} × 10⁻¹¹, with a combined uncertainty of {sig(result.sigma, 3)} × 10⁻¹¹:
      <strong class="z">{sig(Math.abs(result.z), 2)} standard deviations</strong> ({result.z >= 0 ? 'measurement above prediction' : 'measurement below prediction'}).
    </p>
    <p class="src">Sources: {exp.source}; {th.source}.</p>
  </div>
</Widget>

<style>
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .tick {
    fill: var(--ink-3, var(--mute));
    font-size: 10.5px;
  }
  .lbl {
    fill: var(--ink-2);
    font-size: 12px;
  }
  .lbl.on {
    fill: var(--fg);
    font-weight: 600;
  }
  .bar {
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .bar.experiment {
    stroke: var(--series-1);
  }
  .bar.theory {
    stroke: var(--series-2);
  }
  .bar.on {
    stroke-width: 4;
  }
  .dot.exp {
    fill: var(--series-1);
  }
  .dot.th {
    fill: var(--series-2);
  }
  .readout p {
    margin: 0.5rem 0 0;
    font-size: 0.88rem;
  }
  .z {
    font-family: var(--font-mono);
    color: var(--accent-ink, var(--track-ink));
  }
  .src {
    font-size: 0.75rem !important;
    color: var(--mute);
  }
</style>
