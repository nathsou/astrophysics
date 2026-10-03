<script lang="ts">
  /** The word card: meaning, pinyin, HSK level, the characters inside, and "add to review". */
  import { lookup, LIST_NAMES } from '$lib/zh/lexicon';
  import { settings } from '$lib/state/settings.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { popover } from './popover.svelte';
  import PlayButton from './PlayButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import { wordCardPosition } from './position';

  let card: HTMLElement | undefined = $state();
  const t = $derived(popover.token);
  const entry = $derived(t?.w ? lookup(t.w) : undefined);
  const level = $derived(entry?.l[settings.data.list]);
  const parts = $derived(t && t.t.length > 1 ? [...t.t].map((ch, i) => ({ ch, py: t.s?.[i]?.py ?? '', tone: t.s?.[i]?.tone ?? 5, e: lookup(ch) })) : []);
  const inDeck = $derived(t ? deck.has(t.t) : false);

  let pos = $state({ left: 8, top: 8 });
  $effect(() => {
    if (!popover.anchor || !card) return;
    pos = wordCardPosition(popover.anchor, { width: card.offsetWidth, height: card.offsetHeight }, { width: innerWidth, height: innerHeight });
    card.focus({ preventScroll: true });
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && popover.token) popover.close(true);
  }
  function onDown(e: PointerEvent) {
    if (popover.token && card && !card.contains(e.target as Node)) popover.close();
  }
  function onScroll(e: Event) {
    if (popover.token && !(e.target instanceof Node && card?.contains(e.target))) popover.close();
  }
</script>

<svelte:window onkeydown={onKey} onpointerdown={onDown} onscroll={onScroll} onresize={() => popover.close()} />

{#if t}
  <div bind:this={card} class="wordcard card ui" role="dialog" aria-label="Word: {t.t}" tabindex="-1" style="left: {pos.left}px; top: {pos.top}px">
    <div class="head">
      <span class="chars zh-font" lang="zh-CN">{t.t}</span>
      <div class="audio">
        <PlayButton text={t.t} />
        <PlayButton text={t.t} slow />
        <button type="button" class="btn small ghost" aria-label="Close word card" onclick={() => popover.close(true)}><Icon name="x" size={16} /></button>
      </div>
    </div>
    <p class="py">
      {#each t.s ?? [] as s, i (i)}{i > 0 ? ' ' : ''}<span class="t{s.tone}">{s.py}</span>{/each}
    </p>
    {#if entry?.g}<p class="gloss">{entry.g}</p>{:else}<p class="gloss muted">Not in the course dictionary.</p>{/if}
    {#if entry?.c?.length}<p class="meta">Measure word: <span class="zh-font">{entry.c.join('、')}</span></p>{/if}
    {#if parts.length}
      <ul class="parts">
        {#each parts as p, i (i)}
          <li><span class="zh-font">{p.ch}</span> <span class="t{p.tone} pp">{p.py}</span> <span class="pg">{p.e?.g ?? ''}</span></li>
        {/each}
      </ul>
    {/if}
    <div class="foot">
      {#if level}<span class="hsk" title={LIST_NAMES[settings.data.list]}>HSK {level}</span>{/if}
      <span class="spacer"></span>
      {#if inDeck}
        <span class="in"><Icon name="check" size={15} /> In your review deck</span>
      {:else if entry}
        <button class="btn small" onclick={() => deck.add([t.t], 'word card')}><Icon name="plus" size={15} /> Add to review</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .wordcard {
    position: fixed;
    z-index: 80;
    width: min(20rem, calc(100vw - 16px));
    padding: 0.9rem 1rem 0.8rem;
    box-shadow: var(--shadow-lg);
    font-size: 0.9rem;
    line-height: 1.45;
    max-height: calc(100dvh - 16px);
    overflow: auto;
    overflow-wrap: anywhere;
  }
  .wordcard:focus {
    outline: none;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .chars {
    min-width: 0;
    font-size: 2.4rem;
    line-height: 1.1;
  }
  .audio {
    display: flex;
    flex: none;
    align-items: center;
  }
  .py {
    margin: 0.2rem 0 0.35rem;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .py span {
    color: var(--tone);
  }
  .gloss {
    margin: 0;
    font-size: 0.95rem;
  }
  .muted {
    color: var(--mute);
  }
  .meta {
    margin: 0.35rem 0 0;
    color: var(--mute);
    font-size: 0.82rem;
  }
  .parts {
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0.5rem 0 0;
    border-top: 1px dashed var(--line);
    display: grid;
    gap: 0.15rem;
  }
  .parts .zh-font {
    font-size: 1.1rem;
  }
  .pp {
    color: var(--tone);
    font-weight: 600;
    margin-right: 0.3rem;
  }
  .pg {
    color: var(--ink-2);
    font-size: 0.82rem;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .spacer {
    flex: 1;
  }
  .hsk {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    background: var(--gold-soft);
    color: var(--gold);
  }
  .in {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--jade);
    font-weight: 600;
    font-size: 0.82rem;
  }
</style>
