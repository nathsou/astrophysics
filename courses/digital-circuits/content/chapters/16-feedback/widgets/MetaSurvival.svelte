<!--
  How long does a latch stay undecided? 1,500 releases of S and R from S = R = 1 on the digital engine's SR latch, timed,
  and the fraction still undecided after each time t, on a logarithmic axis: a straight line, e^(−t/τ). A second slider
  says what a longer wait buys.

    ::meta-survival{n="16.4"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { meanTime, oneIn, resolutionTimes, survival } from './survival';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const TRIALS = 1500;
  let tau = $state(2);
  let seed = $state(1);
  let wait = $state(10);
  let times: number[] = $state.raw([]);
  let busy = $state(true);

  $effect(() => {
    const t = tau;
    const s = seed;
    busy = true;
    // A short pause lets the page paint before 1,500 latches are released.
    const id = setTimeout(() => {
      times = resolutionTimes(t, TRIALS, s);
      busy = false;
    }, 30);
    return () => clearTimeout(id);
  });

  const W = 420;
  const Hh = 250;
  const L = 44;
  const Rr = 10;
  const T = 14;
  const B = 34;
  const YMIN = 1e-3;
  const tmax = $derived(8 * tau);
  const px = (t: number) => L + (t / tmax) * (W - L - Rr);
  const py = (p: number) => T + (Math.log10(1 / Math.max(p, YMIN)) / 3) * (Hh - T - B);
  const grid = [1, 0.1, 0.01, 0.001];
  const ts = $derived(Array.from({ length: 65 }, (_, i) => (i / 64) * tmax));
  const measured = $derived(survival(times, ts));
  const data = $derived(
    ts
      .map((t, i) => ({ t, p: measured[i]! }))
      .filter((d) => d.p > 0)
      .map((d, i) => `${i ? 'L' : 'M'}${px(d.t).toFixed(1)} ${py(d.p).toFixed(1)}`)
      .join(' '),
  );
  const theory = $derived(`M${px(0)} ${py(1)} L${px(3 * Math.log(10) * tau)} ${py(YMIN)}`);
  const ticks = $derived([0, 2, 4, 6, 8].map((k) => k * tau));
  const mean = $derived(meanTime(times));
  const ks = [1, 2, 3, 4];
  const seen = $derived(survival(times, ks.map((k) => k * tau)));
  const pWait = $derived(Math.exp(-wait));
  const pct = (p: number) => `${(p * 100).toFixed(p < 0.01 ? 2 : 1)} %`;
</script>

<Widget {n} title="How long can it hang?" subtitle="1,500 latches, all released at the same instant" kind="Lab bench" {caption} onreset={() => ((tau = 2), (wait = 10), (seed = 1))} live={false}>
  {#snippet controls()}
    <Slider label="Time constant τ" bind:value={tau} min={0.5} max={5} step={0.5} compact format={(v) => `${v.toFixed(1)} ns`} />
    <Button size="sm" onclick={() => (seed += 1)}>Release 1,500 more</Button>
  {/snippet}

  <div class="ms">
    <svg viewBox="0 0 {W} {Hh}" class="plot" role="img" aria-label="Fraction of latches still undecided against time, on a logarithmic axis. The measured points follow the straight line e to the minus t over tau.">
      {#each grid as g (g)}
        <line class="grid" x1={L} x2={W - Rr} y1={py(g)} y2={py(g)} />
        <text class="tick" x={L - 6} y={py(g) + 3} text-anchor="end">{g === 1 ? '100 %' : `${g * 100} %`}</text>
      {/each}
      {#each ticks as t, i (i)}
        <line class="grid" x1={px(t)} x2={px(t)} y1={T} y2={Hh - B} />
        <text class="tick" x={px(t)} y={Hh - B + 14} text-anchor="middle">{+t.toFixed(1)}</text>
      {/each}
      <rect class="frame" x={L} y={T} width={W - L - Rr} height={Hh - T - B} />
      <text class="axis" x={(L + W - Rr) / 2} y={Hh - 6} text-anchor="middle">time since release (ns)</text>
      <text class="axis" x="11" y={(T + Hh - B) / 2} text-anchor="middle" transform="rotate(-90 11 {(T + Hh - B) / 2})">still undecided</text>
      <path class="theory" d={theory} />
      {#if data}<path class="data" d={data} />{/if}
      <text class="key data" x={W - Rr - 118} y={T + 16}>measured</text>
      <text class="key theory" x={W - Rr - 52} y={T + 16}>e<tspan dy="-4" font-size="8">−t/τ</tspan></text>
    </svg>

    <div class="side ui">
      <p class="lead">{busy ? 'Releasing…' : `Mean time undecided: ${mean.toFixed(2)} ns, for a τ of ${tau.toFixed(1)} ns.`}</p>
      <table>
        <thead><tr><th>Still undecided after</th><th>By the formula</th><th>Measured</th></tr></thead>
        <tbody>
          {#each ks as k, i (k)}
            <tr><th scope="row">{k} τ = {(k * tau).toFixed(1)} ns</th><td>{pct(Math.exp(-k))}</td><td>{busy ? '…' : pct(seen[i]!)}</td></tr>
          {/each}
        </tbody>
      </table>
      <Slider label="Wait" bind:value={wait} min={0} max={40} step={1} compact format={(v) => `${v} τ`} />
      <p class="lead">After {wait} τ ({(wait * tau).toFixed(0)} ns here) the chance that a latch is still undecided is <strong>{oneIn(pWait)}</strong>. Each extra τ of waiting divides it by e, about 2.7.</p>
    </div>
  </div>
</Widget>

<style>
  .ms {
    display: grid;
    gap: 1rem 1.6rem;
    grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
    align-items: start;
  }
  @media (max-width: 52rem) {
    .ms {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    font-family: var(--font-mono);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
  }
  .tick {
    fill: var(--mute);
    font-size: 9.5px;
  }
  .axis {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .theory {
    fill: none;
    stroke: var(--copper);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }
  .data {
    fill: none;
    stroke: var(--sig-x);
    stroke-width: 2.2;
    stroke-linejoin: round;
  }
  text.key {
    stroke: none;
    font-size: 10px;
    font-weight: 600;
  }
  text.key.data {
    fill: var(--sig-x);
  }
  text.key.theory {
    fill: var(--copper-ink, var(--copper));
  }
  .lead {
    margin: 0 0 0.6rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .lead strong {
    color: var(--fg);
  }
  table {
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-bottom: 0.9rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 0.9rem 0.2rem 0;
    border-bottom: 1px solid var(--line);
    font-weight: 500;
  }
  thead th {
    color: var(--mute);
    font-size: 0.7rem;
  }
  tbody th {
    text-transform: none;
    letter-spacing: normal;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--fg);
  }
  td {
    font-family: var(--font-mono);
    color: var(--fg);
  }
</style>
