<script lang="ts">
  import { onMount } from 'svelte';
  import * as T from '@lm/core/text';
  import { impl } from '$lib/exercise/impl.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Bars from '$lib/charts/Bars.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { shakespeare, visible, type CorpusStats } from '../corpus-stats';

  let s = $state<CorpusStats | null>(null);
  let error = $state<string | null>(null);
  let unit = $state<'chars' | 'words'>('chars');
  let fold = $state(false);
  let topN = $state(24);

  onMount(() => {
    shakespeare().then((r) => (s = r)).catch((e) => (error = String(e)));
  });

  const entropy = $derived(impl.get('text.entropy', T.entropy));
  const mine = $derived(impl.isMine('text.entropy'));
  const ranks = $derived(!s ? [] : unit === 'words' ? s.wordRanks : fold ? s.charRanksFolded : s.charRanks);
  const total = $derived(ranks.reduce((a, r) => a + r.count, 0));
  const H = $derived.by(() => {
    try {
      return entropy(ranks.map((r) => r.count), 2);
    } catch {
      return NaN;
    }
  });
  const pct = (v: number) => `${((v / total) * 100).toFixed(2)}%`;
</script>

<Widget title="Exploring a corpus" subtitle="TinyShakespeare: 1.1 MB of plays. Switch between characters and words and notice how lopsided the distributions are.">
  {#snippet controls()}
    <div class="seg" role="radiogroup" aria-label="Unit">
      <button role="radio" aria-checked={unit === 'chars'} class:on={unit === 'chars'} onclick={() => (unit = 'chars')}>Characters</button>
      <button role="radio" aria-checked={unit === 'words'} class:on={unit === 'words'} onclick={() => (unit = 'words')}>Words</button>
    </div>
    {#if unit === 'chars'}<Toggle bind:checked={fold} label="Fold case" />{/if}
  {/snippet}

  {#if error}
    <p>Couldn’t load the corpus: {error}</p>
  {:else if !s}
    <p class="loading">Loading 1.1 MB of Shakespeare…</p>
  {:else}
    <div class="tiles">
      <div class="tile"><span class="k">Tokens</span><span class="v">{total.toLocaleString('en-GB')}</span><span class="d">{unit === 'chars' ? 'characters' : 'words'} in total</span></div>
      <div class="tile"><span class="k">Types</span><span class="v">{ranks.length.toLocaleString('en-GB')}</span><span class="d">distinct {unit === 'chars' ? 'characters' : 'words'}</span></div>
      <div class="tile"><span class="k">Unigram entropy</span><span class="v">{Number.isFinite(H) ? H.toFixed(2) : '—'}</span><span class="d">bits per {unit === 'chars' ? 'character' : 'word'}{mine ? ' · your entropy()' : ''}</span></div>
      <div class="tile"><span class="k">Hapax legomena</span><span class="v">{ranks.filter((r) => r.count === 1).length.toLocaleString('en-GB')}</span><span class="d">types seen exactly once</span></div>
    </div>
    <Bars
      label="Most frequent {unit}"
      items={ranks.slice(0, topN).map((r) => ({ label: visible(r.item), value: r.count, key: r.item }))}
      format={(v) => v.toLocaleString('en-GB')}
    />
    <div class="more">
      <span>Top {topN} of {ranks.length.toLocaleString('en-GB')} · together {pct(ranks.slice(0, topN).reduce((a, r) => a + r.count, 0))} of all tokens</span>
      {#if topN < 60}<button onclick={() => (topN += 12)}>Show more</button>{/if}
    </div>
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
  .loading {
    color: var(--ink-3);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .k {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .v {
    font-size: 1.45rem;
    font-weight: 620;
    letter-spacing: -0.01em;
  }
  .d {
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .more {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.6rem;
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  .more button {
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.78rem;
  }
</style>
