<script lang="ts">
  import { onMount } from 'svelte';
  import * as T from '@lm/core/text';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { shakespeare } from '../corpus-stats';

  let growth: { n: number; v: number }[] = $state([]);
  onMount(() => {
    shakespeare().then((s) => (growth = T.vocabularyGrowth(s.words, 80)));
  });

  const K = $derived(params.get('heaps.K', 10));
  const beta = $derived(params.get('heaps.beta', 0.6));
  const N = $derived(growth.at(-1)?.n ?? 1);

  function fit() {
    // Heaps' law describes the asymptotic regime; the first few hundred words are all 'new'.
    const pts = growth.filter((p) => p.n >= 2000);
    const r = T.fitPowerLaw(pts.map((p) => p.n), pts.map((p) => p.v));
    params.set('heaps.K', r.C);
    params.set('heaps.beta', -r.s);
  }
</script>

<Widget
  title="Heaps’ law: the vocabulary never stops growing"
  subtitle="Distinct words seen after reading the first n words. However much text you read, new words keep appearing — just ever more slowly."
  onreset={() => {
    params.set('heaps.K', 10);
    params.set('heaps.beta', 0.6);
  }}
>
  {#snippet controls()}
    <Button onclick={fit} disabled={!growth.length}>Fit K and β</Button>
    <span class="note">K = {K.toFixed(1)}, β = {beta.toFixed(3)}</span>
  {/snippet}
  <Legend items={[{ label: 'Observed vocabulary', color: 'var(--series-1)' }, { label: 'V(n) = K·n^β', color: 'var(--series-2)', dashed: true }]} />
  {#if growth.length}
    <Plot
      label="Vocabulary size against number of words read, with a Heaps' law curve"
      height={300}
      x={{ type: 'linear', domain: [0, N], label: 'Words read n', nice: true }}
      y={{ type: 'linear', domain: [0, Math.max(growth.at(-1)!.v, K * N ** beta) * 1.1], label: 'Distinct words V(n)', nice: true }}
    >
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--series-1)" d={'M' + growth.map((p) => `${sx(p.n)},${sy(p.v)}`).join('L')} />
        <path class="line" stroke="var(--series-2)" stroke-dasharray="6 5" d={'M' + Array.from({ length: 80 }, (_, i) => (N * i) / 79).map((n) => `${sx(n)},${sy(K * n ** beta)}`).join('L')} />
      {/snippet}
      {#snippet tooltip({ x })}
        {@const p = growth.reduce((a, b) => (Math.abs(b.n - x) < Math.abs(a.n - x) ? b : a))}
        <div class="num">n = {p.n.toLocaleString('en-GB')}</div>
        <div class="num">observed {p.v.toLocaleString('en-GB')} · model {Math.round(K * p.n ** beta).toLocaleString('en-GB')}</div>
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    font-family: var(--font-mono);
  }
</style>
