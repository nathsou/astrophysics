<!--
  Which primes are sums of two squares? Colour the primes by their remainder mod 4 and show a
  representation when there is one. The pattern jumps out.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { primesUpTo } from '$lib/nt';

  let N = $state(200);
  let showRule = $state(false);
  const rep = (p: number): [number, number] | null => {
    for (let x = 1; 2 * x * x <= p; x++) {
      const y = Math.round(Math.sqrt(p - x * x));
      if (y * y === p - x * x) return [x, y];
    }
    return null;
  };
  const rows = $derived(primesUpTo(N).map((p) => ({ p, r: rep(p), m: p % 4 })));
</script>

<Widget title="Primes as sums of two squares" subtitle="Each prime up to the bound, with a way of writing it as x² + y² if there is one. Can you predict which primes have one before you look at the colours?" onreset={() => ((N = 200), (showRule = false))}>
  {#snippet controls()}
    <label class="ctl">primes up to <strong class="num">{N}</strong> <input type="range" min="50" max="600" step="10" bind:value={N} /></label>
    <label class="ctl"><input type="checkbox" bind:checked={showRule} /> colour by remainder mod 4</label>
  {/snippet}
  <div class="grid num">
    {#each rows as r (r.p)}
      <div class="cell" class:yes={r.r} class:m1={showRule && r.m === 1} class:m3={showRule && r.m === 3} class:two={showRule && r.p === 2}>
        <span class="p">{r.p}</span>
        <span class="r">{r.r ? `${r.r[0]}² + ${r.r[1]}²` : '—'}</span>
        {#if showRule}<span class="m">≡ {r.m} (mod 4)</span>{/if}
      </div>
    {/each}
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.4rem, 1fr));
    gap: 4px;
    max-height: 24rem;
    overflow-y: auto;
  }
  .cell {
    display: grid;
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--page);
    font-size: 0.72rem;
    line-height: 1.3;
    transition: background 0.3s;
  }
  .p {
    font-size: 0.9rem;
    font-weight: 700;
  }
  .r {
    color: var(--ink-2);
  }
  .cell:not(.yes) .r {
    color: var(--ink-3);
  }
  .m {
    font-size: 0.66rem;
    color: var(--ink-3);
  }
  .m1 {
    background: color-mix(in srgb, var(--byrne-blue) 18%, var(--page));
    border-color: var(--byrne-blue);
  }
  .m3 {
    background: color-mix(in srgb, var(--byrne-red) 14%, var(--page));
    border-color: var(--byrne-red);
  }
  .two {
    background: color-mix(in srgb, var(--byrne-yellow) 18%, var(--page));
  }
</style>
