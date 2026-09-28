<!--
  Niven's proof that π is irrational. If π = a/b, the integral of fₙ(x) sin x over [0, π], with
  fₙ(x) = xⁿ(a − bx)ⁿ/n!, would be a positive integer for every n. But the integrand shrinks to
  nothing. Here a/b is a fraction close to π, and the integral (computed numerically) drops below 1.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const FRACS = [
    { a: 22, b: 7 },
    { a: 333, b: 106 },
    { a: 355, b: 113 },
  ];
  let fi = $state(0);
  let n = $state(3);
  const A = $derived(FRACS[fi]!.a);
  const B = $derived(FRACS[fi]!.b);
  const lnFact = (k: number) => Array.from({ length: k }, (_, i) => Math.log(i + 1)).reduce((s, v) => s + v, 0);
  const f = (x: number) => (x <= 0 || x >= Math.PI ? 0 : Math.exp(n * Math.log(x) + n * Math.log(Math.max(1e-300, A - B * x)) - lnFact(n)) * Math.sin(x));
  const samples = $derived(Array.from({ length: 401 }, (_, i) => (Math.PI * i) / 400));
  const values = $derived(samples.map(f));
  const integral = $derived(values.reduce((s, v, i) => s + (i && i < 400 ? (i % 2 ? 4 : 2) : 1) * v, 0) * (Math.PI / 400 / 3));
  const bound = $derived(Math.exp(n * Math.log(Math.PI) + n * Math.log(A) - lnFact(n)));
  const peak = $derived(Math.max(...values, 1e-300));

  const W = 600;
  const H = 220;
  const X = (x: number) => 30 + (x / Math.PI) * (W - 50);
  const Y = (y: number) => H - 25 - (y / peak) * (H - 45);
  const area = $derived(`M${X(0)},${Y(0)}` + samples.map((x, i) => `L${X(x).toFixed(1)},${Y(values[i]!).toFixed(1)}`).join('') + `L${X(Math.PI)},${Y(0)}Z`);
</script>

<Widget title="Niven’s shrinking integrand" subtitle="Pretend π = a/b for a fraction close to π. The shaded area ∫₀^π fₙ(x) sin x dx would have to be a positive whole number — but as n grows it collapses towards 0." onreset={() => (n = 3)}>
  {#snippet controls()}
    <label class="ctl">pretend π = <select bind:value={fi}>{#each FRACS as fr, i (i)}<option value={i}>{fr.a}/{fr.b}</option>{/each}</select></label>
    <label class="ctl">n = <strong>{n}</strong> <input type="range" min="1" max="60" bind:value={n} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="The integrand of Niven's proof">
    <path d={area} class="area" />
    <line x1="30" x2={W - 20} y1={Y(0)} y2={Y(0)} class="axis" />
    <text x={X(0)} y={H - 8} class="lab">0</text>
    <text x={X(Math.PI)} y={H - 8} class="lab">π</text>
    <text x="34" y="16" class="lab left">peak ≈ {peak.toExponential(2)} (vertical scale adjusts)</text>
  </svg>
  <p class="read num">
    ∫ ≈ <strong>{integral.toExponential(3)}</strong> &nbsp; — bound πⁿaⁿ/n! = {bound.toExponential(2)}
    {#if integral < 1}<span class="ok">— less than 1, so it can’t be a positive integer.</span>{:else}<span class="bad">— still ≥ 1; increase n.</span>{/if}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.1rem 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .area {
    fill: color-mix(in srgb, var(--byrne-blue) 45%, transparent);
    stroke: var(--byrne-blue);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .lab.left {
    text-anchor: start;
  }
  .read {
    font-size: 0.85rem;
    text-align: center;
    margin: 0.2rem 0 0;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--maybe);
  }
</style>
