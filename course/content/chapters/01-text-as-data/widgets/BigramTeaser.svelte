<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { shakespeare, ALPHABET27, type CorpusStats } from '../corpus-stats';

  let s = $state<CorpusStats | null>(null);
  let conditional = $state(true);
  let logScale = $state(false);
  let sample = $state('');
  let hovered = $state<{ row: number; col: number } | null>(null);

  onMount(async () => {
    s = await shakespeare();
    generate();
  });

  const labels = [...ALPHABET27].map((c) => (c === ' ' ? '␣' : c));

  // Row-normalised: P(next = col | current = row).
  const probs = $derived.by(() => {
    if (!s) return new Float32Array(27 * 27);
    const out = new Float32Array(27 * 27);
    for (let r = 0; r < 27; r++) {
      let tot = 0;
      for (let c = 0; c < 27; c++) tot += s.bigram27[r * 27 + c]!;
      for (let c = 0; c < 27; c++) out[r * 27 + c] = tot ? s.bigram27[r * 27 + c]! / tot : 0;
    }
    return out;
  });
  const values = $derived(conditional ? probs : (s?.bigram27 ?? new Float32Array(27 * 27)));

  function generate() {
    if (!s) return;
    let cur = 26;
    let out = '';
    for (let i = 0; i < 160; i++) {
      let u = Math.random();
      let next = 26;
      for (let c = 0; c < 27; c++) {
        u -= probs[cur * 27 + c]!;
        if (u <= 0) {
          next = c;
          break;
        }
      }
      out += ALPHABET27[next];
      cur = next;
    }
    sample = out;
  }

  const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
</script>

<Widget
  title="What comes next? A first look at bigrams"
  subtitle="Rows are the current character, columns the next one. Each row is a probability distribution. Hover a cell, then let the table write some ‘Shakespeare’."
>
  {#snippet controls()}
    <Toggle bind:checked={conditional} label="Normalise rows (P(next | current))" />
    <Toggle bind:checked={logScale} label="Log colour scale" />
  {/snippet}

  {#if s}
    <div class="wrap">
      <div class="map">
        <Heatmap
          {values}
          rows={27}
          cols={27}
          log={logScale}
          rowLabels={labels}
          colLabels={labels}
          rowTitle="current"
          colTitle="next character →"
          maxCell={20}
          format={conditional ? pct : (v) => v.toLocaleString('en-GB')}
          onhover={(c) => (hovered = c)}
          label="27 by 27 heatmap of character bigram {conditional ? 'probabilities' : 'counts'} in TinyShakespeare"
        >
          {#snippet tooltip({ row, col, value })}
            <div>after <code>{labels[row]}</code> comes <code>{labels[col]}</code></div>
            <div class="num"><strong>{conditional ? pct(value) : value.toLocaleString('en-GB') + ' times'}</strong></div>
          {/snippet}
        </Heatmap>
      </div>
      <div class="side">
        {#if hovered}
          {@const row = hovered.row}
          {@const top = [...Array(27).keys()].filter((c) => probs[row * 27 + c]! > 0).sort((a, b) => probs[row * 27 + b]! - probs[row * 27 + a]!).slice(0, 6)}
          <div class="k">Most likely after <code>{labels[row]}</code></div>
          <ol class="top">
            {#each top as c (c)}<li><code>{labels[c]}</code> <span class="num">{pct(probs[row * 27 + c]!)}</span></li>{/each}
          </ol>
        {:else}
          <p class="k">Hover a row to see its most likely successors. Try <code>q</code>.</p>
        {/if}
        <div class="gen">
          <div class="k">Sampled from the table</div>
          <p class="sample">{sample}</p>
          <Button size="sm" onclick={generate}>Sample again</Button>
        </div>
      </div>
    </div>
  {:else}
    <p class="k">Loading…</p>
  {/if}
</Widget>

<style>
  .wrap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: 1.5rem;
  }
  @media (max-width: 800px) {
    .wrap {
      grid-template-columns: 1fr;
    }
  }
  .map {
    min-width: 0;
  }
  .k {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0 0 0.35rem;
  }
  .top {
    margin: 0 0 1rem;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }
  .top li {
    display: flex;
    justify-content: space-between;
  }
  .gen {
    border-top: 1px solid var(--rule);
    padding-top: 0.75rem;
  }
  .sample {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    margin: 0 0 0.5rem;
    word-break: break-all;
  }
</style>
