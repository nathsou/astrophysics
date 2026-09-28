<!--
  Oresme's proof (c. 1350) that the harmonic series diverges: group the terms 1/3 + 1/4,
  1/5 + … + 1/8, 1/9 + … + 1/16, … Each group is at least 1/2, and there are infinitely many groups.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let groups = $state(4);
  const HUES = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)', 'var(--accent)'];
  // Group g (g ≥ 1) is the terms 1/(2^(g−1)+1) … 1/2^g; group 0 is the term 1.
  const bars = $derived.by(() => {
    const out: { g: number; n: number; v: number; lower: number }[] = [];
    out.push({ g: 0, n: 1, v: 1, lower: 1 });
    for (let g = 1; g <= groups; g++) {
      const lo = 2 ** (g - 1) + 1;
      const hi = 2 ** g;
      for (let n = lo; n <= hi; n++) out.push({ g, n, v: 1 / n, lower: 1 / hi });
    }
    return out;
  });
  const total = $derived(bars.reduce((s, b) => s + b.v, 0));
  const W = 620;
  const H = 180;
  const barW = $derived((W - 40) / bars.length);
  const groupSums = $derived(Array.from({ length: groups + 1 }, (_, g) => bars.filter((b) => b.g === g).reduce((s, b) => s + b.v, 0)));
</script>

<Widget title="Oresme’s groups" subtitle="The terms 1, ½, ⅓, ¼, … grouped so that each group ends at a power of 2. Every group (after the first) adds up to at least ½: the dashed outlines show the smaller terms 1/2ᵍ that each group beats." onreset={() => (groups = 4)}>
  {#snippet controls()}
    <label class="ctl">groups: <strong>{groups}</strong> <input type="range" min="1" max="7" bind:value={groups} /></label>
    <span class="read num">sum of the first {2 ** groups} terms = {total.toFixed(4)} ≥ 1 + {groups}/2 = {(1 + groups / 2).toFixed(1)}</span>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Bars for the terms of the harmonic series, grouped">
    {#each bars as b, i (b.n)}
      <rect x={20 + i * barW} y={H - 30 - b.v * (H - 45)} width={Math.max(0.6, barW - 0.6)} height={b.v * (H - 45)} fill={HUES[b.g % HUES.length]} class="bar" />
      <rect x={20 + i * barW} y={H - 30 - b.lower * (H - 45)} width={Math.max(0.6, barW - 0.6)} height={b.lower * (H - 45)} class="lower" />
    {/each}
    <line x1="20" x2={W - 20} y1={H - 30} y2={H - 30} class="axis" />
  </svg>
  <div class="sums num">
    {#each groupSums as s, g (g)}
      <span class="chip" style:--h={HUES[g % HUES.length]}>{g === 0 ? '1' : g === 1 ? '1/2' : `1/${2 ** (g - 1) + 1} + … + 1/${2 ** g}`} = {s.toFixed(3)}{g ? ' ≥ ½' : ''}</span>
    {/each}
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .read {
    font-size: 0.82rem;
  }
  .bar {
    fill-opacity: 0.8;
  }
  .lower {
    fill: none;
    stroke: var(--ink);
    stroke-dasharray: 2 2;
    stroke-width: 0.6;
  }
  .axis {
    stroke: var(--ink-3);
  }
  .sums {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    font-size: 0.75rem;
  }
  .chip {
    border-left: 4px solid var(--h);
    background: var(--surface-2);
    border-radius: 4px;
    padding: 0.1rem 0.45rem;
  }
</style>
