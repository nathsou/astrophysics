<script lang="ts">
  /** Every HSK word in the chosen list: search, filter, listen, add to the review deck. */
  import { base } from '$app/paths';
  import { settings } from '$lib/state/settings.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { hskWords, LIST_NAMES } from '$lib/zh/lexicon';
  import { bare, syllables, toneOf } from '$lib/zh/pinyin';
  import { speech } from '$lib/audio/speech.svelte';
  import { State } from 'ts-fsrs';
  import Icon from '$lib/components/ui/Icon.svelte';

  let level = $state(1);
  let query = $state('');
  let status = $state<'all' | 'new' | 'deck' | 'known'>('all');
  let limit = $state(150);

  const words = $derived(hskWords(settings.data.list, level));
  const stateOf = $derived.by(() => {
    void deck.version;
    const m = new Map<string, 'deck' | 'known'>();
    for (const c of Object.values(deck.data.cards)) if (c.kind === 'read') m.set(c.word, c.card.state === State.Review ? 'known' : 'deck');
    return m;
  });
  const norm = (s: string) => bare(s).toLowerCase().replace(/[\s']/g, '');
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      const st = stateOf.get(w.w) ?? 'new';
      if (status !== 'all' && st !== status) return false;
      if (!q) return true;
      return w.w.includes(q) || norm(w.p).includes(norm(q)) || w.g.toLowerCase().includes(q);
    });
  });
  const missing = $derived(words.filter((w) => !stateOf.has(w.w)).length);

  function addAll() {
    const n = deck.add(
      words.filter((w) => !stateOf.has(w.w)).map((w) => w.w),
      `hsk${level}`,
    );
    alert(`${n} words added to your review deck. New cards are introduced ${settings.data.newPerDay} a day.`);
  }
</script>

<svelte:head><title>Word list · Mandarin, Out Loud</title></svelte:head>

<div class="page">
  <h1>Word list</h1>
  <p class="ui lead">The {LIST_NAMES[settings.data.list]} word list (change it in <a href="{base}/settings/">Settings</a>). Tap a word to hear it.</p>

  <div class="controls ui">
    <div class="tabs" role="radiogroup" aria-label="Level">
      {#each [1, 2, 3] as l (l)}
        <button role="radio" aria-checked={level === l} class:on={level === l} onclick={() => ((level = l), (limit = 150))}>HSK {l}</button>
      {/each}
    </div>
    <input type="search" bind:value={query} placeholder="Search characters, pinyin or English" aria-label="Search" />
    <select bind:value={status} aria-label="Status">
      <option value="all">All words</option>
      <option value="new">Not in my deck</option>
      <option value="deck">In my deck</option>
      <option value="known">Learned</option>
    </select>
  </div>
  <p class="ui summary">
    {filtered.length} of {words.length} words.
    {#if missing > 0}<button class="btn small" onclick={addAll}><Icon name="plus" size={14} />Add the {missing} missing HSK {level} words to my deck</button>{/if}
  </p>

  <ul class="list">
    {#each filtered.slice(0, limit) as w (w.w)}
      {@const st = stateOf.get(w.w)}
      <li>
        <button class="row" onclick={() => speech.say(w.w)}>
          <span class="w zh-font" lang="zh-CN">{w.w}</span>
          <span class="p">{#each syllables(w.p) as s, i (i)}<span class="t{toneOf(s)}">{s}</span>{/each}</span>
          <span class="g">{w.g}</span>
          <span class="st ui {st ?? 'new'}">{st === 'known' ? 'learned' : st === 'deck' ? 'in deck' : ''}</span>
        </button>
      </li>
    {/each}
  </ul>
  {#if filtered.length > limit}<button class="btn" onclick={() => (limit += 300)}>Show more</button>{/if}
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 52rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .lead {
    color: var(--ink-2);
    margin: 0 0 1rem;
    font-size: 0.92rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .tabs {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 2px;
  }
  .tabs button {
    border: none;
    background: none;
    border-radius: 999px;
    padding: 0.3rem 0.85rem;
    font-weight: 650;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--mute);
  }
  .tabs button.on {
    background: var(--accent);
    color: #fff;
  }
  input[type='search'],
  select {
    padding: 0.45rem 0.7rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-size: 0.9rem;
  }
  input[type='search'] {
    flex: 1;
    min-width: 12rem;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    font-size: 0.85rem;
    color: var(--mute);
  }
  .list {
    list-style: none;
    margin: 0.5rem 0 1rem;
    padding: 0;
    border-top: 1px solid var(--line);
  }
  .row {
    display: grid;
    grid-template-columns: 6.5rem 9rem 1fr auto;
    gap: 0.8rem;
    align-items: baseline;
    width: 100%;
    padding: 0.45rem 0.4rem;
    border: none;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--fg);
    font-family: var(--font-body);
  }
  .row:hover {
    background: var(--pn);
  }
  .w {
    font-size: 1.35rem;
  }
  .p {
    font-family: var(--font-py);
    font-size: 0.88rem;
    font-weight: 600;
  }
  .p span {
    color: var(--tone);
    margin-right: 0.15rem;
  }
  .g {
    font-size: 0.92rem;
    color: var(--ink-2);
  }
  .st {
    font-size: 0.72rem;
    font-weight: 650;
    border-radius: 999px;
    padding: 0 0.45rem;
  }
  .st.deck {
    background: var(--gold-soft);
    color: var(--gold);
  }
  .st.known {
    background: var(--jade-soft);
    color: var(--jade);
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: 5rem 1fr auto;
    }
    .g {
      grid-column: 2 / 3;
    }
    .p {
      grid-column: 2;
      grid-row: 1;
    }
  }
</style>
