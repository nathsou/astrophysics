<script lang="ts">
  import { onMount } from 'svelte';
  import * as T from '@lm/core/text';
  import { impl } from '$lib/exercise/impl.svelte';
  import { params, focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { shakespeare, visible, type CorpusStats } from '../corpus-stats';

  let s = $state<CorpusStats | null>(null);
  let unit = $state<'words' | 'chars'>('words');
  let fitInfo = $state<{ r2: number; mine: boolean } | null>(null);

  onMount(() => {
    shakespeare().then((r) => (s = r));
  });

  const ranks = $derived(!s ? [] : unit === 'words' ? s.wordRanks : s.charRanks);
  const sExp = $derived(params.get('zipf.s', 1));
  const C = $derived(params.get('zipf.C', 5000));
  const model = (r: number) => C / r ** sExp;

  // Thin the long tail to one point per pixel-ish so the path stays light.
  const pts = $derived.by(() => {
    const out: { r: number; f: number }[] = [];
    let last = 0;
    for (const x of ranks) {
      if (x.rank < 50 || Math.log(x.rank) - last > 0.004) {
        out.push({ r: x.rank, f: x.count });
        last = Math.log(x.rank);
      }
    }
    return out;
  });

  function fit() {
    const f = impl.get('text.fitPowerLaw', T.fitPowerLaw);
    // Fit the body of the distribution; the extreme tail is dominated by counts of 1 and 2.
    const body = ranks.filter((r) => r.count >= 3);
    try {
      const res = f(body.map((r) => r.rank), body.map((r) => r.count));
      params.set('zipf.s', res.s);
      params.set('zipf.C', res.C);
      fitInfo = { r2: res.r2, mine: impl.isMine('text.fitPowerLaw') };
    } catch (e) {
      fitInfo = null;
      alert(`fitPowerLaw threw: ${e}`);
    }
  }

  const nearest = (r: number) => ranks[Math.min(ranks.length, Math.max(1, Math.round(r))) - 1];
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('en-GB') : v.toPrecision(3));
</script>

<Widget
  title="Zipf’s law in Shakespeare"
  subtitle="Frequency against rank on log–log axes. A power law is a straight line here. Drag s and C in the equation above (or below), or fit them automatically."
  onreset={() => {
    params.set('zipf.s', 1);
    params.set('zipf.C', 5000);
    fitInfo = null;
  }}
>
  {#snippet controls()}
    <div class="seg" role="radiogroup" aria-label="Unit">
      <button role="radio" aria-checked={unit === 'words'} class:on={unit === 'words'} onclick={() => (unit = 'words')}>Words</button>
      <button role="radio" aria-checked={unit === 'chars'} class:on={unit === 'chars'} onclick={() => (unit = 'chars')}>Characters</button>
    </div>
    <Button onclick={fit} disabled={!s}>Fit s and C (least squares)</Button>
    {#if fitInfo}<span class="fit">R² = {fitInfo.r2.toFixed(3)}{fitInfo.mine ? ' · your fitPowerLaw' : ''}</span>{/if}
  {/snippet}

  <Legend
    items={[
      { label: `Observed (${unit})`, color: 'var(--series-1)' },
      { label: `Model f(r) = C / r^s, s = ${sExp.toFixed(2)}`, color: 'var(--series-2)', dashed: true },
    ]}
  />
  {#if s}
    <Plot
      label="Log–log plot of {unit} frequency against rank with a power-law model line"
      height={340}
      x={{ type: 'log', domain: [1, Math.max(10, ranks.length)], label: 'Rank r (1 = most frequent)' }}
      y={{ type: 'log', domain: [0.8, Math.max(10, ranks[0]?.count ?? 10) * 1.5], label: 'Frequency f(r)' }}
      onpointer={(p) => focus.set(p ? 'r' : null, p ? 'zipf-plot' : null)}
    >
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--series-1)" d={'M' + pts.map((p) => `${sx(p.r)},${sy(p.f)}`).join('L')} />
        <path
          class="line"
          stroke="var(--series-2)"
          stroke-dasharray="6 5"
          d={'M' + Array.from({ length: 60 }, (_, i) => Math.exp((Math.log(ranks.length) * i) / 59)).map((r) => `${sx(r)},${sy(model(r))}`).join('L')}
        />
        {#each ranks.slice(0, 1) as w (w.item)}
          <circle class="dot" cx={sx(w.rank)} cy={sy(w.count)} r="4" fill="var(--series-1)" />
          <text x={sx(w.rank) + 8} y={sy(w.count) - 6} class="lab">{visible(w.item)}</text>
        {/each}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const w = nearest(x)}
        {#if w}
          <div><strong>#{w.rank}</strong> <code>{visible(w.item)}</code></div>
          <div class="num">observed {fmt(w.count)} · model {fmt(model(w.rank))}</div>
        {/if}
      {/snippet}
    </Plot>
  {:else}
    <p class="loading">Loading…</p>
  {/if}
</Widget>

<style>
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-control);
    border-radius: 7px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: var(--surface);
    padding: 0.35rem 0.8rem;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .seg button + button {
    border-left: 1px solid var(--border);
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .fit {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    font-family: var(--font-mono);
  }
  .loading {
    color: var(--ink-3);
  }
</style>
