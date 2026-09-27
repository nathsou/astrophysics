<script lang="ts">
  import { onMount } from 'svelte';
  import type { NGramStats } from '@lm/core/ngram';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { charData, wordData, MAX_ORDER } from '../shared';

  type Row = { n: number; coverage: number; distinct: number; possible: number };
  let chars = $state<Row[]>([]);
  let words = $state<Row[]>([]);

  /** Fraction of validation n-gram occurrences that also occur in training. */
  function coverage(stats: NGramStats, val: number[], maxN: number, V: number): Row[] {
    const out: Row[] = [];
    const ids = val.slice(0, 30000);
    for (let n = 1; n <= maxN; n++) {
      let seen = 0, tot = 0;
      for (let t = n; t <= ids.length; t++) {
        tot++;
        if (stats.count(n, stats.codeOf(ids, t, n)) > 0) seen++;
      }
      out.push({ n, coverage: seen / tot, distinct: stats.table(n).codes.length, possible: V ** n });
    }
    return out;
  }

  onMount(async () => {
    const c = await charData();
    chars = coverage(c.stats, c.val, MAX_ORDER, c.vocab.vocabSize);
    const w = await wordData();
    words = coverage(w.stats, w.val, 3, w.vocab.vocabSize);
  });

  const fmt = (v: number) => (v >= 1e6 ? v.toExponential(1).replace('e+', '×10^') : v.toLocaleString('en-GB'));
</script>

<Widget
  title="The curse of sparsity"
  subtitle="What fraction of the n-grams in held-out text were ever seen in training? For characters, coverage falls steadily; for words it collapses almost immediately."
>
  <Legend items={[{ label: 'Characters (V = 65)', color: 'var(--series-1)' }, { label: 'Words (V ≈ 11,000)', color: 'var(--series-2)' }]} />
  {#if chars.length}
    <Plot
      label="Validation n-gram coverage against n for characters and words"
      height={280}
      x={{ domain: [1, MAX_ORDER], label: 'n', ticks: 8, format: (v) => String(v) }}
      y={{ domain: [0, 1], label: 'Validation n-grams seen in training', ticks: 5, format: (v) => `${Math.round(v * 100)}%` }}
    >
      {#snippet marks({ sx, sy })}
        {#each [{ rows: chars, color: 'var(--series-1)' }, { rows: words, color: 'var(--series-2)' }] as s (s.color)}
          {#if s.rows.length}
            <path class="line" stroke={s.color} d={'M' + s.rows.map((r) => `${sx(r.n)},${sy(r.coverage)}`).join('L')} />
            {#each s.rows as r (r.n)}<circle class="dot" cx={sx(r.n)} cy={sy(r.coverage)} r="4" fill={s.color} />{/each}
          {/if}
        {/each}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const n = Math.round(x)}
        {@const c = chars[n - 1]}
        {@const w = words[n - 1]}
        <div><strong>n = {n}</strong></div>
        {#if c}<div class="num">chars: {(c.coverage * 100).toFixed(1)}% seen · {fmt(c.distinct)} distinct of {fmt(c.possible)} possible</div>{/if}
        {#if w}<div class="num">words: {(w.coverage * 100).toFixed(1)}% seen · {fmt(w.distinct)} distinct of {fmt(w.possible)} possible</div>{/if}
      {/snippet}
    </Plot>
  {:else}
    <p class="k">Counting…</p>
  {/if}
</Widget>

<style>
  .k {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
